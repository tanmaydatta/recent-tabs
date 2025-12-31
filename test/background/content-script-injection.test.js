/**
 * Content Script Injection Tests
 * Tests for ensureContentScriptInjected, showOverlay, hideOverlay, renderOverlay
 */

const { createMockTab } = require('../helpers');

jest.mock('../../background.js', () => {
  const actual = jest.requireActual('../../background.js');
  return actual;
});

const bg = require('../../background.js');

describe('Content Script Injection', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  describe('ensureContentScriptInjected', () => {
    it('should return true if content script already exists', async () => {
      chrome.tabs.sendMessage.mockResolvedValue({ success: true });

      const result = await bg.ensureContentScriptInjected(1);

      expect(result).toBe(true);
      expect(chrome.scripting.insertCSS).not.toHaveBeenCalled();
    });

    it('should inject CSS and JS if content script not present', async () => {
      chrome.tabs.sendMessage.mockRejectedValue(new Error('No receiver'));
      chrome.tabs.get.mockResolvedValue(
        createMockTab(1, { url: 'https://example.com' })
      );
      chrome.scripting.insertCSS.mockResolvedValue({});
      chrome.scripting.executeScript.mockResolvedValue({});

      const result = await bg.ensureContentScriptInjected(1);

      expect(chrome.scripting.insertCSS).toHaveBeenCalled();
      expect(chrome.scripting.executeScript).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false for chrome:// URLs', async () => {
      chrome.tabs.sendMessage.mockRejectedValue(new Error('No receiver'));
      chrome.tabs.get.mockResolvedValue(
        createMockTab(1, { url: 'chrome://settings' })
      );

      const result = await bg.ensureContentScriptInjected(1);

      expect(result).toBe(false);
      expect(chrome.scripting.insertCSS).not.toHaveBeenCalled();
    });

    it('should return false for chrome-extension:// URLs', async () => {
      chrome.tabs.sendMessage.mockRejectedValue(new Error('No receiver'));
      chrome.tabs.get.mockResolvedValue(
        createMockTab(1, { url: 'chrome-extension://abc123' })
      );

      const result = await bg.ensureContentScriptInjected(1);

      expect(result).toBe(false);
    });

    it('should handle injection errors', async () => {
      chrome.tabs.sendMessage.mockRejectedValue(new Error('No receiver'));
      chrome.tabs.get.mockResolvedValue(
        createMockTab(1, { url: 'https://example.com' })
      );
      chrome.scripting.insertCSS.mockRejectedValue(new Error('Injection failed'));

      const result = await bg.ensureContentScriptInjected(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('showOverlay', () => {
    it('should send SHOW_OVERLAY message when injection succeeds', async () => {
      chrome.tabs.sendMessage.mockResolvedValue({});

      const result = await bg.showOverlay(1);

      expect(result).toBe(true);
    });

    it('should return false when injection fails', async () => {
      chrome.tabs.sendMessage
        .mockRejectedValueOnce(new Error('No receiver'))
        .mockRejectedValueOnce(new Error('Injection failed'));
      chrome.tabs.get.mockResolvedValue(
        createMockTab(1, { url: 'chrome://settings' })
      );

      const result = await bg.showOverlay(1);

      expect(result).toBe(false);
    });
  });

  describe('hideOverlay', () => {
    it('should send HIDE_OVERLAY message', async () => {
      chrome.tabs.sendMessage.mockResolvedValue({});

      await bg.hideOverlay(1);

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'HIDE_OVERLAY'
      });
    });

    it('should silently ignore errors', async () => {
      chrome.tabs.sendMessage.mockRejectedValue(new Error('Tab closed'));

      await bg.hideOverlay(1);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('renderOverlay', () => {
    it('should send RENDER_OVERLAY message with tab data', async () => {
      bg.cyclingState.snapshot = [{ id: 1 }, { id: 2 }];
      bg.cyclingState.highlightIndex = 1;
      chrome.tabs.sendMessage.mockResolvedValue({});

      await bg.renderOverlay(1);

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'RENDER_OVERLAY',
        tabs: [{ id: 1 }, { id: 2 }],
        highlightIndex: 1
      });
    });

    it('should handle errors', async () => {
      bg.cyclingState.snapshot = [];
      chrome.tabs.sendMessage.mockRejectedValue(new Error('Error'));

      await bg.renderOverlay(1);

      expect(console.error).toHaveBeenCalled();
    });
  });
});
