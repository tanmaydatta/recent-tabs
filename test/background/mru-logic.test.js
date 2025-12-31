/**
 * MRU Logic Tests
 * Tests for updateMRU, moveTabToSecond, and removeFromMRU functions
 */

const { setupStorageMock, flushPromises } = require('../helpers');

// Mock background.js module
jest.mock('../../background.js', () => {
  const actual = jest.requireActual('../../background.js');
  return actual;
});

const bg = require('../../background.js');

describe('MRU Logic Functions', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  describe('updateMRU', () => {
    it('should move tab to front of MRU list', async () => {
      setupStorageMock({ mruByWindow: { '1': [2, 1, 3] } });

      await bg.updateMRU(1, 2);

      // Should have called set with tab 2 moved to front
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        mruByWindow: { '1': [2, 1, 3] }
      });
    });

    it('should add new tab to front if not in list', async () => {
      setupStorageMock({ mruByWindow: { '1': [1, 2] } });

      await bg.updateMRU(1, 5);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        mruByWindow: { '1': [5, 1, 2] }
      });
    });

    it('should handle empty MRU list', async () => {
      setupStorageMock({ mruByWindow: { '1': [] } });

      await bg.updateMRU(1, 1);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        mruByWindow: { '1': [1] }
      });
    });

    it('should handle storage errors gracefully', async () => {
      chrome.storage.local.get.mockRejectedValue(new Error('Error'));

      await bg.updateMRU(1, 1);

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('moveTabToSecond', () => {
    it('should insert tab at second position', async () => {
      setupStorageMock({ mruByWindow: { '1': [1, 2, 3] } });

      await bg.moveTabToSecond(1, 4);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        mruByWindow: { '1': [1, 4, 2, 3] }
      });
    });

    it('should move existing tab to second position', async () => {
      setupStorageMock({ mruByWindow: { '1': [1, 2, 3, 4] } });

      await bg.moveTabToSecond(1, 4);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        mruByWindow: { '1': [1, 4, 2, 3] }
      });
    });

    it('should handle empty MRU list', async () => {
      setupStorageMock({ mruByWindow: { '1': [] } });

      await bg.moveTabToSecond(1, 1);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        mruByWindow: { '1': [1] }
      });
    });

    it('should make tab second if only one tab exists', async () => {
      setupStorageMock({ mruByWindow: { '1': [1] } });

      await bg.moveTabToSecond(1, 2);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        mruByWindow: { '1': [1, 2] }
      });
    });
  });

  describe('removeFromMRU', () => {
    it('should remove tab from all windows', async () => {
      setupStorageMock({
        mruByWindow: {
          '1': [1, 2, 3],
          '2': [2, 4, 5]
        }
      });

      await bg.removeFromMRU(2);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        mruByWindow: {
          '1': [1, 3],
          '2': [4, 5]
        }
      });
    });

    it('should not modify storage if tab not found', async () => {
      setupStorageMock({ mruByWindow: { '1': [1, 2, 3] } });

      await bg.removeFromMRU(999);

      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      chrome.storage.local.get.mockRejectedValue(new Error('Error'));

      await bg.removeFromMRU(1);

      expect(console.error).toHaveBeenCalled();
    });
  });
});
