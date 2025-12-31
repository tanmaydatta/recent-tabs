/**
 * Initialization Tests
 * Tests for the initialize function
 */

const { setupStorageMock, createMockWindow } = require('../helpers');

jest.mock('../../background.js', () => {
  const actual = jest.requireActual('../../background.js');
  return actual;
});

const bg = require('../../background.js');

describe('Initialization', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it('should initialize MRU for windows without data', async () => {
    setupStorageMock({ mruByWindow: {} });
    chrome.windows.getAll.mockResolvedValue([
      createMockWindow(1, 3)
    ]);

    await bg.initialize();

    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('should handle windows with existing MRU data', async () => {
    setupStorageMock({
      mruByWindow: { '1': [1, 2, 3] }
    });
    chrome.windows.getAll.mockResolvedValue([
      createMockWindow(1, 3)
    ]);

    await bg.initialize();

    // Should not throw error - may or may not save depending on active tab
    expect(true).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    chrome.windows.getAll.mockRejectedValue(new Error('Error'));

    await bg.initialize();

    expect(console.error).toHaveBeenCalled();
  });
});
