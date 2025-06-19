/**
 * Comprehensive Test Suite for Brastel PIN Checker
 * Tests all major components and functionality
 */

const fs = require('fs');
const {
  BrastelPinChecker,
  ConfigLoader,
  Utils,
  FileManager,
  Logger,
  ProxyManager,
  PinChecker,
  Worker,
  SingleAccessCodeChecker
} = require('./brastel-pin-checker');

// Create test helper functions
const createTestFiles = () => {
  fs.writeFileSync('test-pinrange.txt', '0\n99');
  fs.writeFileSync('test-accesscodes.txt', '12345678\n87654321');
  fs.writeFileSync('test-proxies.txt', '');
  fs.writeFileSync('test-cookies.txt', 'test-cookie-1\ntest-cookie-2');
};

const cleanupTestFiles = () => {
  const files = [
    'test-pinrange.txt', 'test-accesscodes.txt', 'test-proxies.txt', 'test-cookies.txt',
    'pinrange.txt', 'accesscodes.txt', 'proxies.txt', 'cookies.txt'
  ];
  files.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (e) {
        // Ignore errors
      }
    }
  });
};

// Cleanup before and after all tests
beforeAll(() => {
  cleanupTestFiles();
});

afterAll(() => {
  cleanupTestFiles();
});

afterEach(() => {
  // Clean up any test files created during tests
  const testFiles = fs.readdirSync('.').filter(f => f.startsWith('test-'));
  testFiles.forEach(file => {
    try {
      if (fs.statSync(file).isFile()) {
        fs.unlinkSync(file);
      }
    } catch (e) {
      // Ignore errors
    }
  });
});

describe('Utils Class', () => {
  test('formatPin should pad numbers with leading zeros', () => {
    expect(Utils.formatPin(1)).toBe('0001');
    expect(Utils.formatPin(12)).toBe('0012');
    expect(Utils.formatPin(123)).toBe('0123');
    expect(Utils.formatPin(1234)).toBe('1234');
    expect(Utils.formatPin('56')).toBe('0056');
  });

  test('generateRange should create array of numbers', () => {
    expect(Utils.generateRange(0, 5)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(Utils.generateRange(5, 8)).toEqual([5, 6, 7, 8]);
    expect(Utils.generateRange(3, 3)).toEqual([3]);
    expect(Utils.generateRange(5, 2)).toEqual([]);
  });

  test('chunkArray should split array into chunks', () => {
    expect(Utils.chunkArray([1, 2, 3, 4, 5, 6], 2))
      .toEqual([[1, 2], [3, 4], [5, 6]]);
    expect(Utils.chunkArray([1, 2, 3, 4, 5], 3))
      .toEqual([[1, 2, 3], [4, 5]]);
    expect(Utils.chunkArray([], 2)).toEqual([]);
  });

  test('shuffleArray should return array with same elements', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = Utils.shuffleArray(original);

    expect(shuffled).toHaveLength(5);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(original).toEqual([1, 2, 3, 4, 5]); // Original unchanged
  });

  test('ensureDirectoryExists should create directory', () => {
    const testDir = 'test-directory';

    // Ensure it doesn't exist first
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }

    const created = Utils.ensureDirectoryExists(testDir);
    expect(created).toBe(true);
    expect(fs.existsSync(testDir)).toBe(true);

    // Second call should return false (already exists)
    const alreadyExists = Utils.ensureDirectoryExists(testDir);
    expect(alreadyExists).toBe(false);

    // Cleanup
    fs.rmSync(testDir, { recursive: true });
  });

  test('delay should wait for specified time', async () => {
    const start = Date.now();
    await Utils.delay(50);
    const end = Date.now();

    expect(end - start).toBeGreaterThanOrEqual(40);
    expect(end - start).toBeLessThan(100);
  });
});

