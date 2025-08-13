import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

function isWindows() {
  return process.platform === 'win32';
}

function isValidHttpUrl(maybeUrl) {
  try {
    const u = new URL(maybeUrl);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function pickExistingPath(paths) {
  for (const p of paths) {
    try {
      if (p.includes('\\') || p.includes('/')) {
        if (fs.existsSync(p)) return p;
      }
    } catch (_) {
    }
  }
  return null;
}

function resolveBrowserExecutable(browser) {
  const normalized = (browser || '').toLowerCase();
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const localAppData = process.env['LOCALAPPDATA'] || '';

  const candidatesByBrowser = {
    chrome: [
      `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
      `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
      localAppData ? `${localAppData}\\Google\\Chrome\\Application\\chrome.exe` : ''
    ].filter(Boolean),
    edge: [
      `${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${programFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe`,
      localAppData ? `${localAppData}\\Microsoft\\Edge\\Application\\msedge.exe` : ''
    ].filter(Boolean),
    firefox: [
      `${programFiles}\\Mozilla Firefox\\firefox.exe`,
      `${programFilesX86}\\Mozilla Firefox\\firefox.exe`
    ]
  };
  const list = candidatesByBrowser[normalized];
  if (!list) return null;
  return pickExistingPath(list);
}

function buildArgs(browser, mode, batchUrls) {
  const b = browser.toLowerCase();
  const m = (mode || 'normal').toLowerCase();
  if (b === 'chrome') {
    const args = ['--new-window'];
    if (m === 'incognito') args.push('--incognito');
    return args.concat(batchUrls);
  }
  if (b === 'edge') {
    const args = ['--new-window'];
    if (m === 'incognito') args.push('-inprivate');
    return args.concat(batchUrls);
  }
  if (b === 'firefox') {
    const args = m === 'incognito' ? ['-private-window'] : ['-new-window'];
    return args.concat(batchUrls);
  }
  return batchUrls;
}

function openWithDefaultBrowserWindows(url) {
  return new Promise((resolve, reject) => {
    const child = spawn('cmd.exe', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore'
    });
    child.on('error', reject);
    child.unref();
    resolve();
  });
}

async function openUrlsWindows({ browser, mode, urls, count }) {
  // Cap limits for safety
  const sanitizedUrls = urls.filter(isValidHttpUrl).slice(0, 100);
  const times = Math.min(Math.max(1, Number(count) || 1), 20);

  if (!browser || browser === 'default') {
    if (mode === 'incognito') {
      throw new Error('Varsayılan tarayıcı ile gizli mod programatik olarak açılamıyor. Lütfen belirli bir tarayıcı seçin.');
    }
    for (let i = 0; i < times; i++) {
      for (const u of sanitizedUrls) {
        await openWithDefaultBrowserWindows(u);
      }
    }
    return { opened: sanitizedUrls.length * times, windowsLaunched: sanitizedUrls.length * times };
  }

  const executable = resolveBrowserExecutable(browser);
  if (!executable) {
    if ((mode || 'normal').toLowerCase() === 'incognito') {
      throw new Error(`Seçilen tarayıcı bulunamadı: ${browser}. Gizli mod varsayılan tarayıcı ile açılamaz.`);
    }
    // Fallback to default browser if specific browser not found
    for (let i = 0; i < times; i++) {
      for (const u of sanitizedUrls) {
        try { await openWithDefaultBrowserWindows(u); } catch {}
      }
    }
    return { opened: sanitizedUrls.length * times, windowsLaunched: sanitizedUrls.length * times };
  }

  const BATCH_SIZE = 15;
  let windowsLaunched = 0;
  for (let t = 0; t < times; t++) {
    for (let i = 0; i < sanitizedUrls.length; i += BATCH_SIZE) {
      const batch = sanitizedUrls.slice(i, i + BATCH_SIZE);
      const args = buildArgs(browser, mode, batch);
      const child = spawn(executable, args, { detached: true, stdio: 'ignore' });
      child.on('error', () => {});
      child.unref();
      windowsLaunched++;
    }
  }
  return { opened: sanitizedUrls.length * times, windowsLaunched };
}

app.post('/api/open', async (req, res) => {
  try {
    const { urls, count, mode, browser } = req.body || {};
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Geçerli bir URL listesi gerekli.' });
    }
    if (!isWindows()) {
      return res.status(400).json({ error: 'Yerel açıcı yalnızca Windows için etkin.' });
    }
    const result = await openUrlsWindows({ browser: (browser || 'default'), mode: (mode || 'normal'), urls, count });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Bilinmeyen hata' });
  }
});

app.listen(PORT, () => {
  console.log(`\n Website Opener running → http://localhost:${PORT}\n`);
});



