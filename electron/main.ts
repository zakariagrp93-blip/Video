import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { BrowserWindow, app, dialog, ipcMain, net, protocol, safeStorage, shell } from 'electron';
import { IPC, type FvsMethod } from '../src/shared/ipc';
import { Studio, defaultPaths } from '../src/core/studio';
import type { SecretCipher } from '../src/core/settings/settingsStore';
import { safeJoin } from '../src/core/util/fsx';
import { setFetchImplementation } from '../src/core/util/http';
import { createLogger, redact } from '../src/core/util/logger';
import { createHandlers } from './handlers';

const log = createLogger('main');
let studio: Studio | undefined;
let mainWindow: BrowserWindow | null = null;

protocol.registerSchemesAsPrivileged([{ scheme: 'fvs-media', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

/** DPAPI (Windows) / Keychain (macOS) / libsecret (Linux) backed encryption for API keys. */
const electronCipher: SecretCipher = {
  get available() {
    return safeStorage.isEncryptionAvailable();
  },
  encrypt: (plain) => safeStorage.encryptString(plain),
  decrypt: (data) => safeStorage.decryptString(data),
};

function appRoot(): string {
  return app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..', '..');
}

function compositorPackage(): string | null {
  const key = `${process.platform}-${process.arch}`;
  const map: Record<string, string> = {
    'win32-x64': 'compositor-win32-x64-msvc',
    'darwin-arm64': 'compositor-darwin-arm64',
    'darwin-x64': 'compositor-darwin-x64',
    'linux-x64': 'compositor-linux-x64-gnu',
    'linux-arm64': 'compositor-linux-arm64-gnu',
  };
  return map[key] ?? null;
}

function remotionBundlePath(): string {
  return app.isPackaged ? path.join(process.resourcesPath, 'remotion-bundle') : path.join(appRoot(), 'build', 'remotion-bundle');
}

/** Serves project media to the renderer with HTTP Range support (needed for video seeking). */
function registerMediaProtocol(projectsDir: string): void {
  protocol.handle('fvs-media', async (request) => {
    try {
      const url = new URL(request.url);
      const [kind, projectId, file] = [url.hostname, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent)];
      if (kind !== 'project' || !projectId || !/^[a-z0-9-]+$/i.test(projectId) || !['final.mp4', 'thumbnail.jpg'].includes(file ?? '')) {
        return new Response('Not found', { status: 404 });
      }
      const filePath = safeJoin(projectsDir, projectId, file!);
      if (!fs.existsSync(filePath)) return new Response('Not found', { status: 404 });
      const size = fs.statSync(filePath).size;
      const type = file === 'final.mp4' ? 'video/mp4' : 'image/jpeg';
      const range = request.headers.get('range');
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        const start = m?.[1] ? Number(m[1]) : 0;
        const end = m?.[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
        if (start >= size || end < start) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
        const stream = Readable.toWeb(fs.createReadStream(filePath, { start, end })) as ReadableStream;
        return new Response(stream, { status: 206, headers: { 'content-type': type, 'content-length': String(end - start + 1), 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes' } });
      }
      const stream = Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream;
      return new Response(stream, { status: 200, headers: { 'content-type': type, 'content-length': String(size), 'accept-ranges': 'bytes' } });
    } catch (err) {
      log.error('media protocol error', err);
      return new Response('Error', { status: 500 });
    }
  });
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#07070A',
    title: 'Finance Video Studio',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
  const devUrl = process.env.FVS_DEV_URL;
  if (devUrl) await mainWindow.loadURL(devUrl);
  else await mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.financevideostudio.app');
  setFetchImplementation((input, init) => net.fetch(input, init as never));
  const dataDir = process.env.FVS_DATA_DIR ?? app.getPath('userData');
  if (app.isPackaged) {
    // Native binaries are unpacked next to app.asar; Remotion downloads its browser relative to cwd.
    const compositor = compositorPackage();
    if (compositor) process.env.FVS_REMOTION_BINARIES = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@remotion', compositor);
    const runtime = path.join(dataDir, 'runtime');
    fs.mkdirSync(runtime, { recursive: true });
    process.chdir(runtime);
  }
  studio = await Studio.create({ paths: defaultPaths(dataDir, remotionBundlePath()), cipher: electronCipher, persist: true });
  registerMediaProtocol(studio.paths.projectsDir);

  const handlers = createHandlers(studio, {
    openPath: async (p) => {
      const err = await shell.openPath(p);
      if (err) throw new Error(err);
    },
    showItemInFolder: (p) => shell.showItemInFolder(p),
    saveFileDialog: async (defaultName) => {
      const res = await dialog.showSaveDialog(mainWindow!, { defaultPath: defaultName, filters: [{ name: 'MP4 video', extensions: ['mp4'] }] });
      return res.canceled ? null : (res.filePath ?? null);
    },
    chooseFolder: async () => {
      const res = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory', 'createDirectory'] });
      return res.canceled ? null : (res.filePaths[0] ?? null);
    },
    chooseFile: async () => {
      const res = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile'] });
      return res.canceled ? null : (res.filePaths[0] ?? null);
    },
    appVersion: app.getVersion(),
    versions: { electron: process.versions.electron ?? '', node: process.versions.node },
    secureStorage: safeStorage.isEncryptionAvailable(),
    emitVoiceDownload: (e) => mainWindow?.webContents.send(IPC.voiceDownload, e),
  });

  ipcMain.handle(IPC.invoke, async (_event, method: FvsMethod, args: unknown[]) => {
    const fn = (handlers as Record<string, (...a: unknown[]) => Promise<unknown>>)[method];
    if (typeof fn !== 'function') throw new Error(`Unknown method ${String(method)}`);
    try {
      return await fn(...(Array.isArray(args) ? args : []));
    } catch (err) {
      // Never leak secrets through error messages.
      throw new Error(redact((err as Error).message ?? String(err)));
    }
  });
  studio.queue.onProgress((e) => mainWindow?.webContents.send(IPC.progress, e));

  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

let closing = false;
app.on('before-quit', (e) => {
  if (closing || !studio) return;
  e.preventDefault();
  closing = true;
  void studio.close().finally(() => app.quit());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