describe('ConfigLoader Class', () => {
  test('should load PIN range from file', () => {
    fs.writeFileSync('pinrange.txt', '100\n500');

    const configLoader = new ConfigLoader();
    const pinRange = configLoader.loadPinRange();

    expect(pinRange.start).toBe(100);
    expect(pinRange.end).toBe(500);
  });

  test('should return default PIN range when file missing', () => {
    if (fs.existsSync('pinrange.txt')) {
      fs.unlinkSync('pinrange.txt');
    }

    const configLoader = new ConfigLoader();
    const pinRange = configLoader.loadPinRange();

    expect(pinRange.start).toBe(0);
    expect(pinRange.end).toBe(9999);
  });

  test('should load access codes from file', () => {
    fs.writeFileSync('pinrange.txt', '0\n99');
    fs.writeFileSync('accesscodes.txt', '11111111\n22222222\n33333333');

    const configLoader = new ConfigLoader();
    const pinRange = configLoader.loadPinRange();
    const accessCodes = configLoader.loadAccessCodes(pinRange);

    expect(accessCodes).toHaveLength(3);
    expect(accessCodes[0].accessCode).toBe('11111111');
    expect(accessCodes[1].accessCode).toBe('22222222');
    expect(accessCodes[2].accessCode).toBe('33333333');

    // All should have same PIN range
    accessCodes.forEach(ac => {
      expect(ac.pinRange.start).toBe(0);
      expect(ac.pinRange.end).toBe(99);
    });
  });

  test('should load proxies from file', () => {
    fs.writeFileSync('proxies.txt', 'proxy1:8080\nproxy2:8080');

    const configLoader = new ConfigLoader();
    const proxies = configLoader.loadProxies();

    expect(proxies).toHaveLength(2);
    expect(proxies[0]).toBe('proxy1:8080');
    expect(proxies[1]).toBe('proxy2:8080');
  });

  test('should handle empty proxy file', () => {
    fs.writeFileSync('proxies.txt', '');

    const configLoader = new ConfigLoader();
    const proxies = configLoader.loadProxies();

    expect(proxies).toHaveLength(1);
    expect(proxies[0]).toBe('');
  });

  test('should load cookies from file', () => {
    fs.writeFileSync('cookies.txt', 'cookie1\ncookie2\ncookie3');

    const configLoader = new ConfigLoader();
    const cookies = configLoader.loadCookies();

    expect(cookies).toHaveLength(3);
    expect(cookies[0]).toBe('cookie1');
    expect(cookies[1]).toBe('cookie2');
    expect(cookies[2]).toBe('cookie3');
  });

  test('should load complete configuration', () => {
    fs.writeFileSync('pinrange.txt', '0\n99');
    fs.writeFileSync('accesscodes.txt', '11111111\n22222222');
    fs.writeFileSync('proxies.txt', 'proxy1:8080');
    fs.writeFileSync('cookies.txt', 'cookie1\ncookie2\ncookie3');

    const configLoader = new ConfigLoader();
    const config = configLoader.loadConfig();

    expect(config.pinRange.start).toBe(0);
    expect(config.pinRange.end).toBe(99);
    expect(config.accessCodes).toHaveLength(2);
    expect(config.proxies).toHaveLength(1);
    expect(config.cookies).toHaveLength(3);
    expect(config.concurrentWorkers).toBe(3); // Based on cookies

    // Check default settings
    expect(config.maxRetries).toBe(10);
    expect(config.retryDelay).toBe(3000);
    expect(config.maxUndefinedResults).toBe(25);
    expect(config.randomProcessing.enabled).toBe(true);
    expect(config.ntfy.enabled).toBe(true);
  });
});

describe('FileManager Class', () => {
  test('should initialize with access code', () => {
    const logger = { info: jest.fn() };
    const fileManager = new FileManager(logger, '12345678');

    expect(fileManager.accessCode).toBe('12345678');
    expect(fileManager.logger).toBe(logger);
  });

  test('should get correct file paths', () => {
    const logger = { info: jest.fn() };
    const fileManager = new FileManager(logger, '12345678');

    const paths = fileManager.getFilePaths();

    expect(paths.validPins).toContain('12345678');
    expect(paths.validPins).toContain('valid_pins.json');
    expect(paths.sentPins).toContain('sent_pins.json');
    expect(paths.blacklistPins).toContain('blacklist_pins.json');
  });

  test('should handle pin operations', () => {
    const logger = { info: jest.fn() };
    const fileManager = new FileManager(logger, '12345678');

    // Initialize to create files
    fileManager.initialize();

    // Test sent pins
    expect(fileManager.isPinSent('1234')).toBe(false);
    fileManager.addSentPin('1234');
    expect(fileManager.isPinSent('1234')).toBe(true);

    // Test blacklist
    expect(fileManager.isBlacklisted('5678')).toBe(false);
    fileManager.addBlacklistPin('5678');
    expect(fileManager.isBlacklisted('5678')).toBe(true);

    // Test valid pins
    fileManager.addValidPin('9999');
    const validPins = fileManager.getValidPins();
    const foundPin = validPins.find(p => p.pin === '9999');
    expect(foundPin).toBeDefined();
    expect(foundPin.pin).toBe('9999');
  });
});

describe('Logger Class', () => {
  test('should initialize with access code', () => {
    const logger = new Logger('12345678');
    expect(logger.accessCode).toBe('12345678');
  });

  test('should have logging methods', () => {
    const logger = new Logger('12345678');

    // Mock console.log to avoid actual output
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    logger.info('test info');
    logger.error('test error');
    logger.success('test success');
    logger.warning('test warning');

    expect(consoleSpy).toHaveBeenCalledTimes(4);

    consoleSpy.mockRestore();
  });
});

