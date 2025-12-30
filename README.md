# MRU Tab Switcher

A Chrome extension that provides Cmd+Tab-like (Most Recently Used) tab switching with a visual popup overlay.

<img width="1897" height="1011" alt="image" src="https://github.com/user-attachments/assets/f38d420d-feae-496c-8945-f001804f9164" />

## Features

- **MRU Order**: Switch between tabs in the order you actually used them
- **Visual Popup**: Alt-Tab style overlay showing available tabs
- **Keyboard Driven**: Quick cycling through tabs with keyboard shortcuts
- **Per-Window Tracking**: Maintains separate MRU order for each Chrome window

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `recent-tabs` folder

## Usage

### Default Shortcut

- **Windows/Linux**: `Ctrl+Shift+Y`
- **Mac**: `Command+Shift+Y`

### Behavior

1. Press the shortcut once to switch to your previously used tab
2. Keep pressing to cycle through older tabs in MRU order
3. Release to commit the selection (activate the highlighted tab)
4. The popup automatically closes after ~800ms of inactivity

### Customizing the Shortcut

**Important**: Chrome reserves certain keyboard shortcuts (like `Ctrl+Tab`) and may not allow extensions to use them. To customize your shortcut:

1. Open `chrome://extensions/shortcuts`
2. Find "MRU Tab Switcher"
3. Click the pencil icon next to "Cycle through tabs in MRU order"
4. Set your preferred shortcut

**Note**: If Chrome blocks your desired shortcut, try a different key combination. Extensions cannot override most built-in Chrome shortcuts.

## How It Works

The extension tracks tab usage across all your Chrome windows and maintains a Most Recently Used (MRU) order. When you trigger the shortcut:

1. A centered popup appears showing tabs in MRU order
2. Each press cycles the highlight to the next tab
3. After you stop pressing, the highlighted tab becomes active
4. The popup closes automatically

## Technical Details

- Built with Chrome Extension Manifest V3
- Uses `chrome.storage.session` for MRU state persistence
- Service worker tracks tab activation, removal, and window focus events
- Snapshot-based cycling prevents MRU reordering during active switching

## Files

- `manifest.json` - Extension configuration
- `background.js` - Service worker with MRU tracking and command handling
- `switcher.html` - Popup UI structure
- `switcher.js` - Popup UI logic
- `switcher.css` - Alt-Tab style popup styling

## Troubleshooting

**Popup doesn't appear**: Check that you've configured a keyboard shortcut at `chrome://extensions/shortcuts`

**Shortcut doesn't work**: Chrome may be blocking that key combination. Try a different shortcut in the shortcuts settings.

**Tabs appear in wrong order**: The extension tracks tabs as you activate them. The order reflects your actual usage pattern.

## License

MIT License - Feel free to modify and distribute
