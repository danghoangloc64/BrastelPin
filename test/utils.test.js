const fs = require('fs');

// Mock the brastel-pin-checker module first
jest.mock('fs');

describe('Utils', () => {
  let Utils;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock successful file operations
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockReturnValue(undefined);
    fs.readFileSync.mockReturnValue('0\n9999\n12345678\n87654321');

    // Import Utils after mocking
    const { Utils: UtilsClass } = require('../brastel-pin-checker');
    Utils = UtilsClass;
  });

  describe('formatPin', () => {
    test('should format single digit PIN with leading zeros', () => {
      expect(Utils.formatPin(1)).toBe('0001');
    });

    test('should format two digit PIN with leading zeros', () => {
      expect(Utils.formatPin(12)).toBe('0012');
    });

    test('should format three digit PIN with leading zero', () => {
      expect(Utils.formatPin(123)).toBe('0123');
    });

    test('should format four digit PIN without change', () => {
      expect(Utils.formatPin(1234)).toBe('1234');
    });

    test('should handle string input', () => {
      expect(Utils.formatPin('56')).toBe('0056');
    });
  });

  describe('generateRange', () => {
    test('should generate range from 0 to 5', () => {
      const result = Utils.generateRange(0, 5);
      expect(result).toEqual([0, 1, 2, 3, 4, 5]);
    });

    test('should generate range from 5 to 8', () => {
      const result = Utils.generateRange(5, 8);
      expect(result).toEqual([5, 6, 7, 8]);
    });

    test('should generate single item range', () => {
      const result = Utils.generateRange(3, 3);
      expect(result).toEqual([3]);
    });

    test('should generate empty array for invalid range', () => {
      const result = Utils.generateRange(5, 2);
      expect(result).toEqual([]);
    });
  });

  describe('chunkArray', () => {
    test('should split array into chunks of specified size', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const result = Utils.chunkArray(array, 3);
      expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    });

    test('should handle array not evenly divisible by chunk size', () => {
      const array = [1, 2, 3, 4, 5];
      const result = Utils.chunkArray(array, 2);
      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    test('should handle chunk size larger than array', () => {
      const array = [1, 2, 3];
      const result = Utils.chunkArray(array, 5);
      expect(result).toEqual([[1, 2, 3]]);
    });

    test('should handle empty array', () => {
      const result = Utils.chunkArray([], 3);
      expect(result).toEqual([]);
    });
  });

  describe('shuffleArray', () => {
    test('should return array with same length', () => {
      const array = [1, 2, 3, 4, 5];
      const result = Utils.shuffleArray(array);
      expect(result).toHaveLength(5);
    });

    test('should contain all original elements', () => {
      const array = [1, 2, 3, 4, 5];
      const result = Utils.shuffleArray(array);
      expect(result.sort()).toEqual(array.sort());
    });

    test('should not modify original array', () => {
      const array = [1, 2, 3, 4, 5];
      const original = [...array];
      Utils.shuffleArray(array);
      expect(array).toEqual(original);
    });

    test('should handle empty array', () => {
      const result = Utils.shuffleArray([]);
      expect(result).toEqual([]);
    });
  });

  describe('ensureDirectoryExists', () => {
    test('should create directory if it does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = Utils.ensureDirectoryExists('test-dir');

      expect(fs.existsSync).toHaveBeenCalledWith('test-dir');
      expect(fs.mkdirSync).toHaveBeenCalledWith('test-dir', { recursive: true });
      expect(result).toBe(true);
    });

    test('should not create directory if it exists', () => {
      fs.existsSync.mockReturnValue(true);

      const result = Utils.ensureDirectoryExists('existing-dir');

      expect(fs.existsSync).toHaveBeenCalledWith('existing-dir');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('delay', () => {
    test('should return a promise that resolves after specified time', async () => {
      const start = Date.now();
      await Utils.delay(100);
      const end = Date.now();

      // Allow some tolerance for timing
      expect(end - start).toBeGreaterThanOrEqual(90);
      expect(end - start).toBeLessThan(150);
    });

    test('should handle zero delay', async () => {
      const start = Date.now();
      await Utils.delay(0);
      const end = Date.now();

      expect(end - start).toBeLessThan(10);
    });
  });
});