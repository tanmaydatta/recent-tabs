// MRU tracking state
let mruByWindow = new Map(); // Map<windowId, tabId[]>

// Cycling state
let cyclingState = {
  active: false,
  windowId: null,
  activeTabId: null, // Tab where overlay is shown
  snapshot: [], // Array of { id, title, favIconUrl, url }
  highlightIndex: 0
};

// Storage keys
const STORAGE_KEY = 'mruByWindow';

// Initialize: Load MRU state from storage
async function initialize() {
  try {
    const result = await chrome.storage.session.get(STORAGE_KEY);
    if (result[STORAGE_KEY]) {
      mruByWindow = new Map(Object.entries(result[STORAGE_KEY]));
    }
  } catch (error) {
    console.error('Failed to load MRU state:', error);
  }

  // Initialize MRU for all existing windows
  const windows = await chrome.windows.getAll({ populate: true });
  for (const window of windows) {
    if (!mruByWindow.has(window.id)) {
      mruByWindow.set(window.id, []);
    }
    // Add all tabs to MRU if not already present
    for (const tab of window.tabs) {
      if (tab.active) {
        updateMRU(window.id, tab.id);
      }
    }
  }
  await saveMRU();
}

// Save MRU state to storage
async function saveMRU() {
  try {
    const data = Object.fromEntries(mruByWindow.entries());
    await chrome.storage.session.set({ [STORAGE_KEY]: data });
  } catch (error) {
    console.error('Failed to save MRU state:', error);
  }
}

// Update MRU: Move tab to front
function updateMRU(windowId, tabId) {
  let mru = mruByWindow.get(windowId) || [];
  // Remove tab if it exists
  mru = mru.filter(id => id !== tabId);
  // Add to front
  mru.unshift(tabId);
  mruByWindow.set(windowId, mru);
  saveMRU();
}

// Update MRU: Move tab to second to front
function moveTabToSecond(windowId, tabId) {
  let mru = mruByWindow.get(windowId) || [];

  // Remove tab if it already exists
  mru = mru.filter(id => id !== tabId);

  if (mru.length === 0) {
    // If no other tabs, it becomes the first
    mru.push(tabId);
  } else {
    // Insert at index 1 (second position)
    mru.splice(1, 0, tabId);
  }

  mruByWindow.set(windowId, mru);
  saveMRU();
}


// Remove tab from MRU
function removeFromMRU(tabId) {
  for (const [windowId, mru] of mruByWindow.entries()) {
    const filtered = mru.filter(id => id !== tabId);
    if (filtered.length !== mru.length) {
      mruByWindow.set(windowId, filtered);
    }
  }
  saveMRU();
}

// Get cycle list for a window (includes active tab at index 0)
async function getCycleList(windowId) {
  // Query all tabs in the window
  const tabs = await chrome.tabs.query({ windowId });

  // Find active tab
  const activeTab = tabs.find(tab => tab.active);
  if (!activeTab) {
    return [];
  }

  // Get MRU array for this window
  let mru = mruByWindow.get(windowId) || [];

  // Clean MRU: remove tabs that no longer exist
  const existingTabIds = new Set(tabs.map(t => t.id));
  mru = mru.filter(id => existingTabIds.has(id));

  // Ensure active tab is at the front
  if (mru[0] !== activeTab.id) {
    mru = mru.filter(id => id !== activeTab.id);
    mru.unshift(activeTab.id);
    mruByWindow.set(windowId, mru);
    saveMRU();
  }

  // Build cycle order: INCLUDE active tab (different from previous version)
  const cycleIds = [...mru];

  // Add any tabs not in MRU yet
  for (const tab of tabs) {
    if (!cycleIds.includes(tab.id)) {
      cycleIds.push(tab.id);
    }
  }

  // Build display objects
  const tabsById = new Map(tabs.map(t => [t.id, t]));
  return cycleIds.map(id => {
    const tab = tabsById.get(id);
    return {
      id: tab.id,
      title: tab.title || 'Untitled',
      favIconUrl: tab.favIconUrl || '',
      url: tab.url || ''
    };
  });
}

