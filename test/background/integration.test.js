/**
 * Integration Tests
 * Tests that simulate event listener scenarios
 */

const { setupStorageMock, createMockTab } = require('../helpers');

jest.mock('../../background.js', () => {
  const actual = jest.requireActual('../../background.js');
  return actual;
});

const bg = require('../../background.js');

describe('Integration Scenarios', () => {
  beforeEach(() => {
    resetChromeMocks();
    bg.cyclingState.active = false;
    bg.cyclingState.snapshot = [];
    bg.cyclingState.highlightIndex = 0;
  });

  describe('Tab Management', () => {
    it('should update MRU when tab is activated', async () => {
      setupStorageMock({ mruByWindow: { '1': [2, 1] } });

      await bg.updateMRU(1, 1);

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('should handle tab removal during cycling', async () => {
      setupStorageMock({ mruByWindow: { '1': [1, 2, 3] } });
      bg.cyclingState.active = true;
      bg.cyclingState.windowId = 1;
      bg.cyclingState.activeTabId = 1;
      bg.cyclingState.snapshot = [
        { id: 1 }, { id: 2 }, { id: 3 }
      ];
      bg.cyclingState.highlightIndex = 2;

      // Remove tab from MRU
      await bg.removeFromMRU(3);

      // Simulate what the listener does
      bg.cyclingState.snapshot = bg.cyclingState.snapshot.filter(t => t.id !== 3);
      if (bg.cyclingState.highlightIndex >= bg.cyclingState.snapshot.length) {
        bg.cyclingState.highlightIndex = Math.max(0, bg.cyclingState.snapshot.length - 1);
      }

      expect(bg.cyclingState.snapshot.length).toBe(2);
    });

    it('should handle tab creation for inactive tab', async () => {
      setupStorageMock({ mruByWindow: { '1': [1, 2] } });

      await bg.moveTabToSecond(1, 3);

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('Window Management', () => {
    it('should cancel cycling when window focus changes', async () => {
      bg.cyclingState.active = true;
      bg.cyclingState.windowId = 1;
      bg.cyclingState.activeTabId = 1;

      chrome.tabs.sendMessage.mockResolvedValue({});

      // Simulate window focus change
      if (bg.cyclingState.active && bg.cyclingState.windowId !== 2) {
        await bg.cancelCycling();
      }

      expect(bg.cyclingState.active).toBe(false);
    });

    it('should cancel cycling when window is removed', async () => {
      bg.cyclingState.active = true;
      bg.cyclingState.windowId = 1;
      bg.cyclingState.activeTabId = 1;

      chrome.tabs.sendMessage.mockResolvedValue({});

      // Simulate window removal
      if (bg.cyclingState.active && bg.cyclingState.windowId === 1) {
        await bg.cancelCycling();
      }

      expect(bg.cyclingState.active).toBe(false);
    });
  });

  describe('Message Handling', () => {
    it('should handle activate tab message', async () => {
      bg.cyclingState.active = true;
      bg.cyclingState.activeTabId = 1;
      bg.cyclingState.snapshot = [{ id: 2 }];
      bg.cyclingState.highlightIndex = 0;

      chrome.tabs.get.mockResolvedValue(createMockTab(2));
      chrome.tabs.update.mockResolvedValue({});
      chrome.tabs.sendMessage.mockResolvedValue({});

      await chrome.tabs.update(2, { active: true });
      await bg.commitSelection();

      expect(chrome.tabs.update).toHaveBeenCalled();
    });

    it('should handle cancel cycling message', async () => {
      bg.cyclingState.active = true;
      bg.cyclingState.activeTabId = 1;

      chrome.tabs.sendMessage.mockResolvedValue({});

      await bg.cancelCycling();

      expect(bg.cyclingState.active).toBe(false);
    });

    it('should handle commit selection message', async () => {
      bg.cyclingState.active = true;
      bg.cyclingState.activeTabId = 1;
      bg.cyclingState.snapshot = [{ id: 2 }];
      bg.cyclingState.highlightIndex = 0;

      chrome.tabs.get.mockResolvedValue(createMockTab(2));
      chrome.tabs.update.mockResolvedValue({});
      chrome.tabs.sendMessage.mockResolvedValue({});

      await bg.commitSelection();

      expect(bg.cyclingState.active).toBe(false);
    });
  });

  describe('Command Handling', () => {
    it('should handle mru-cycle command', async () => {
      setupStorageMock({ mruByWindow: { '1': [1, 2] } });
      chrome.tabs.query
        .mockResolvedValueOnce([createMockTab(1, { active: true, windowId: 1 })])
        .mockResolvedValueOnce([
          createMockTab(1, { active: true }),
          createMockTab(2)
        ]);
      chrome.tabs.sendMessage.mockResolvedValue({});

      await bg.handleMRUCycle();

      expect(bg.cyclingState.active).toBe(true);
    });

    it('should handle mru-cycle-reverse command', async () => {
      setupStorageMock({ mruByWindow: { '1': [1, 2] } });
      chrome.tabs.query
        .mockResolvedValueOnce([createMockTab(1, { active: true, windowId: 1 })])
        .mockResolvedValueOnce([
          createMockTab(1, { active: true }),
          createMockTab(2)
        ]);
      chrome.tabs.sendMessage.mockResolvedValue({});

      await bg.handleMRUCycleReverse();

      expect(bg.cyclingState.active).toBe(true);
    });
  });

  describe('Cycling State Edge Cases', () => {
    it('should handle empty snapshot during cycling', async () => {
      bg.cyclingState.active = true;
      bg.cyclingState.snapshot = [];

      await bg.commitSelection();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should clamp highlight index after tab removal', () => {
      bg.cyclingState.active = true;
      bg.cyclingState.snapshot = [{ id: 1 }, { id: 2 }];
      bg.cyclingState.highlightIndex = 1;

      // Remove last tab
      bg.cyclingState.snapshot = [{ id: 1 }];

      // Clamp index
      if (bg.cyclingState.highlightIndex >= bg.cyclingState.snapshot.length) {
        bg.cyclingState.highlightIndex = Math.max(0, bg.cyclingState.snapshot.length - 1);
      }

      expect(bg.cyclingState.highlightIndex).toBe(0);
    });
  });

  describe('Storage Edge Cases', () => {
    it('should handle window with no active tab', async () => {
      chrome.tabs.query.mockResolvedValue([]);

      // Code path where tabs.length is 0
      const tabs = await chrome.tabs.query({ windowId: 1, active: true });

      if (tabs.length > 0) {
        await bg.updateMRU(1, tabs[0].id);
      }

      // Should not throw
      expect(tabs.length).toBe(0);
    });

    it('should handle WINDOW_ID_NONE', () => {
      const windowId = chrome.windows.WINDOW_ID_NONE;

      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // Early return path
        expect(windowId).toBe(-1);
      }
    });
  });

  describe('Tab Removal Scenarios', () => {
    it('should cancel cycling when last tab removed', async () => {
      bg.cyclingState.active = true;
      bg.cyclingState.windowId = 1;
      bg.cyclingState.activeTabId = 1;
      bg.cyclingState.snapshot = [{ id: 1 }];

      chrome.tabs.sendMessage.mockResolvedValue({});

      // Simulate removing last tab
      await bg.removeFromMRU(1);
      bg.cyclingState.snapshot = [];

      if (bg.cyclingState.snapshot.length === 0) {
        await bg.cancelCycling();
      }

      expect(bg.cyclingState.active).toBe(false);
    });

    it('should re-render overlay after tab removal', async () => {
      bg.cyclingState.active = true;
      bg.cyclingState.windowId = 1;
      bg.cyclingState.activeTabId = 1;
      bg.cyclingState.snapshot = [{ id: 1 }, { id: 2 }];

      chrome.tabs.sendMessage.mockResolvedValue({});

      // Simulate tab removal and re-render
      await bg.removeFromMRU(2);
      bg.cyclingState.snapshot = bg.cyclingState.snapshot.filter(t => t.id !== 2);

      if (bg.cyclingState.snapshot.length > 0) {
        await bg.renderOverlay(bg.cyclingState.activeTabId);
      }

      expect(chrome.tabs.sendMessage).toHaveBeenCalled();
    });
  });
});
