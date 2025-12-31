/**
 * Handle Cycle Tests
 * Tests for handleMRUCycle and handleMRUCycleReverse
 */

const { setupStorageMock, createMockTab } = require('../helpers');

jest.mock('../../background.js', () => {
  const actual = jest.requireActual('../../background.js');
  return actual;
});

const bg = require('../../background.js');

describe('Handle Cycle Functions', () => {
  beforeEach(() => {
    resetChromeMocks();
    bg.cyclingState.active = false;
    bg.cyclingState.snapshot = [];
    bg.cyclingState.highlightIndex = 0;
  });

  describe('handleMRUCycle', () => {
    it('should start new cycling session', async () => {
      setupStorageMock({ mruByWindow: { '1': [1, 2, 3] } });
      chrome.tabs.query
        .mockResolvedValueOnce([createMockTab(1, { active: true, windowId: 1 })])
        .mockResolvedValueOnce([
          createMockTab(1, { active: true }),
          createMockTab(2),
          createMockTab(3)
        ]);
      chrome.tabs.sendMessage.mockResolvedValue({});

      await bg.handleMRUCycle();

      expect(bg.cyclingState.active).toBe(true);
      expect(bg.cyclingState.highlightIndex).toBe(1);
    });

    it('should advance highlight index on subsequent cycles', async () => {
      bg.cyclingState.active = true;
      bg.cyclingState.windowId = 1;
      bg.cyclingState.activeTabId = 1;
      bg.cyclingState.snapshot = [
        { id: 1, title: 'Tab 1' },
        { id: 2, title: 'Tab 2' },
        { id: 3, title: 'Tab 3' }
      ];
      bg.cyclingState.highlightIndex = 1;

      chrome.tabs.query.mockResolvedValue([
        createMockTab(1, { active: true, windowId: 1 })
      ]);
      chrome.tabs.sendMessage.mockResolvedValue({});

      await bg.handleMRUCycle();

      expect(bg.cyclingState.highlightIndex).toBe(2);
    });

    it('should wrap highlight index to 0', async () => {
      bg.cyclingState.active = true;
      bg.cyclingState.windowId = 1;
      bg.cyclingState.activeTabId = 1;
      bg.cyclingState.snapshot = [
        { id: 1, title: 'Tab 1' },
        { id: 2, title: 'Tab 2' }
      ];
      bg.cyclingState.highlightIndex = 1;

      chrome.tabs.query.mockResolvedValue([
        createMockTab(1, { active: true, windowId: 1 })
      ]);
      chrome.tabs.sendMessage.mockResolvedValue({});

      await bg.handleMRUCycle();

      expect(bg.cyclingState.highlightIndex).toBe(0);
    });

    it('should cancel if overlay cannot be shown', async () => {
      setupStorageMock({ mruByWindow: { '1': [1, 2] } });
      chrome.tabs.query
        .mockResolvedValueOnce([createMockTab(1, { active: true, windowId: 1, url: 'chrome://settings' })])
        .mockResolvedValueOnce([
          createMockTab(1, { active: true, url: 'chrome://settings' }),
          createMockTab(2)
        ]);
      chrome.tabs.sendMessage.mockRejectedValue(new Error('No receiver'));
      chrome.tabs.get.mockResolvedValue(
        createMockTab(1, { url: 'chrome://settings' })
      );

      await bg.handleMRUCycle();

      expect(bg.cyclingState.active).toBe(false);
    });
  });

  describe('handleMRUCycleReverse', () => {
    it('should start at last index', async () => {
      setupStorageMock({ mruByWindow: { '1': [1, 2, 3] } });
      chrome.tabs.query
        .mockResolvedValueOnce([createMockTab(1, { active: true, windowId: 1 })])
        .mockResolvedValueOnce([
          createMockTab(1, { active: true }),
          createMockTab(2),
          createMockTab(3)
        ]);
      chrome.tabs.sendMessage.mockResolvedValue({});

      await bg.handleMRUCycleReverse();

      expect(bg.cyclingState.highlightIndex).toBe(2);
    });

    it('should decrement highlight index', async () => {
      bg.cyclingState.active = true;
      bg.cyclingState.windowId = 1;
      bg.cyclingState.activeTabId = 1;
      bg.cyclingState.snapshot = [
        { id: 1 }, { id: 2 }, { id: 3 }
      ];
      bg.cyclingState.highlightIndex = 2;

      chrome.tabs.query.mockResolvedValue([
        createMockTab(1, { active: true, windowId: 1 })
      ]);
      chrome.tabs.sendMessage.mockResolvedValue({});

      await bg.handleMRUCycleReverse();

      expect(bg.cyclingState.highlightIndex).toBe(1);
    });

    it('should wrap to last index when at 0', async () => {
      bg.cyclingState.active = true;
      bg.cyclingState.windowId = 1;
      bg.cyclingState.activeTabId = 1;
      bg.cyclingState.snapshot = [
        { id: 1 }, { id: 2 }, { id: 3 }
      ];
      bg.cyclingState.highlightIndex = 0;

      chrome.tabs.query.mockResolvedValue([
        createMockTab(1, { active: true, windowId: 1 })
      ]);
      chrome.tabs.sendMessage.mockResolvedValue({});

      await bg.handleMRUCycleReverse();

      expect(bg.cyclingState.highlightIndex).toBe(2);
    });
  });
});
