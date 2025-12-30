// MRU Tab Switcher - Content Script Overlay
(function() {
  'use strict';

  // Guard against double execution
  if (window.__MRU_OVERLAY_LOADED__) {
    console.warn('overlay.js already loaded, skipping double execution');
    return;
  }
  window.__MRU_OVERLAY_LOADED__ = true;

  const OVERLAY_ID = 'mru-tab-switcher-overlay';
  const CARD_ID = 'mru-tab-switcher-card';
  const LIST_ID = 'mru-tab-list';

  let overlayElement = null;
  let currentTabs = [];

  // Create overlay DOM structure
  function createOverlay() {
    if (overlayElement) {
      return overlayElement;
    }

    // Create overlay container
    overlayElement = document.createElement('div');
    overlayElement.id = OVERLAY_ID;

    // Create card
    const card = document.createElement('div');
    card.id = CARD_ID;

    // Create tab list
    const tabList = document.createElement('div');
    tabList.id = LIST_ID;

    card.appendChild(tabList);
    overlayElement.appendChild(card);

    // Add to document
    document.body.appendChild(overlayElement);

    // Add escape key handler
    overlayElement.addEventListener('keydown', handleKeyDown);

    // Add keyup handler for modifier key release
    overlayElement.addEventListener('keyup', handleKeyUp);

    // Add click handler to overlay background
    overlayElement.addEventListener('click', handleOverlayClick);

    return overlayElement;
  }

  // Handle clicks on overlay - dismiss on any click
  function handleOverlayClick(event) {
    // Check if click was on a tab item
    const tabItem = event.target.closest('.mru-tab-item');

    if (tabItem) {
      // Tab item click - let existing handler deal with it
      // It will send ACTIVATE_TAB which calls commitSelection
      return;
    }

    // Any other click - cancel cycling
    event.preventDefault();
    event.stopPropagation();
    chrome.runtime.sendMessage({ type: 'CANCEL_CYCLING' });
  }

  // Show overlay
  function showOverlay() {
    const overlay = createOverlay();
    overlay.style.display = 'flex';

    // Focus overlay to receive keyboard events
    overlay.setAttribute('tabindex', '-1');
    overlay.focus();
  }

  // Hide overlay
  function hideOverlay() {
    if (overlayElement) {
      overlayElement.style.display = 'none';
    }
  }

  // Render tab list
  function renderTabs(tabs, highlightIndex) {
    console.log('renderTabs called with', tabs.length, 'tabs, highlightIndex:', highlightIndex);
    currentTabs = tabs;

    const tabList = document.getElementById(LIST_ID);
    if (!tabList) {
      console.error('Tab list element not found!');
      return;
    }

    // Clear existing content
    tabList.innerHTML = '';

    if (!tabs || tabs.length === 0) {
      tabList.innerHTML = '<div style="padding: 20px; text-align: center; color: rgba(0, 0, 0, 0.5);">No tabs</div>';
      return;
    }

    // Create tab items
    tabs.forEach((tab, index) => {
      const tabItem = document.createElement('div');
      tabItem.className = 'mru-tab-item';
      tabItem.dataset.tabId = tab.id;
      tabItem.dataset.tabIndex = index;

      if (index === highlightIndex) {
        tabItem.classList.add('mru-selected');
      }

      // Favicon
      const favicon = document.createElement('img');
      favicon.className = 'mru-tab-favicon';

      if (tab.favIconUrl && tab.favIconUrl.startsWith('http')) {
        favicon.src = tab.favIconUrl;
        favicon.onerror = () => {
          favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ccc"/></svg>';
        };
      } else {
        favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ccc"/></svg>';
      }

      // Tab info container
      const tabInfo = document.createElement('div');
      tabInfo.className = 'mru-tab-info';

      // Title
      const title = document.createElement('div');
      title.className = 'mru-tab-title';
      title.textContent = tab.title || 'Untitled';

      // URL
      const url = document.createElement('div');
      url.className = 'mru-tab-url';
      try {
        const urlObj = new URL(tab.url);
        url.textContent = urlObj.hostname;
      } catch (e) {
        url.textContent = tab.url || '';
      }

      tabInfo.appendChild(title);
      tabInfo.appendChild(url);

      tabItem.appendChild(favicon);
      tabItem.appendChild(tabInfo);

      // Click handler
      tabItem.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          type: 'ACTIVATE_TAB',
          tabId: tab.id
        });
      });

      tabList.appendChild(tabItem);
    });

    // Scroll selected item into view
    const selectedItem = tabList.querySelector('.mru-selected');
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // Handle keyboard events
  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      chrome.runtime.sendMessage({ type: 'CANCEL_CYCLING' });
    }
  }

  // Handle key release events - dismiss on modifier key release
  function handleKeyUp(event) {
    if (event.key === 'Meta' || event.key === 'Control') {
      event.preventDefault();
      event.stopPropagation();
      chrome.runtime.sendMessage({ type: 'COMMIT_SELECTION' });
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PING') {
      // Respond to ping - confirms content script is loaded
      sendResponse({ success: true });
    } else if (message.type === 'SHOW_OVERLAY') {
      showOverlay();
      sendResponse({ success: true });
    } else if (message.type === 'HIDE_OVERLAY') {
      hideOverlay();
      sendResponse({ success: true });
    } else if (message.type === 'RENDER_OVERLAY') {
      renderTabs(message.tabs, message.highlightIndex);
      sendResponse({ success: true });
    }
    return true; // Keep message channel open for async response
  });

  // Add document-level keyup listener to catch modifier release even when overlay isn't focused
  function handleDocumentKeyUp(event) {
    if (overlayElement && overlayElement.style.display === 'flex') {
      if (event.key === 'Meta' || event.key === 'Control') {
        event.preventDefault();
        event.stopPropagation();
        chrome.runtime.sendMessage({ type: 'COMMIT_SELECTION' });
      }
    }
  }

  document.addEventListener('keyup', handleDocumentKeyUp);

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    document.removeEventListener('keyup', handleDocumentKeyUp);
    if (overlayElement && overlayElement.parentNode) {
      overlayElement.parentNode.removeChild(overlayElement);
    }
  });
})();