// Ensure content script is injected in tab
async function ensureContentScriptInjected(tabId) {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true; // Content script already exists
  } catch (error) {
    // Content script not present, inject it
    try {
      // Get tab info to check if we can inject
      const tab = await chrome.tabs.get(tabId);

      // Cannot inject into chrome:// pages or chrome-extension:// pages
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        console.warn('Cannot inject content script into restricted page:', tab.url);
        return false;
      }

      // Inject CSS first
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['overlay.css']
      });

      // Then inject JS
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['overlay.js']
      });

      // Small delay to let content script initialize
      await new Promise(resolve => setTimeout(resolve, 50));

      return true;
    } catch (injectError) {
      console.error('Failed to inject content script:', injectError);
      return false;
    }
  }
}

// Show overlay in active tab
async function showOverlay(tabId) {
  try {
    // Ensure content script is injected
    const injected = await ensureContentScriptInjected(tabId);
    if (!injected) {
      console.warn('Cannot show overlay: content script injection failed');
      return false;
    }

    await chrome.tabs.sendMessage(tabId, { type: 'SHOW_OVERLAY' });
    return true;
  } catch (error) {
    console.error('Failed to show overlay:', error);
    return false;
  }
}

// Hide overlay in active tab
async function hideOverlay(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'HIDE_OVERLAY' });
  } catch (error) {
    // Silently ignore - if content script isn't there, nothing to hide
  }
}

// Render overlay with tabs and highlight index
async function renderOverlay(tabId) {
  try {
    console.log('renderOverlay: sending message to tab', tabId, 'with', cyclingState.snapshot.length, 'tabs');
    await chrome.tabs.sendMessage(tabId, {
      type: 'RENDER_OVERLAY',
      tabs: cyclingState.snapshot,
      highlightIndex: cyclingState.highlightIndex
    });
  } catch (error) {
    console.error('Failed to render overlay:', error, 'tabId:', tabId, 'snapshot length:', cyclingState.snapshot.length);
  }
}

// Commit the selected tab
async function commitSelection() {
  if (!cyclingState.active || cyclingState.snapshot.length === 0) {
    return;
  }

  // Get selected tab
  const selectedTab = cyclingState.snapshot[cyclingState.highlightIndex];

  if (selectedTab) {
    // Validate tab still exists
    try {
      const tab = await chrome.tabs.get(selectedTab.id);
      await chrome.tabs.update(tab.id, { active: true });
    } catch (error) {
      console.error('Failed to activate tab:', error);
    }
  }

  // Hide overlay and clear state
  if (cyclingState.activeTabId) {
    await hideOverlay(cyclingState.activeTabId);
  }

  cyclingState.active = false;
  cyclingState.windowId = null;
  cyclingState.activeTabId = null;
  cyclingState.snapshot = [];
  cyclingState.highlightIndex = 0;
}

// Cancel cycling (called when user presses Escape)
async function cancelCycling() {
  if (cyclingState.activeTabId) {
    await hideOverlay(cyclingState.activeTabId);
  }

  cyclingState.active = false;
  cyclingState.windowId = null;
  cyclingState.activeTabId = null;
  cyclingState.snapshot = [];
  cyclingState.highlightIndex = 0;
}

// Handle MRU cycle command (forward)
async function handleMRUCycle() {
  // Get current window and active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return;
  }

  const windowId = activeTab.windowId;
  const tabId = activeTab.id;

  if (!cyclingState.active || cyclingState.windowId !== windowId) {
    // Start new cycling session
    cyclingState.active = true;
    cyclingState.windowId = windowId;
    cyclingState.activeTabId = tabId;
    cyclingState.snapshot = await getCycleList(windowId);
    // Start at index 1 (second item, which is the "previous" tab)
    // Index 0 is the current tab
    cyclingState.highlightIndex = cyclingState.snapshot.length > 1 ? 1 : 0;

    // Show overlay
    const shown = await showOverlay(tabId);
    if (!shown) {
      // Failed to show overlay (e.g., chrome:// page), cancel cycling
      cyclingState.active = false;
      return;
    }

    // Render tabs immediately
    await renderOverlay(tabId);
  } else {
    // Continue cycling forward
    if (cyclingState.snapshot.length > 0) {
      cyclingState.highlightIndex = (cyclingState.highlightIndex + 1) % cyclingState.snapshot.length;
      await renderOverlay(cyclingState.activeTabId);
    }
  }
}

