/**
 * Cycling Functions Tests
 * Tests for getCycleList, handleMRUCycle, handleMRUCycleReverse, commitSelection, cancelCycling
 */

const { setupStorageMock, createMockTab, flushPromises } = require('../helpers');

jest.mock('../../background.js', () => {
  const actual = jest.requireActual('../../background.js');
  return actual;
});

const bg = require('../../background.js');

describe('Cycling Functions', () => {
  beforeEach(() => {
    resetChromeMocks();
    // Reset cycling state
    bg.cyclingState.active = false;
    bg.cyclingState.snapshot = [];
    bg.cyclingState.highlightIndex = 0;
  });

  describe('getCycleList', () => {
    it('should return tabs in MRU order with active tab first', async () => {
      setupStorageMock({ mruByWindow: { '1': [1, 2, 3] } });
      chrome.tabs.query.mockResolvedValue([
        createMockTab(1, { active: true }),
        createMockTab(2),
        createMockTab(3)
      ]);

      const result = await bg.getCycleList(1);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(3);
    });

    it('should clean MRU by removing non-existent tabs', async () => {
      setupStorageMock({ mruByWindow: { '1': [1, 2, 99, 3] } });
      chrome.tabs.query.mockResolvedValue([
        createMockTab(1, { active: true }),
        createMockTab(2),
        createMockTab(3)
      ]);

      const result = await bg.getCycleList(1);

      expect(result).toHaveLength(3);
      expect(result.map(t => t.id)).toEqual([1, 2, 3]);
    });

    it('should return empty array if no active tab', async () => {
      chrome.tabs.query.mockResolvedValue([
        createMockTab(1, { active: false }),
        createMockTab(2, { active: false })
      ]);

      const result = await bg.getCycleList(1);

      expect(result).toEqual([]);
    });

    it('should include tab metadata', async () => {
      setupStorageMock({ mruByWindow: { '1': [1] } });
      chrome.tabs.query.mockResolvedValue([
        createMockTab(1, {
          active: true,
          title: 'Test Tab',
          url: 'https://test.com',
          favIconUrl: 'https://test.com/icon.png'
        })
      ]);

      const result = await bg.getCycleList(1);

      expect(result[0]).toMatchObject({
        id: 1,
        title: 'Test Tab',
        url: 'https://test.com',
        favIconUrl: 'https://test.com/icon.png'
      });
    });

    it('should handle tabs with missing titles', async () => {
      setupStorageMock({ mruByWindow: { '1': [1] } });
      chrome.tabs.query.mockResolvedValue([
        { id: 1, active: true, title: '', url: 'https://test.com', favIconUrl: '' }
      ]);

      const result = await bg.getCycleList(1);

      expect(result[0].title).toBe('Untitled');
    });

    it('should update MRU if active tab is not at front', async () => {
      setupStorageMock({ mruByWindow: { '1': [2, 1, 3] } });
      chrome.tabs.query.mockResolvedValue([
        createMockTab(1, { active: true }),
        createMockTab(2),
        createMockTab(3)
      ]);

      const result = await bg.getCycleList(1);

      // Should have called updateMRU to move active tab to front
      expect(chrome.storage.local.set).toHaveBeenCalled();
      expect(result[0].id).toBe(1);
    });
  });

  describe('commitSelection', () => {
    it('should activate selected tab and reset state', async () => {
      bg.cyclingState.active = true;
      bg.cyclingState.activeTabId = 1;
      bg.cyclingState.snapshot = [
        { id: 1 }, { id: 2 }, { id: 3 }
      ];
      bg.cyclingState.highlightIndex = 1;

      chrome.tabs.get.mockResolvedValue(createMockTab(2));
      chrome.tabs.update.mockResolvedValue({});
      chrome.tabs.sendMessage.mockResolvedValue({});

      await bg.commitSelection();

      expect(chrome.tabs.update).toHaveBeenCalledWith(2, { active: true });
      expect(bg.cyclingState.active).toBe(false);
      expect(bg.cyclingState.snapshot).toEqual([]);
    });

    it('should do nothing if not cycling', async () => {
      bg.cyclingState.active = false;

      await bg.commitSelection();

      expect(chrome.tabs.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelCycling', () => {
    it('should hide overlay and reset state', async () => {
      bg.cyclingState.active = true;
      bg.cyclingState.activeTabId = 1;
      bg.cyclingState.snapshot = [{ id: 1 }];

      chrome.tabs.sendMessage.mockResolvedValue({});

      await bg.cancelCycling();

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'HIDE_OVERLAY'
      });
      expect(bg.cyclingState.active).toBe(false);
    });
  });
});
