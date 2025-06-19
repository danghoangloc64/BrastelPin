// Simple test to verify Jest is working
const fs = require('fs');

test('Basic functionality test', () => {
  expect(1 + 1).toBe(2);
});

test('File operations work', () => {
  const testFile = 'test-temp.txt';
  fs.writeFileSync(testFile, 'test content');
  const content = fs.readFileSync(testFile, 'utf8');
  expect(content).toBe('test content');
  fs.unlinkSync(testFile);
});

test('Config loader can import', () => {
  const { ConfigLoader } = require('../brastel-pin-checker');
  expect(ConfigLoader).toBeDefined();
});

test('CLI can import', () => {
  expect(() => {
    require('../cli');
  }).not.toThrow();
});

test('Utils functions work', () => {
  const { Utils } = require('../brastel-pin-checker');

  // Test formatPin
  expect(Utils.formatPin(1)).toBe('0001');
  expect(Utils.formatPin(123)).toBe('0123');
  expect(Utils.formatPin(1234)).toBe('1234');

  // Test generateRange
  const range = Utils.generateRange(0, 5);
  expect(range).toEqual([0, 1, 2, 3, 4, 5]);

  // Test chunkArray
  const chunks = Utils.chunkArray([1, 2, 3, 4, 5], 2);
  expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
});

test('Config files can be created and read', () => {
  // Test PIN range
  fs.writeFileSync('test-pinrange.txt', '0\n100');
  const pinContent = fs.readFileSync('test-pinrange.txt', 'utf8');
  expect(pinContent).toBe('0\n100');

  // Test access codes
  fs.writeFileSync('test-accesscodes.txt', '12345678\n87654321');
  const accessContent = fs.readFileSync('test-accesscodes.txt', 'utf8');
  expect(accessContent).toBe('12345678\n87654321');

  // Clean up
  fs.unlinkSync('test-pinrange.txt');
  fs.unlinkSync('test-accesscodes.txt');
});

test('ConfigLoader can load basic config', () => {
  // Create basic config files
  fs.writeFileSync('pinrange.txt', '0\n9999');
  fs.writeFileSync('accesscodes.txt', '74974423\n33849108');
  fs.writeFileSync('proxies.txt', '');
  fs.writeFileSync('cookies.txt', 'test-cookie');

  const { ConfigLoader } = require('../brastel-pin-checker');
  const configLoader = new ConfigLoader();
  const config = configLoader.loadConfig();

  expect(config.pinRange.start).toBe(0);
  expect(config.pinRange.end).toBe(9999);
  expect(config.accessCodes.length).toBeGreaterThan(0);
  expect(config.cookies.length).toBeGreaterThan(0);
  expect(config.concurrentWorkers).toBeGreaterThan(0);
});