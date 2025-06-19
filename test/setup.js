const fs = require('fs');

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Clean up test files after each test
afterEach(() => {
  // Clean up any test config files
  const testFiles = [
    'test-pinrange.txt',
    'test-accesscodes.txt',
    'test-proxies.txt',
    'test-cookies.txt'
  ];

  testFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });

  // Clean up test data directories
  const testDirs = [
    'Test-Data',
    'Test-Log'
  ];

  testDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Helper function to create test config files
global.createTestConfigFiles = (config = {}) => {
  const defaultConfig = {
    pinRange: ['0', '9999'],
    accessCodes: ['12345678', '87654321'],
    proxies: [''],
    cookies: ['test-cookie-1', 'test-cookie-2']
  };

  const finalConfig = { ...defaultConfig, ...config };

  fs.writeFileSync('test-pinrange.txt', finalConfig.pinRange.join('\n'));
  fs.writeFileSync('test-accesscodes.txt', finalConfig.accessCodes.join('\n'));
  fs.writeFileSync('test-proxies.txt', finalConfig.proxies.join('\n'));
  fs.writeFileSync('test-cookies.txt', finalConfig.cookies.join('\n'));

  return finalConfig;
};