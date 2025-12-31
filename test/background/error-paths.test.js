/**
 * Error Path Tests
 * Simple tests to execute error handling code paths
 */

const { setupStorageMock, createMockTab } = require('../helpers');

jest.mock('../../background.js', () => {
  const actual = jest.requireActual('../../background.js');
  return actual;
});

const bg = require('../../background.js');

describe('Error Paths', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it('should handle setMRUForWindow storage error', async () => {
    chrome.storage.local.get.mockResolvedValue({ mruByWindow: {} });
    chrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

    await bg.setMRUForWindow(1, [1, 2]);

    expect(console.error).toHaveBeenCalled();
  });

  it('should handle setAllMRU storage error', async () => {
    chrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

    await bg.setAllMRU({ '1': [1] });

    expect(console.error).toHaveBeenCalled();
  });

  it('should handle updateMRU with storage error', async () => {
    chrome.storage.local.get.mockResolvedValue({ mruByWindow: { '1': [1] } });
    chrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

    await bg.updateMRU(1, 1);

    expect(console.error).toHaveBeenCalled();
  });

  it('should handle moveTabToSecond with storage error', async () => {
    chrome.storage.local.get.mockResolvedValue({ mruByWindow: { '1': [1] } });
    chrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

    await bg.moveTabToSecond(1, 2);

    expect(console.error).toHaveBeenCalled();
  });

  it('should handle removeFromMRU with storage error', async () => {
    chrome.storage.local.get.mockResolvedValue({ mruByWindow: { '1': [1, 2] } });
    chrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

    await bg.removeFromMRU(1);

    expect(console.error).toHaveBeenCalled();
  });

  it('should handle commitSelection tab get error', async () => {
    bg.cyclingState.active = true;
    bg.cyclingState.activeTabId = 1;
    bg.cyclingState.snapshot = [{ id: 2 }];
    bg.cyclingState.highlightIndex = 0;

    chrome.tabs.get.mockRejectedValue(new Error('Tab not found'));
    chrome.tabs.sendMessage.mockResolvedValue({});

    await bg.commitSelection();

    expect(console.error).toHaveBeenCalled();
  });

  it('should handle showOverlay with sendMessage error', async () => {
    chrome.tabs.sendMessage
      .mockRejectedValueOnce(new Error('No receiver'))
      .mockRejectedValueOnce(new Error('Still no receiver'));
    chrome.tabs.get.mockResolvedValue(
      createMockTab(1, { url: 'https://example.com' })
    );
    chrome.scripting.insertCSS.mockRejectedValue(new Error('Injection failed'));

    const result = await bg.showOverlay(1);

    expect(result).toBe(false);
  });

  it('should handle renderOverlay with error', async () => {
    bg.cyclingState.snapshot = [{ id: 1 }];
    bg.cyclingState.highlightIndex = 0;
    chrome.tabs.sendMessage.mockRejectedValue(new Error('Tab closed'));

    await bg.renderOverlay(1);

    expect(console.error).toHaveBeenCalled();
  });
});
