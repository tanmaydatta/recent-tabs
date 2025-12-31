/**
 * Event Listener Callback Tests
 * Tests that capture and invoke actual event listener callbacks
 */

const { setupStorageMock, createMockTab } = require('../helpers');

describe('Event Listener Callbacks', () => {
  let listeners;

  beforeEach(() => {
    resetChromeMocks();
    listeners = {};

    // Capture listeners
    chrome.tabs.onActivated.addListener.mockImplementation((cb) => {
      listeners.onActivated = cb;
    });
    chrome.tabs.onRemoved.addListener.mockImplementation((cb) => {
      listeners.onRemoved = cb;
    });
    chrome.tabs.onCreated.addListener.mockImplementation((cb) => {
      listeners.onCreated = cb;
    });
    chrome.windows.onFocusChanged.addListener.mockImplementation((cb) => {
      listeners.onFocusChanged = cb;
    });
    chrome.windows.onRemoved.addListener.mockImplementation((cb) => {
      listeners.onWindowRemoved = cb;
    });
    chrome.runtime.onMessage.addListener.mockImplementation((cb) => {
      listeners.onMessage = cb;
    });
    chrome.commands.onCommand.addListener.mockImplementation((cb) => {
      listeners.onCommand = cb;
    });

    // Load module to register listeners
    jest.isolateModules(() => {
      require('../../background.js');
    });
  });

  it('should invoke tabs.onActivated listener', async () => {
    setupStorageMock({ mruByWindow: { '1': [1, 2] } });
    chrome.tabs.get.mockResolvedValue(createMockTab(1, { windowId: 1 }));

    if (listeners.onActivated) {
      await listeners.onActivated({ tabId: 1, windowId: 1 });
      expect(chrome.storage.local.set).toHaveBeenCalled();
    }
  });

  it('should invoke tabs.onRemoved listener', async () => {
    setupStorageMock({ mruByWindow: { '1': [1, 2] } });

    if (listeners.onRemoved) {
      await listeners.onRemoved(1, { windowId: 1, isWindowClosing: false });
      expect(chrome.storage.local.set).toHaveBeenCalled();
    }
  });

  it('should invoke tabs.onRemoved with cycling state', async () => {
    setupStorageMock({ mruByWindow: { '1': [1, 2, 3] } });
    chrome.tabs.sendMessage.mockResolvedValue({});

    // Set up cycling state via isolateModules
    jest.isolateModules(() => {
      const bg = require('../../background.js');
      bg.cyclingState.active = true;
      bg.cyclingState.windowId = 1;
      bg.cyclingState.activeTabId = 1;
      bg.cyclingState.snapshot = [{ id: 1 }, { id: 2 }, { id: 3 }];
      bg.cyclingState.highlightIndex = 2;
    });

    if (listeners.onRemoved) {
      await listeners.onRemoved(3, { windowId: 1, isWindowClosing: false });
    }
  });

  it('should invoke tabs.onCreated listener for inactive tab', async () => {
    setupStorageMock({ mruByWindow: { '1': [1, 2] } });
    chrome.tabs.query.mockResolvedValue([createMockTab(1, { active: true, windowId: 1 })]);

    if (listeners.onCreated) {
      const newTab = createMockTab(3, { windowId: 1, active: false });
      await listeners.onCreated(newTab);
      expect(chrome.storage.local.set).toHaveBeenCalled();
    }
  });

  it('should invoke tabs.onCreated for active tab', async () => {
    setupStorageMock({ mruByWindow: { '1': [1, 2] } });
    chrome.tabs.query.mockResolvedValue([createMockTab(3, { active: true, windowId: 1 })]);

    if (listeners.onCreated) {
      const newTab = createMockTab(3, { windowId: 1, active: true });
      await listeners.onCreated(newTab);
    }
  });

  it('should invoke windows.onFocusChanged listener', async () => {
    setupStorageMock({ mruByWindow: { '1': [1] } });
    chrome.tabs.query.mockResolvedValue([createMockTab(1, { active: true })]);

    if (listeners.onFocusChanged) {
      await listeners.onFocusChanged(1);
      expect(chrome.storage.local.set).toHaveBeenCalled();
    }
  });

  it('should invoke windows.onFocusChanged with WINDOW_ID_NONE', async () => {
    if (listeners.onFocusChanged) {
      await listeners.onFocusChanged(chrome.windows.WINDOW_ID_NONE);
      // Should return early
    }
  });

  it('should invoke windows.onFocusChanged with cycling state', async () => {
    setupStorageMock({ mruByWindow: { '1': [1] } });
    chrome.tabs.query.mockResolvedValue([createMockTab(1, { active: true })]);
    chrome.tabs.sendMessage.mockResolvedValue({});

    jest.isolateModules(() => {
      const bg = require('../../background.js');
      bg.cyclingState.active = true;
      bg.cyclingState.windowId = 1;
      bg.cyclingState.activeTabId = 1;
    });

    if (listeners.onFocusChanged) {
      await listeners.onFocusChanged(2);
    }
  });

  it('should invoke windows.onFocusChanged with error', async () => {
    chrome.tabs.query.mockResolvedValue([]);

    if (listeners.onFocusChanged) {
      await listeners.onFocusChanged(1);
      // Should handle gracefully
    }
  });

  it('should invoke windows.onRemoved listener', async () => {
    chrome.tabs.sendMessage.mockResolvedValue({});

    jest.isolateModules(() => {
      const bg = require('../../background.js');
      bg.cyclingState.active = true;
      bg.cyclingState.windowId = 1;
      bg.cyclingState.activeTabId = 1;
    });

    if (listeners.onWindowRemoved) {
      await listeners.onWindowRemoved(1);
    }
  });

  it('should invoke windows.onRemoved for different window', async () => {
    jest.isolateModules(() => {
      const bg = require('../../background.js');
      bg.cyclingState.active = true;
      bg.cyclingState.windowId = 1;
    });

    if (listeners.onWindowRemoved) {
      await listeners.onWindowRemoved(2);
    }
  });

  it('should invoke runtime.onMessage with ACTIVATE_TAB', async () => {
    chrome.tabs.update.mockResolvedValue({});
    chrome.tabs.sendMessage.mockResolvedValue({});
    const sendResponse = jest.fn();

    jest.isolateModules(() => {
      const bg = require('../../background.js');
      bg.cyclingState.active = true;
      bg.cyclingState.activeTabId = 1;
    });

    if (listeners.onMessage) {
      const result = listeners.onMessage(
        { type: 'ACTIVATE_TAB', tabId: 2 },
        {},
        sendResponse
      );
      expect(result).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  });

  it('should invoke runtime.onMessage with ACTIVATE_TAB error', async () => {
    chrome.tabs.update.mockRejectedValue(new Error('Tab not found'));
    const sendResponse = jest.fn();

    if (listeners.onMessage) {
      const result = listeners.onMessage(
        { type: 'ACTIVATE_TAB', tabId: 999 },
        {},
        sendResponse
      );
      expect(result).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  });

  it('should invoke runtime.onMessage with CANCEL_CYCLING', async () => {
    chrome.tabs.sendMessage.mockResolvedValue({});
    const sendResponse = jest.fn();

    jest.isolateModules(() => {
      const bg = require('../../background.js');
      bg.cyclingState.active = true;
      bg.cyclingState.activeTabId = 1;
    });

    if (listeners.onMessage) {
      const result = listeners.onMessage(
        { type: 'CANCEL_CYCLING' },
        {},
        sendResponse
      );
      expect(result).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  });

  it('should invoke runtime.onMessage with COMMIT_SELECTION', async () => {
    chrome.tabs.get.mockResolvedValue(createMockTab(2));
    chrome.tabs.update.mockResolvedValue({});
    chrome.tabs.sendMessage.mockResolvedValue({});
    const sendResponse = jest.fn();

    jest.isolateModules(() => {
      const bg = require('../../background.js');
      bg.cyclingState.active = true;
      bg.cyclingState.activeTabId = 1;
      bg.cyclingState.snapshot = [{ id: 2 }];
      bg.cyclingState.highlightIndex = 0;
    });

    if (listeners.onMessage) {
      const result = listeners.onMessage(
        { type: 'COMMIT_SELECTION' },
        {},
        sendResponse
      );
      expect(result).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  });

  it('should invoke runtime.onMessage with unknown type', async () => {
    const sendResponse = jest.fn();

    if (listeners.onMessage) {
      const result = listeners.onMessage(
        { type: 'UNKNOWN' },
        {},
        sendResponse
      );
      expect(result).toBeUndefined();
    }
  });

  it('should invoke commands.onCommand with mru-cycle', async () => {
    setupStorageMock({ mruByWindow: { '1': [1, 2] } });
    chrome.tabs.query
      .mockResolvedValueOnce([createMockTab(1, { active: true, windowId: 1 })])
      .mockResolvedValueOnce([createMockTab(1, { active: true }), createMockTab(2)]);
    chrome.tabs.sendMessage.mockResolvedValue({});

    if (listeners.onCommand) {
      await listeners.onCommand('mru-cycle');
    }
  });

  it('should invoke commands.onCommand with mru-cycle-reverse', async () => {
    setupStorageMock({ mruByWindow: { '1': [1, 2] } });
    chrome.tabs.query
      .mockResolvedValueOnce([createMockTab(1, { active: true, windowId: 1 })])
      .mockResolvedValueOnce([createMockTab(1, { active: true }), createMockTab(2)]);
    chrome.tabs.sendMessage.mockResolvedValue({});

    if (listeners.onCommand) {
      await listeners.onCommand('mru-cycle-reverse');
    }
  });

  it('should invoke commands.onCommand with unknown command', async () => {
    if (listeners.onCommand) {
      await listeners.onCommand('unknown-command');
      // Should not throw
    }
  });
});
