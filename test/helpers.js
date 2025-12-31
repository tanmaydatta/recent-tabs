// Create mock tab objects
const createMockTab = (id, options = {}) => ({
  id,
  windowId: options.windowId || 1,
  title: options.title || `Tab ${id}`,
  url: options.url || `https://example.com/tab${id}`,
  active: options.active || false,
  favIconUrl: options.favIconUrl || `https://example.com/favicon${id}.ico`,
  index: options.index || 0
});

// Create mock window objects
const createMockWindow = (id, tabCount = 1) => ({
  id,
  focused: true,
  tabs: Array.from({ length: tabCount }, (_, i) =>
    createMockTab(i + 1, { windowId: id, active: i === 0 })
  )
});

// Setup storage mock with data
const setupStorageMock = (data = {}) => {
  chrome.storage.local.get.mockImplementation((key) => {
    if (typeof key === 'string') {
      return Promise.resolve({ [key]: data[key] });
    }
    return Promise.resolve(data);
  });

  chrome.storage.local.set.mockImplementation(() => Promise.resolve());
};

// Wait for async operations
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

module.exports = {
  createMockTab,
  createMockWindow,
  setupStorageMock,
  flushPromises
};
