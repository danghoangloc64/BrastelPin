const fs = require('fs');
const BrastelCLI = require('../cli');

describe('BrastelCLI', () => {
  let cli;

  beforeEach(() => {
    cli = new BrastelCLI();

    // Create test config files
    createTestConfigFiles();
  });

  describe('parseArgs', () => {
    test('should parse simple command', () => {
      const result = cli.parseArgs(['help']);
      expect(result.commands).toEqual(['help']);
      expect(result.options).toEqual({});
    });

    test('should parse command with options', () => {
      const result = cli.parseArgs(['start', '--random', '--delay', '200']);
      expect(result.commands).toEqual(['start']);
      expect(result.options).toEqual({
        random: true,
        delay: '200'
      });
    });

    test('should parse boolean flags', () => {
      const result = cli.parseArgs(['start', '--random']);
      expect(result.options.random).toBe(true);
    });

    test('should parse key-value options', () => {
      const result = cli.parseArgs(['config', 'set', 'pinrange', '1000-5000']);
      expect(result.commands).toEqual(['config', 'set', 'pinrange', '1000-5000']);
    });
  });

  describe('updatePinRange', () => {
    test('should update PIN range file', () => {
      cli.updatePinRange('1000-5000');

      const content = fs.readFileSync('pinrange.txt', 'utf8');
      expect(content).toBe('1000\n5000');
    });

    test('should handle invalid format', () => {
      expect(() => {
        cli.updatePinRange('invalid-format');
      }).not.toThrow();
    });

    test('should handle single number format', () => {
      expect(() => {
        cli.updatePinRange('1000');
      }).not.toThrow();
    });
  });

  describe('updateAccessCodes', () => {
    test('should update access codes file', () => {
      cli.updateAccessCodes('12345678,87654321,11111111');

      const content = fs.readFileSync('accesscodes.txt', 'utf8');
      expect(content).toBe('12345678\n87654321\n11111111');
    });

    test('should filter empty codes', () => {
      cli.updateAccessCodes('12345678,,87654321,');

      const content = fs.readFileSync('accesscodes.txt', 'utf8');
      expect(content).toBe('12345678\n87654321');
    });

    test('should handle single access code', () => {
      cli.updateAccessCodes('12345678');

      const content = fs.readFileSync('accesscodes.txt', 'utf8');
      expect(content).toBe('12345678');
    });
  });

  describe('updateProxies', () => {
    test('should update proxies file', () => {
      cli.updateProxies('proxy1:8080,proxy2:8080');

      const content = fs.readFileSync('proxies.txt', 'utf8');
      expect(content).toBe('proxy1:8080\nproxy2:8080');
    });

    test('should handle no proxy setting', () => {
      cli.updateProxies('none');

      const content = fs.readFileSync('proxies.txt', 'utf8');
      expect(content).toBe('');
    });

    test('should handle empty proxy setting', () => {
      cli.updateProxies('');

      const content = fs.readFileSync('proxies.txt', 'utf8');
      expect(content).toBe('');
    });
  });

  describe('updateCookies', () => {
    test('should update cookies file with separator', () => {
      cli.updateCookies('cookie1|||cookie2|||cookie3');

      const content = fs.readFileSync('cookies.txt', 'utf8');
      expect(content).toBe('cookie1\ncookie2\ncookie3');
    });

    test('should filter empty cookies', () => {
      cli.updateCookies('cookie1|||||||cookie2|||');

      const content = fs.readFileSync('cookies.txt', 'utf8');
      expect(content).toBe('cookie1\ncookie2');
    });

    test('should handle single cookie', () => {
      cli.updateCookies('single-cookie');

      const content = fs.readFileSync('cookies.txt', 'utf8');
      expect(content).toBe('single-cookie');
    });
  });

  describe('setConfig', () => {
    test('should call appropriate update method for pinrange', () => {
      const updateSpy = jest.spyOn(cli, 'updatePinRange');

      cli.setConfig('pinrange', '1000-5000');

      expect(updateSpy).toHaveBeenCalledWith('1000-5000');
    });

    test('should call appropriate update method for accesscodes', () => {
      const updateSpy = jest.spyOn(cli, 'updateAccessCodes');

      cli.setConfig('accesscodes', '12345,67890');

      expect(updateSpy).toHaveBeenCalledWith('12345,67890');
    });

    test('should call appropriate update method for proxies', () => {
      const updateSpy = jest.spyOn(cli, 'updateProxies');

      cli.setConfig('proxies', 'proxy1,proxy2');

      expect(updateSpy).toHaveBeenCalledWith('proxy1,proxy2');
    });

    test('should call appropriate update method for cookies', () => {
      const updateSpy = jest.spyOn(cli, 'updateCookies');

      cli.setConfig('cookies', 'cookie1|||cookie2');

      expect(updateSpy).toHaveBeenCalledWith('cookie1|||cookie2');
    });

    test('should handle ntfy settings', () => {
      cli.setConfig('ntfy.enabled', 'true');
      cli.setConfig('ntfy.topic', 'new-topic');

      // These should not throw and should log success messages
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Set ntfy.enabled = true'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Set ntfy.topic = new-topic'));
    });

    test('should handle randomProcessing settings', () => {
      cli.setConfig('randomProcessing.enabled', 'false');
      cli.setConfig('randomProcessing.delayBetweenPins', '200');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Set randomProcessing.enabled = false'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Set randomProcessing.delayBetweenPins = 200'));
    });

    test('should handle unknown config key', () => {
      cli.setConfig('unknown.key', 'value');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Unknown config key: unknown.key'));
    });
  });
});