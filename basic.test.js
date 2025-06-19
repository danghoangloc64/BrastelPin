// Basic test file for Brastel PIN Checker
const fs = require('fs');

describe('Brastel PIN Checker - Basic Tests', () => {

  test('Math operations work', () => {
    expect(1 + 1).toBe(2);
    expect(2 * 3).toBe(6);
  });

  test('File system operations work', () => {
    const testFile = 'test-temp-basic.txt';

    // Write file
    fs.writeFileSync(testFile, 'Hello World');

    // Read file
    const content = fs.readFileSync(testFile, 'utf8');
    expect(content).toBe('Hello World');

    // Check file exists
    expect(fs.existsSync(testFile)).toBe(true);

    // Clean up
    fs.unlinkSync(testFile);
    expect(fs.existsSync(testFile)).toBe(false);
  });

  test('Can import brastel-pin-checker module', () => {
    expect(() => {
      const module = require('./brastel-pin-checker');
      expect(module).toBeDefined();
      expect(module.Utils).toBeDefined();
      expect(module.ConfigLoader).toBeDefined();
      expect(module.BrastelPinChecker).toBeDefined();
    }).not.toThrow();
  });

  test('Can import CLI module', () => {
    expect(() => {
      const CLI = require('./cli');
    }).not.toThrow();
  });

  test('Utils functions are working', () => {
    const { Utils } = require('./brastel-pin-checker');

    // Test formatPin
    expect(Utils.formatPin(1)).toBe('0001');
    expect(Utils.formatPin(123)).toBe('0123');
    expect(Utils.formatPin(1234)).toBe('1234');

    // Test generateRange
    const range = Utils.generateRange(0, 3);
    expect(range).toEqual([0, 1, 2, 3]);

    // Test chunkArray
    const chunks = Utils.chunkArray([1, 2, 3, 4, 5], 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);

    // Test shuffleArray
    const original = [1, 2, 3, 4, 5];
    const shuffled = Utils.shuffleArray(original);
    expect(shuffled).toHaveLength(5);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test('ConfigLoader can be instantiated', () => {
    const { ConfigLoader } = require('./brastel-pin-checker');

    expect(() => {
      const configLoader = new ConfigLoader();
      expect(configLoader).toBeDefined();
    }).not.toThrow();
  });

  test('CLI basic parsing works', () => {
    const CLI = require('./cli');
    const cli = new CLI();

    // Test parsing
    const result = cli.parseArgs(['help']);
    expect(result.commands).toEqual(['help']);
    expect(result.options).toEqual({});

    const result2 = cli.parseArgs(['start', '--random']);
    expect(result2.commands).toEqual(['start']);
    expect(result2.options.random).toBe(true);
  });

  test('Configuration files can be created and loaded', () => {
    // Create test config files
    fs.writeFileSync('test-pin.txt', '0\n100');
    fs.writeFileSync('test-access.txt', '12345678\n87654321');
    fs.writeFileSync('test-proxy.txt', '');
    fs.writeFileSync('test-cookie.txt', 'test-cookie-value');

    // Test reading
    const pinContent = fs.readFileSync('test-pin.txt', 'utf8');
    expect(pinContent).toBe('0\n100');

    const accessContent = fs.readFileSync('test-access.txt', 'utf8');
    expect(accessContent).toBe('12345678\n87654321');

    // Clean up
    fs.unlinkSync('test-pin.txt');
    fs.unlinkSync('test-access.txt');
    fs.unlinkSync('test-proxy.txt');
    fs.unlinkSync('test-cookie.txt');
  });

  test('Config loading with current files works', () => {
    const { ConfigLoader } = require('./brastel-pin-checker');
    const configLoader = new ConfigLoader();

    // This should work with existing config files or defaults
    const config = configLoader.loadConfig();

    expect(config).toBeDefined();
    expect(config.pinRange).toBeDefined();
    expect(config.pinRange.start).toBeGreaterThanOrEqual(0);
    expect(config.pinRange.end).toBeGreaterThan(config.pinRange.start);
    expect(config.accessCodes).toBeDefined();
    expect(Array.isArray(config.accessCodes)).toBe(true);
    expect(config.cookies).toBeDefined();
    expect(Array.isArray(config.cookies)).toBe(true);
    expect(config.concurrentWorkers).toBeGreaterThan(0);
  });

});