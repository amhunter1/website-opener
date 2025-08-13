# Website Opener

Open many URLs at once from a clean web UI. Supports normal and incognito mode. On Windows, it can launch real browser windows (Chrome, Edge, Firefox). If native launching isn’t available, it falls back to client-side opening.

## Contents

- Overview
- Requirements
- Install & Run
- How it works
- Usage (UI)
- API
- Windows behavior and limitations
- Troubleshooting
- License

## Overview

This app provides a text box where you can paste multiple URLs (one per line), choose how many times to open each URL, and select a mode (normal or incognito). On Windows, the server attempts to open URLs using installed browsers. Otherwise, the client uses `window.open` as a fallback.

## Requirements

- Node.js 18+ (tested with Node 22)
- Windows 10/11 for native browser launching
- One of: Google Chrome, Microsoft Edge, or Mozilla Firefox (optional but recommended for native mode)

## Install & Run

```bash
npm install
npm start
```

Then open `http://localhost:3000` in your browser.

For development with auto-reload (if you add a dev script):

```bash
npm run dev
```

## How it works

- Server: `server.js` (Node + Express)
  - Serves the static UI from `public/`
  - POST `/api/open` endpoint accepts a list of URLs and options
  - On Windows, tries to locate browser executables via environment variables (`ProgramFiles`, `ProgramFiles(x86)`, `LOCALAPPDATA`) and uses `child_process.spawn` to launch windows/tabs
  - If a specific browser is not found:
    - Normal mode: falls back to the default browser via `cmd /c start`
    - Incognito mode: returns an error because default browser incognito cannot be invoked programmatically

- Client: `public/index.html`, `public/main.js`, `public/styles.css`
  - UI to paste URLs, set count, select mode
  - Optional settings panel to choose opening method: Default, Chrome, Edge, Firefox, or Client Only
  - If server opening fails, automatically falls back to client-side `window.open`

## Usage (UI)

1. Start the server and visit `http://localhost:3000`.
2. Paste one URL per line. Example:
   - `https://google.com`
   - `https://github.com`
3. Choose how many times to open each URL.
4. Choose Mode: Normal or Incognito.
5. Optional: From the settings panel (top-right), choose an opening method:
   - Default Browser
   - Google Chrome
   - Microsoft Edge
   - Mozilla Firefox
   - Client Only (uses `window.open`)
6. Click Open.

Stats for total opened tabs and session counts are shown on the page.

## API

POST `/api/open`

Request body:

```json
{
  "urls": ["https://example.com", "https://another.com"],
  "count": 1,
  "mode": "normal", // or "incognito"
  "browser": "default" // one of: default | chrome | edge | firefox | client
}
```

Response (success):

```json
{
  "ok": true,
  "opened": 2,
  "windowsLaunched": 2
}
```

Response (error):

```json
{
  "ok": false,
  "error": "Human-readable error message"
}
```

## Windows behavior and limitations

- Native opening resolves browser executables from common install paths using environment variables. If a browser isn’t found:
  - Normal mode falls back to the default browser per URL
  - Incognito mode returns an error (default browser incognito isn’t reliably available programmatically)
- Tab batching: the server groups URLs to open multiple tabs per window where supported
- Safety limits: caps total URLs and repetitions to prevent excessive spawns

## Troubleshooting

- “spawn msedge ENOENT” or similar
  - Ensure the selected browser is installed in a standard location
  - Try switching the opening method to Default Browser or Client Only in the settings panel
  - If your browser is installed in a custom path, share the path and we can add it to the resolver

- “Some tabs were blocked”
  - Your browser’s popup blocker may block `window.open`. Allow popups for `http://localhost:3000` or prefer the native opening methods (Chrome/Edge/Firefox)

- Incognito opening fails with default browser
  - Select a specific browser (Chrome/Edge/Firefox) because incognito cannot be triggered for the default browser generically

## License

MIT
