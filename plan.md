## MRU Tab Switcher for Chrome (Cmd+Tab for tabs)

### What this is about

Chrome’s built-in **Ctrl+Tab / Ctrl+Shift+Tab** switches tabs in *tab-strip order* (left-to-right). You want a **Cmd+Tab-like** experience: pressing a shortcut repeatedly cycles through tabs in **Most Recently Used (MRU)** order — the same mental model as switching apps/windows on macOS.

This extension will:

* Track the order you *actually used* tabs (MRU).
* Let you cycle through tabs in that MRU order via a keyboard shortcut.
* Show a small **Alt-Tab style popup** listing tabs in the exact order they’ll be accessed, with a highlight that moves as you cycle.
* Activate the highlighted tab when you stop pressing the shortcut (or after a short timeout), then close the popup.

---

## Important note about shortcuts (Chrome limitation)

Extensions **cannot reliably override Chrome’s reserved shortcuts** like **Ctrl+Tab** on most systems. So the extension will provide its own command shortcut (e.g. `Ctrl+Shift+Y` by default), and you (the user) can customize it here:

* `chrome://extensions/shortcuts`

### Shortcut UX you’ll implement

* One command: **MRU Cycle** (like Cmd+Tab)
* Optional second command later: **MRU Cycle Reverse**
* User configures the actual key combo in Chrome’s shortcuts page.

Even if you *want* Ctrl+Tab, Chrome may block it — but your extension will still work perfectly with an allowed binding.

---

## Product behavior (what “done” looks like)

### MRU switching

* Press shortcut once → switches focus to your **previously used tab**.
* Keep pressing quickly → cycles through older tabs in MRU order.
* Stop pressing → commits the highlighted selection (activates that tab).

### Popup overlay

* Appears centered over the current Chrome window.
* Shows tab title + favicon.
* Shows tabs in the exact order they will be activated.
* Highlights the currently selected target.

---

## High-level architecture

You will build 3 parts:

1. **Service worker (background.js)**

   * Maintains MRU lists per window
   * Handles keyboard commands
   * Opens/closes popup window
   * Sends data to popup
   * Commits final selection (activates tab)

2. **Popup UI (switcher.html / switcher.js / switcher.css)**

   * Renders the MRU order list
   * Highlights the selected item
   * Receives updates from the service worker

3. **Manifest (manifest.json)**

   * Declares permissions + commands + service worker

---

## Step-by-step implementation plan

### Step 1 — Create the project structure

Create a folder, e.g. `mru-tab-switcher/`:

```
mru-tab-switcher/
  manifest.json
  background.js
  switcher.html
  switcher.js
  switcher.css
  icons/ (optional)
```

Milestone: folder exists and is ready to load as an unpacked extension.

---

### Step 2 — Write `manifest.json` (MV3 + commands)

Your manifest must include:

* `manifest_version: 3`
* service worker background
* permissions: `tabs`, `storage`
* a command for MRU cycling

Key items to include:

* **commands**: defines the shortcut action
* a default shortcut (not Ctrl+Tab; pick something likely allowed)
* the command name you’ll handle in background

Milestone: extension loads in `chrome://extensions` in Developer Mode.

---

### Step 3 — Implement MRU tracking in `background.js`

You need to maintain MRU order **per window**, because tab usage is typically window-scoped.

#### Data model

* `mruByWindow: Map<windowId, tabId[]>` (most recent first)
* Persist state in `chrome.storage.session` (best for MV3)

#### Update MRU on these events

1. `chrome.tabs.onActivated`

* When tab becomes active:

  * remove it from the list if it exists
  * unshift it to the front

2. `chrome.tabs.onRemoved`

* Remove closed tab from the MRU list

3. `chrome.windows.onFocusChanged`

* When a window gains focus:

  * query its active tab
  * treat it as activation (move it to front)

Milestone: you can see MRU lists updating correctly in service worker logs.

---

### Step 4 — Compute the “cycle order” list (what you show + what you cycle through)

MRU list includes the current active tab at the front — but when cycling, you want the *next* one to be “previous tab”.

Create a function:

#### `getCycleList(windowId)`

1. Query all tabs in the window: `chrome.tabs.query({ windowId })`
2. Find active tab
3. Load MRU array for windowId
4. Clean MRU (remove tabIds that no longer exist)
5. Ensure active tab is at the front (if not, insert it)
6. Build cycle order by excluding the active tab:

   * `cycleIds = mru.filter(id => id !== activeTab.id)`
7. Handle “tabs not seen yet” edge case:

   * append any tab IDs not present in `cycleIds` (excluding active)

