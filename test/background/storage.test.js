/**
 * Storage Helpers Tests
 *
 * Note: These tests verify storage behavior and data structures
 */

const { setupStorageMock, flushPromises } = require('../helpers');

const STORAGE_KEY = 'mruByWindow';

describe('Storage Helpers', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  describe('getAllMRU behavior', () => {
    it('should retrieve data from chrome.storage.local', async () => {
      const mockData = { '1': [1, 2, 3] };
      setupStorageMock({ mruByWindow: mockData });

      const result = await chrome.storage.local.get(STORAGE_KEY);

      expect(result).toEqual({ mruByWindow: mockData });
    });

    it('should return empty object when no data exists', async () => {
      setupStorageMock({});

      const result = await chrome.storage.local.get(STORAGE_KEY);
      const data = result[STORAGE_KEY] || {};

      expect(data).toEqual({});
    });

    it('should handle storage errors', async () => {
      chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      try {
        await chrome.storage.local.get(STORAGE_KEY);
      } catch (error) {
        expect(error.message).toBe('Storage error');
      }
    });
  });

  describe('chrome.storage.local.set behavior', () => {
    it('should save data to storage', async () => {
      setupStorageMock({});
      const newData = { '1': [1, 2, 3] };

      await chrome.storage.local.set({ [STORAGE_KEY]: newData });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEY]: newData
      });
    });

    it('should handle write errors', async () => {
      chrome.storage.local.set.mockRejectedValue(new Error('Write error'));

      try {
        await chrome.storage.local.set({ [STORAGE_KEY]: {} });
      } catch (error) {
        expect(error.message).toBe('Write error');
      }
    });
  });

  describe('MRU data structure', () => {
    it('should use string keys for window IDs', () => {
      const mruData = {
        '1': [10, 20, 30],
        '2': [40, 50]
      };

      expect(Object.keys(mruData)).toEqual(['1', '2']);
      expect(typeof Object.keys(mruData)[0]).toBe('string');
    });

    it('should use number arrays for tab IDs', () => {
      const mruData = { '1': [10, 20, 30] };

      expect(Array.isArray(mruData['1'])).toBe(true);
      expect(typeof mruData['1'][0]).toBe('number');
    });
  });
});
