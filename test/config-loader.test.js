const fs = require('fs');

describe('ConfigLoader', () => {
  let ConfigLoader;
  let configLoader;

  beforeEach(() => {
    // Create test config files
    createTestConfigFiles({
      pinRange: ['1000', '5000'],
      accessCodes: ['11111111', '22222222'],
      proxies: ['http://proxy1:8080', 'http://proxy2:8080'],
      cookies: ['cookie1', 'cookie2', 'cookie3']
    });

    // Mock the config files to use test files
    jest.doMock('../brastel-pin-checker', () => {
      const originalModule = jest.requireActual('../brastel-pin-checker');
      const originalConfigLoader = originalModule.ConfigLoader;

      class MockConfigLoader extends originalConfigLoader {
        constructor() {
          super();
          this.configFiles = {
            pinRange: 'test-pinrange.txt',
            accessCodes: 'test-accesscodes.txt',
            proxies: 'test-proxies.txt',
            cookies: 'test-cookies.txt'
          };
        }
      }

      return {
        ...originalModule,
        ConfigLoader: MockConfigLoader
      };
    });

    const { ConfigLoader: ConfigLoaderClass } = require('../brastel-pin-checker');
    ConfigLoader = ConfigLoaderClass;
    configLoader = new ConfigLoader();
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('loadPinRange', () => {
    test('should load PIN range from file', () => {
      const pinRange = configLoader.loadPinRange();

      expect(pinRange.start).toBe(1000);
      expect(pinRange.end).toBe(5000);
    });

    test('should return default range when file does not exist', () => {
      fs.unlinkSync('test-pinrange.txt');

      const pinRange = configLoader.loadPinRange();

      expect(pinRange.start).toBe(0);
      expect(pinRange.end).toBe(9999);
    });

    test('should handle invalid PIN range format', () => {
      fs.writeFileSync('test-pinrange.txt', 'invalid\nformat');

      const pinRange = configLoader.loadPinRange();

      expect(pinRange.start).toBe(0);
      expect(pinRange.end).toBe(9999);
    });
  });

  describe('loadAccessCodes', () => {
    test('should load access codes from file', () => {
      const pinRange = { start: 1000, end: 5000 };
      const accessCodes = configLoader.loadAccessCodes(pinRange);

      expect(accessCodes).toHaveLength(2);
      expect(accessCodes[0].accessCode).toBe('11111111');
      expect(accessCodes[1].accessCode).toBe('22222222');
      expect(accessCodes[0].pinRange).toEqual(pinRange);
    });

    test('should return default access codes when file does not exist', () => {
      fs.unlinkSync('test-accesscodes.txt');
      const pinRange = { start: 0, end: 9999 };

      const accessCodes = configLoader.loadAccessCodes(pinRange);

      expect(accessCodes).toHaveLength(2);
      expect(accessCodes[0].accessCode).toBe('74974423');
      expect(accessCodes[1].accessCode).toBe('33849108');
    });

    test('should filter out empty lines', () => {
      fs.writeFileSync('test-accesscodes.txt', '11111111\n\n22222222\n\n\n');
      const pinRange = { start: 0, end: 9999 };

      const accessCodes = configLoader.loadAccessCodes(pinRange);

      expect(accessCodes).toHaveLength(2);
      expect(accessCodes[0].accessCode).toBe('11111111');
      expect(accessCodes[1].accessCode).toBe('22222222');
    });
  });

  describe('loadProxies', () => {
    test('should load proxies from file', () => {
      const proxies = configLoader.loadProxies();

      expect(proxies).toHaveLength(2);
      expect(proxies[0]).toBe('http://proxy1:8080');
      expect(proxies[1]).toBe('http://proxy2:8080');
    });

    test('should return empty proxy when file does not exist', () => {
      fs.unlinkSync('test-proxies.txt');

      const proxies = configLoader.loadProxies();

      expect(proxies).toHaveLength(1);
      expect(proxies[0]).toBe('');
    });

    test('should return empty proxy when file is empty', () => {
      fs.writeFileSync('test-proxies.txt', '');

      const proxies = configLoader.loadProxies();

      expect(proxies).toHaveLength(1);
      expect(proxies[0]).toBe('');
    });

    test('should return empty proxy when file contains only empty lines', () => {
      fs.writeFileSync('test-proxies.txt', '\n\n\n');

      const proxies = configLoader.loadProxies();

      expect(proxies).toHaveLength(1);
      expect(proxies[0]).toBe('');
    });
  });

  describe('loadCookies', () => {
    test('should load cookies from file', () => {
      const cookies = configLoader.loadCookies();

      expect(cookies).toHaveLength(3);
      expect(cookies[0]).toBe('cookie1');
      expect(cookies[1]).toBe('cookie2');
      expect(cookies[2]).toBe('cookie3');
    });

    test('should return default cookie when file does not exist', () => {
      fs.unlinkSync('test-cookies.txt');

      const cookies = configLoader.loadCookies();

      expect(cookies).toHaveLength(1);
      expect(cookies[0]).toContain('_ga=GA1.2.2004863075');
    });

    test('should filter out empty lines', () => {
      fs.writeFileSync('test-cookies.txt', 'cookie1\n\ncookie2\n\n');

      const cookies = configLoader.loadCookies();

      expect(cookies).toHaveLength(2);
      expect(cookies[0]).toBe('cookie1');
      expect(cookies[1]).toBe('cookie2');
    });

    test('should throw error when no valid cookies found', () => {
      fs.writeFileSync('test-cookies.txt', '\n\n\n');

      const cookies = configLoader.loadCookies();

      // Should fallback to default cookie
      expect(cookies).toHaveLength(1);
      expect(cookies[0]).toContain('_ga=GA1.2.2004863075');
    });
  });

  describe('loadConfig', () => {
    test('should load complete configuration', () => {
      const config = configLoader.loadConfig();

      expect(config.pinRange.start).toBe(1000);
      expect(config.pinRange.end).toBe(5000);
      expect(config.accessCodes).toHaveLength(2);
      expect(config.proxies).toHaveLength(2);
      expect(config.cookies).toHaveLength(3);
      expect(config.concurrentWorkers).toBe(3); // Based on cookies count
    });

    test('should set concurrent workers based on cookies count', () => {
      // Create config with 5 cookies
      createTestConfigFiles({
        cookies: ['c1', 'c2', 'c3', 'c4', 'c5']
      });

      const config = configLoader.loadConfig();

      expect(config.concurrentWorkers).toBe(5);
    });

    test('should have default settings', () => {
      const config = configLoader.loadConfig();

      expect(config.maxRetries).toBe(10);
      expect(config.retryDelay).toBe(3000);
      expect(config.maxUndefinedResults).toBe(25);
      expect(config.randomProcessing.enabled).toBe(true);
      expect(config.randomProcessing.delayBetweenPins).toBe(100);
      expect(config.ntfy.enabled).toBe(true);
      expect(config.ntfy.server).toBe('https://ntfy.sh');
      expect(config.ntfy.topic).toBe('dhloc');
    });
  });
});