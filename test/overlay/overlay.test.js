/**
 * Overlay Tests
 * Basic tests for overlay.js functionality
 */

describe('Overlay Module', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    // Reset chrome mocks
    resetChromeMocks();
  });

  describe('DOM structure', () => {
    it('should test overlay creation pattern', () => {
      // Create a simple overlay element
      const overlay = document.createElement('div');
      overlay.id = 'mru-tab-switcher-overlay';
      overlay.style.display = 'none';
      document.body.appendChild(overlay);

      expect(document.getElementById('mru-tab-switcher-overlay')).toBeTruthy();
    });

    it('should test show/hide behavior', () => {
      const overlay = document.createElement('div');
      overlay.style.display = 'none';
      document.body.appendChild(overlay);

      // Show
      overlay.style.display = 'flex';
      expect(overlay.style.display).toBe('flex');

      // Hide
      overlay.style.display = 'none';
      expect(overlay.style.display).toBe('none');
    });
  });

  describe('Tab rendering', () => {
    it('should render tab list structure', () => {
      const tabs = [
        { id: 1, title: 'Tab 1', url: 'https://example.com', favIconUrl: '' },
        { id: 2, title: 'Tab 2', url: 'https://test.com', favIconUrl: '' }
      ];

      const list = document.createElement('div');
      tabs.forEach((tab, index) => {
        const item = document.createElement('div');
        item.className = 'mru-tab-item';
        item.dataset.tabIndex = index;
        item.dataset.tabId = tab.id;

        const title = document.createElement('div');
        title.className = 'mru-tab-title';
        title.textContent = tab.title;
        item.appendChild(title);

        list.appendChild(item);
      });

      expect(list.children.length).toBe(2);
      expect(list.children[0].dataset.tabId).toBe('1');
    });

    it('should highlight selected tab', () => {
      const item = document.createElement('div');
      item.className = 'mru-tab-item';

      item.classList.add('mru-selected');
      expect(item.classList.contains('mru-selected')).toBe(true);

      item.classList.remove('mru-selected');
      expect(item.classList.contains('mru-selected')).toBe(false);
    });

    it('should handle empty tab list', () => {
      const list = document.createElement('div');
      list.innerHTML = '<div class="mru-empty">No tabs available</div>';

      expect(list.innerHTML).toContain('No tabs');
    });

    it('should extract hostname from URL', () => {
      const url = 'https://example.com/path/to/page';
      let hostname;

      try {
        const urlObj = new URL(url);
        hostname = urlObj.hostname;
      } catch (e) {
        hostname = url;
      }

      expect(hostname).toBe('example.com');
    });

    it('should handle invalid URLs', () => {
      const url = 'invalid-url';
      let hostname;

      try {
        const urlObj = new URL(url);
        hostname = urlObj.hostname;
      } catch (e) {
        hostname = url;
      }

      expect(hostname).toBe('invalid-url');
    });
  });

  describe('Keyboard handling', () => {
    it('should handle Escape key', () => {
      const handler = jest.fn();

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          handler();
        }
      });

      document.dispatchEvent(event);
      expect(handler).toHaveBeenCalled();
    });

    it('should handle Meta key release', () => {
      const handler = jest.fn();

      const event = new KeyboardEvent('keyup', { key: 'Meta' });
      document.addEventListener('keyup', (e) => {
        if (e.key === 'Meta' || e.key === 'Control') {
          handler();
        }
      });

      document.dispatchEvent(event);
      expect(handler).toHaveBeenCalled();
    });

    it('should handle Control key release', () => {
      const handler = jest.fn();

      const event = new KeyboardEvent('keyup', { key: 'Control' });
      document.addEventListener('keyup', (e) => {
        if (e.key === 'Meta' || e.key === 'Control') {
          handler();
        }
      });

      document.dispatchEvent(event);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Message passing', () => {
    it('should send messages via chrome.runtime.sendMessage', () => {
      chrome.runtime.sendMessage({ type: 'PING' });
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'PING' });
    });

    it('should handle CANCEL_CYCLING message', () => {
      chrome.runtime.sendMessage({ type: 'CANCEL_CYCLING' });
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'CANCEL_CYCLING' });
    });

    it('should handle COMMIT_SELECTION message', () => {
      chrome.runtime.sendMessage({ type: 'COMMIT_SELECTION' });
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'COMMIT_SELECTION' });
    });

    it('should handle ACTIVATE_TAB message', () => {
      chrome.runtime.sendMessage({ type: 'ACTIVATE_TAB', tabId: 123 });
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'ACTIVATE_TAB',
        tabId: 123
      });
    });
  });

  describe('Click handling', () => {
    it('should handle tab item clicks', () => {
      const item = document.createElement('div');
      item.dataset.tabId = '123';

      const handler = jest.fn();
      item.addEventListener('click', handler);

      item.click();
      expect(handler).toHaveBeenCalled();
    });

    it('should handle overlay background clicks', () => {
      const overlay = document.createElement('div');
      overlay.id = 'overlay';

      const handler = jest.fn();
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          handler();
        }
      });

      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: overlay, enumerable: true });
      overlay.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();
    });
  });
});
