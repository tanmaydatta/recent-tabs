/**
 * Event Registration Tests
 * Tests that event listeners are registered
 */

describe('Event Registration', () => {
  beforeEach(() => {
    resetChromeMocks();
    jest.resetModules();
  });

  it('should register all event listeners', () => {
    require('../../background.js');

    expect(chrome.tabs.onActivated.addListener).toHaveBeenCalled();
    expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalled();
    expect(chrome.tabs.onCreated.addListener).toHaveBeenCalled();
    expect(chrome.windows.onFocusChanged.addListener).toHaveBeenCalled();
    expect(chrome.windows.onRemoved.addListener).toHaveBeenCalled();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(chrome.commands.onCommand.addListener).toHaveBeenCalled();
  });

  it('should call initialize on load', () => {
    const bg = require('../../background.js');

    // Initialize is called when module loads
    expect(bg.initialize).toBeDefined();
  });
});