// Handle MRU cycle reverse command (backward)
async function handleMRUCycleReverse() {
  // Get current window and active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return;
  }

  const windowId = activeTab.windowId;
  const tabId = activeTab.id;

  if (!cyclingState.active || cyclingState.windowId !== windowId) {
    // Start new cycling session (going backward)
    cyclingState.active = true;
    cyclingState.windowId = windowId;
    cyclingState.activeTabId = tabId;
    cyclingState.snapshot = await getCycleList(windowId);
    // Start at last index (going backward from current)
    cyclingState.highlightIndex = cyclingState.snapshot.length > 0 ? cyclingState.snapshot.length - 1 : 0;

    // Show overlay
    const shown = await showOverlay(tabId);
    if (!shown) {
      // Failed to show overlay (e.g., chrome:// page), cancel cycling
      cyclingState.active = false;
      return;
    }

    // Render tabs immediately
    await renderOverlay(tabId);
  } else {
    // Continue cycling backward
    if (cyclingState.snapshot.length > 0) {
      cyclingState.highlightIndex = cyclingState.highlightIndex - 1;
      if (cyclingState.highlightIndex < 0) {
        cyclingState.highlightIndex = cyclingState.snapshot.length - 1;
      }
      await renderOverlay(cyclingState.activeTabId);
    }
  }
}

// Event listeners

// Tab activated
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  // Don't update MRU during cycling
  if (!cyclingState.active) {
    updateMRU(windowId, tabId);
  }
});

// Tab removed
chrome.tabs.onRemoved.addListener((tabId, { windowId, isWindowClosing }) => {
  removeFromMRU(tabId);

  // If cycling and tab was in snapshot, filter it out
  if (cyclingState.active && cyclingState.windowId === windowId) {
    cyclingState.snapshot = cyclingState.snapshot.filter(t => t.id !== tabId);

    // Clamp highlight index
    if (cyclingState.highlightIndex >= cyclingState.snapshot.length) {
      cyclingState.highlightIndex = Math.max(0, cyclingState.snapshot.length - 1);
    }

    // If no tabs left, cancel cycling
    if (cyclingState.snapshot.length === 0) {
      cancelCycling();
    } else {
      renderOverlay(cyclingState.activeTabId);
    }
  }
});

// Tab created
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log("tanmay oncreated tab", tab)
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // add to second if new tab is not the active tab
  if (!cyclingState.active && activeTab && activeTab.id !== tab.id) {
    moveTabToSecond(tab.windowId, tab.id);
  }
});

// Window focus changed
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return;
  }

  // If focus changed away from cycling window, cancel
  if (cyclingState.active && cyclingState.windowId !== windowId) {
    await cancelCycling();
  }

  // Update MRU for focused window's active tab
  try {
    const tabs = await chrome.tabs.query({ windowId, active: true });
    if (tabs.length > 0) {
      updateMRU(windowId, tabs[0].id);
    }
  } catch (error) {
    // Window may be closing
  }
});

// Window removed
chrome.windows.onRemoved.addListener((windowId) => {
  mruByWindow.delete(windowId);
  saveMRU();

  // If cycling window was closed, cancel
  if (cyclingState.active && cyclingState.windowId === windowId) {
    cancelCycling();
  }
});

// Message listener (from content script)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACTIVATE_TAB') {
    // User clicked on a tab in the overlay
    chrome.tabs.update(message.tabId, { active: true }).then(() => {
      commitSelection();
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Failed to activate tab:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  } else if (message.type === 'CANCEL_CYCLING') {
    // User pressed Escape
    cancelCycling().then(() => {
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === 'COMMIT_SELECTION') {
    // User released modifier key
    commitSelection().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Command listener
chrome.commands.onCommand.addListener((command) => {
  if (command === 'mru-cycle') {
    handleMRUCycle();
  } else if (command === 'mru-cycle-reverse') {
    handleMRUCycleReverse();
  }
});

// Initialize on startup
initialize();
