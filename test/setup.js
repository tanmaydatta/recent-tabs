// Mock console methods to avoid cluttering test output
global.console.error = jest.fn();
global.console.log = jest.fn();
global.console.warn = jest.fn();

// Mock chrome.storage.local
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  },

  tabs: {
    query: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    sendMessage: jest.fn(),
    onActivated: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() },
    onCreated: { addListener: jest.fn() }
  },

  windows: {
    getAll: jest.fn(),
    get: jest.fn(),
    WINDOW_ID_NONE: -1,
    onFocusChanged: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() }
  },

  scripting: {
    insertCSS: jest.fn(),
    executeScript: jest.fn()
  },

  runtime: {
    onMessage: { addListener: jest.fn() },
    sendMessage: jest.fn()
  },

  commands: {
    onCommand: { addListener: jest.fn() }
  }
};

// Helper to reset all mocks
global.resetChromeMocks = () => {
  jest.clearAllMocks();
  Object.values(global.chrome).forEach(api => {
    if (api && typeof api === 'object') {
      Object.values(api).forEach(method => {
        if (method && method.mockReset) {
          method.mockReset();
        }
      });
    }
  });
};

// Helper to capture event listeners
global.captureEventListeners = () => {
  const listeners = {};

  const captureListener = (name, listenerFn) => {
    listenerFn.mockImplementation((callback) => {
      listeners[name] = callback;
    });
  };

  captureListener('tabs.onActivated', chrome.tabs.onActivated.addListener);
  captureListener('tabs.onRemoved', chrome.tabs.onRemoved.addListener);
  captureListener('tabs.onCreated', chrome.tabs.onCreated.addListener);
  captureListener('windows.onFocusChanged', chrome.windows.onFocusChanged.addListener);
  captureListener('windows.onRemoved', chrome.windows.onRemoved.addListener);
  captureListener('runtime.onMessage', chrome.runtime.onMessage.addListener);
  captureListener('commands.onCommand', chrome.commands.onCommand.addListener);

  return listeners;
};
