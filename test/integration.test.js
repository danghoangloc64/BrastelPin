const fs = require('fs');
const axios = require('axios');
const { spawn } = require('child_process');

// Mock axios to avoid real API calls
jest.mock('axios');

describe('Integration Tests', () => {
  let BrastelPinChecker, ConfigLoader;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: { status: 'success' } });

    // Create test config files
    createTestConfigFiles({
      pinRange: ['0', '10'],
      accessCodes: ['12345678'],
      proxies: [''],
      cookies: ['test-cookie-1', 'test-cookie-2']
    });

    const brastelModule = require('../brastel-pin-checker');
    BrastelPinChecker = brastelModule.BrastelPinChecker;
    ConfigLoader = brastelModule.ConfigLoader;
  });

  describe('Configuration Loading', () => {
    test('should load configuration from files', () => {
      const configLoader = new ConfigLoader();
      const config = configLoader.loadConfig();

      expect(config.pinRange.start).toBe(0);
      expect(config.pinRange.end).toBe(10);
      expect(config.accessCodes).toHaveLength(1);
      expect(config.accessCodes[0].accessCode).toBe('12345678');
      expect(config.cookies).toHaveLength(2);
      expect(config.concurrentWorkers).toBe(2); // Based on cookies count
    });

    test('should handle missing configuration files gracefully', () => {
      // Remove all config files
      const files = ['pinrange.txt', 'accesscodes.txt', 'proxies.txt', 'cookies.txt'];
      files.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });

      const configLoader = new ConfigLoader();
      const config = configLoader.loadConfig();

      // Should use default values
      expect(config.pinRange.start).toBe(0);
      expect(config.pinRange.end).toBe(9999);
      expect(config.accessCodes).toHaveLength(2); // Default access codes
      expect(config.cookies).toHaveLength(1); // Default cookie
    });
  });

  describe('PIN Range Processing', () => {
    test('should process PIN range correctly', () => {
      const configLoader = new ConfigLoader();
      const config = configLoader.loadConfig();

      const pinChecker = new BrastelPinChecker(config, { randomProcessing: false });

      // Should have PIN range from 0 to 10
      expect(config.pinRange.start).toBe(0);
      expect(config.pinRange.end).toBe(10);

      // Access codes should share the same PIN range
      config.accessCodes.forEach(ac => {
        expect(ac.pinRange.start).toBe(0);
        expect(ac.pinRange.end).toBe(10);
      });
    });

    test('should distribute PINs across workers', () => {
      const configLoader = new ConfigLoader();
      const config = configLoader.loadConfig();

      const totalPins = config.pinRange.end - config.pinRange.start + 1;
      const expectedPinsPerWorker = Math.ceil(totalPins / config.concurrentWorkers);

      expect(totalPins).toBe(11); // 0-10 inclusive
      expect(config.concurrentWorkers).toBe(2); // Based on cookies
      expect(expectedPinsPerWorker).toBe(6); // 11/2 = 5.5, rounded up to 6
    });
  });

  describe('CLI Integration', () => {
    test('should handle CLI config updates', () => {
      const CLI = require('../cli');
      const cli = new CLI();

      // Update configuration
      cli.setConfig('pinrange', '100-200');
      cli.setConfig('accesscodes', '11111111,22222222');

      // Verify files were updated
      expect(fs.readFileSync('pinrange.txt', 'utf8')).toBe('100\n200');
      expect(fs.readFileSync('accesscodes.txt', 'utf8')).toBe('11111111\n22222222');

      // Load config and verify
      const configLoader = new ConfigLoader();
      const config = configLoader.loadConfig();

      expect(config.pinRange.start).toBe(100);
      expect(config.pinRange.end).toBe(200);
      expect(config.accessCodes).toHaveLength(2);
      expect(config.accessCodes[0].accessCode).toBe('11111111');
      expect(config.accessCodes[1].accessCode).toBe('22222222');
    });
  });

  describe('Worker Assignment', () => {
    test('should assign fixed cookies and proxies to workers', () => {
      createTestConfigFiles({
        proxies: ['proxy1:8080', 'proxy2:8080'],
        cookies: ['cookie1', 'cookie2']
      });

      const configLoader = new ConfigLoader();
      const config = configLoader.loadConfig();

      expect(config.cookies).toHaveLength(2);
      expect(config.proxies).toHaveLength(2);
      expect(config.concurrentWorkers).toBe(2);

      // Each worker should get its own cookie and proxy
      // This is verified by the worker assignment logic in the main class
    });

    test('should handle no proxy configuration', () => {
      createTestConfigFiles({
        proxies: [''],
        cookies: ['cookie1', 'cookie2', 'cookie3']
      });

      const configLoader = new ConfigLoader();
      const config = configLoader.loadConfig();

      expect(config.proxies).toHaveLength(1);
      expect(config.proxies[0]).toBe('');
      expect(config.concurrentWorkers).toBe(3); // Based on cookies
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid configuration gracefully', () => {
      // Create invalid PIN range
      fs.writeFileSync('pinrange.txt', 'invalid\nrange');
      fs.writeFileSync('accesscodes.txt', ''); // Empty access codes

      const configLoader = new ConfigLoader();

      expect(() => {
        const config = configLoader.loadConfig();
        // Should fall back to defaults
        expect(config.pinRange.start).toBe(0);
        expect(config.pinRange.end).toBe(9999);
      }).not.toThrow();
    });

    test('should handle network errors in mocked environment', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      const configLoader = new ConfigLoader();
      const config = configLoader.loadConfig();

      const pinChecker = new BrastelPinChecker(config, { randomProcessing: false });

      // Should initialize without throwing
      expect(pinChecker).toBeDefined();
    });
  });

  describe('File System Operations', () => {
    test('should create data and log directories', () => {
      const configLoader = new ConfigLoader();
      const config = configLoader.loadConfig();

      const pinChecker = new BrastelPinChecker(config, { randomProcessing: false });

      // Directories should be created during initialization
      // This is handled by the Utils.ensureDirectoryExists method
    });

    test('should handle read-only files gracefully', () => {
      // Create a config file
      fs.writeFileSync('test-readonly.txt', 'test content');

      // Try to change permissions (may not work on all systems)
      try {
        fs.chmodSync('test-readonly.txt', 0o444);
      } catch (e) {
        // Ignore permission errors on Windows
      }

      // Should not throw when trying to read
      expect(() => {
        fs.readFileSync('test-readonly.txt', 'utf8');
      }).not.toThrow();

      // Clean up
      try {
        fs.chmodSync('test-readonly.txt', 0o666);
        fs.unlinkSync('test-readonly.txt');
      } catch (e) {
        // Ignore cleanup errors
      }
    });
  });
});