Return a list of display objects in this order:

* `[{ id, title, favIconUrl, url }, ...]`

Milestone: calling this function returns the exact order you expect.

---

### Step 5 — Build the switcher UI files

#### switcher.html

* A container div for the list
* Loads `switcher.css` and `switcher.js`

#### switcher.css

* Style like Alt-Tab:

  * fixed size card
  * rounded corners, shadow
  * rows with icon + title
  * `.selected` class for highlighted row

#### switcher.js

* Listens for messages from background:

  * `chrome.runtime.onMessage.addListener((msg) => ...)`
* Handles message like:

  * `{ type: "RENDER", tabs, highlightIndex }`
* Renders rows in given order
* Applies `.selected` to highlightIndex

Milestone: UI renders a list (even with temporary hardcoded data at first).

---

### Step 6 — Open and center the popup window from background

Create a function in background:

#### `openOrFocusSwitcher(windowId)`

* If popup already exists, focus it
* Else create it via:

  * `chrome.windows.create({ url: chrome.runtime.getURL("switcher.html"), type: "popup", focused: true, width, height, left, top })`

To center it:

1. `win = await chrome.windows.get(windowId)`
2. Compute:

   * `left = win.left + (win.width - popupWidth)/2`
   * `top = win.top + (win.height - popupHeight)/2`

Milestone: pressing a test function opens a centered popup.

---

### Step 7 — Add messaging to update the UI

After computing the cycle list and highlight index, send:

* `chrome.runtime.sendMessage({ type: "RENDER", tabs: cycleTabs, highlightIndex })`

The switcher UI receives it and rerenders.

Milestone: popup shows real tabs from current window in MRU order.

---

### Step 8 — Implement the cycling command (shortcut handler)

Add:

* `chrome.commands.onCommand.addListener(async (command) => { ... })`

For command `mru-cycle`:

1. Identify current window id
2. If not currently cycling:

   * compute cycle list once
   * store it as a **snapshot** in state (important!)
   * set `highlightIndex = 0`
   * open popup + render
3. If already cycling:

   * increment `highlightIndex` (wrap around)
   * re-render using the stored snapshot list

#### Why snapshot matters

If you recompute MRU every time, the act of switching/highlighting can reorder MRU events and cause bouncing. Snapshotting keeps cycling stable and predictable until commit.

Milestone: repeated key presses move highlight through the list.

---

### Step 9 — Commit selection after idle timeout (Cmd+Tab feel)

Because you can’t reliably detect key release for arbitrary shortcuts, you simulate it:

On every cycle key press:

* clear old timer
* set a new timer (e.g. 800ms)

When timer fires:

1. Validate snapshot list still exists
2. Remove any closed tabs from snapshot
3. Clamp highlightIndex if needed
4. Activate the highlighted tab:

   * `chrome.tabs.update(selectedTabId, { active: true })`
5. Close the switcher window
6. Clear cycle state

Milestone: tap-tap-tap… pause → selected tab activates and popup closes.

---

### Step 10 — Handle edge cases (make it reliable)

Add these protections:

1. **Popup closed manually**

* If sending message fails or popup window doesn’t exist:

  * clear state and recreate next time

2. **Tab closed during cycling**

* On commit, filter snapshot list against current tabs
* Clamp index

3. **Window changed during cycling**

* If focus switches away from the original window:

  * close popup
  * clear state

4. **Service worker suspension**

* Store MRU lists in `chrome.storage.session`
* On startup/command, load into memory if empty

Milestone: no weird crashes, cycling still works under normal chaos.

---

### Step 11 — Document shortcuts clearly (user instructions)

In your README or extension description:

* “Default shortcut: (whatever you set)”
* “To change shortcut: open `chrome://extensions/shortcuts` and set **MRU Cycle**.”

Also mention:

* Ctrl+Tab may be blocked by Chrome and is not guaranteed.

Milestone: user knows exactly how to set the shortcut.

---

## Final MVP acceptance checklist

* [ ] MRU order updates as you click between tabs
* [ ] Shortcut opens popup centered
* [ ] Popup shows tabs in correct activation order
* [ ] Pressing shortcut repeatedly moves highlight
* [ ] Pausing commits selection (switches tab) and closes popup
* [ ] Works across tab closes and window focus changes
* [ ] Shortcut is configurable via `chrome://extensions/shortcuts`

---

If you want, I can now produce the exact starter files (`manifest.json`, `background.js`, `switcher.html`, `switcher.js`, `switcher.css`) that match this plan so you can paste them into your folder and run immediately.