describe('ProxyManager Class', () => {
  test('should initialize without proxy', () => {
    const logger = { proxy: jest.fn() };
    const proxyManager = new ProxyManager(logger);

    expect(proxyManager.logger).toBe(logger);
  });

  test('should create static proxy', () => {
    const logger = { proxy: jest.fn() };
    const proxyManager = new ProxyManager(logger);

    const agent = proxyManager.createStaticProxy('http://proxy:8080');
    expect(agent).toBeDefined();
  });

  test('should handle no proxy', () => {
    const logger = { proxy: jest.fn() };
    const proxyManager = new ProxyManager(logger);

    const agent = proxyManager.createStaticProxy('');
    expect(agent).toBeNull();
  });
});

describe('Integration Tests', () => {
  test('should create and configure main application', () => {
    fs.writeFileSync('pinrange.txt', '0\n10');
    fs.writeFileSync('accesscodes.txt', '12345678');
    fs.writeFileSync('proxies.txt', '');
    fs.writeFileSync('cookies.txt', 'test-cookie');

    expect(() => {
      const app = new BrastelPinChecker();
      expect(app).toBeDefined();
    }).not.toThrow();
  });

  test('should validate configuration', () => {
    fs.writeFileSync('pinrange.txt', '0\n10');
    fs.writeFileSync('accesscodes.txt', '12345678');
    fs.writeFileSync('proxies.txt', '');
    fs.writeFileSync('cookies.txt', 'test-cookie');

    const app = new BrastelPinChecker();

    expect(() => {
      app.validateConfiguration();
    }).not.toThrow();
  });

  test('should handle worker creation with fixed assignments', () => {
    fs.writeFileSync('pinrange.txt', '0\n10');
    fs.writeFileSync('accesscodes.txt', '12345678');
    fs.writeFileSync('proxies.txt', 'proxy1:8080\nproxy2:8080');
    fs.writeFileSync('cookies.txt', 'cookie1\ncookie2');

    const configLoader = new ConfigLoader();
    const config = configLoader.loadConfig();

    // Should have 2 workers based on 2 cookies
    expect(config.concurrentWorkers).toBe(2);
    expect(config.cookies).toHaveLength(2);
    expect(config.proxies).toHaveLength(2);

    // Test single access code checker
    const checker = new SingleAccessCodeChecker({
      accessCode: '12345678',
      pinRange: { start: 0, end: 10 }
    });

    expect(checker).toBeDefined();
    expect(checker.accessCode).toBe('12345678');
  });

  test('should handle configuration with shared PIN range', () => {
    fs.writeFileSync('pinrange.txt', '100\n200');
    fs.writeFileSync('accesscodes.txt', '11111111\n22222222\n33333333');
    fs.writeFileSync('proxies.txt', '');
    fs.writeFileSync('cookies.txt', 'cookie1\ncookie2');

    const configLoader = new ConfigLoader();
    const config = configLoader.loadConfig();

    // All access codes should share the same PIN range
    expect(config.accessCodes).toHaveLength(3);
    config.accessCodes.forEach(ac => {
      expect(ac.pinRange.start).toBe(100);
      expect(ac.pinRange.end).toBe(200);
    });

    // Workers should equal cookies count
    expect(config.concurrentWorkers).toBe(2);
  });
});

describe('CLI Configuration Management', () => {
  test('should handle CLI config file updates', () => {
    const CLI = require('./cli');
    const cli = new CLI();

    // Test PIN range update
    cli.updatePinRange('500-1000');
    expect(fs.readFileSync('pinrange.txt', 'utf8')).toBe('500\n1000');

    // Test access codes update
    cli.updateAccessCodes('11111111,22222222,33333333');
    expect(fs.readFileSync('accesscodes.txt', 'utf8')).toBe('11111111\n22222222\n33333333');

    // Test proxies update
    cli.updateProxies('proxy1:8080,proxy2:8080');
    expect(fs.readFileSync('proxies.txt', 'utf8')).toBe('proxy1:8080\nproxy2:8080');

    // Test cookies update with separator
    cli.updateCookies('cookie1|||cookie2|||cookie3');
    expect(fs.readFileSync('cookies.txt', 'utf8')).toBe('cookie1\ncookie2\ncookie3');

    // Verify configuration loads correctly
    const configLoader = new ConfigLoader();
    const config = configLoader.loadConfig();

    expect(config.pinRange.start).toBe(500);
    expect(config.pinRange.end).toBe(1000);
    expect(config.accessCodes).toHaveLength(3);
    expect(config.proxies).toHaveLength(2);
    expect(config.cookies).toHaveLength(3);
    expect(config.concurrentWorkers).toBe(3); // Based on cookies
  });
});