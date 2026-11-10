import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type FvsApi, type FvsMethod } from '../src/shared/ipc';

/**
 * Narrow, typed bridge. The renderer can only call whitelisted methods; it has
 * no Node access and never receives secrets.
 */
const METHODS: FvsMethod[] = [
  'dashboard',
  'listProjects',
  'getProject',
  'preflight',
  'providerInfo',
  'generate',
  'retry',
  'regenerate',
  'cancel',
  'duplicate',
  'deleteProject',
  'openFileLocation',
  'openInSystemPlayer',
  'exportCopy',
  'getSettings',
  'updateSettings',
  'setSecret',
  'testProvider',
  'listVoices',
  'installVoice',
  'chooseFolder',
  'chooseFile',
  'clearCache',
  'systemInfo',
  'customIcons',
  'openCustomIconsFolder',
  'queueState',
];

const api: Record<string, unknown> = {};
for (const m of METHODS) {
  api[m] = (...args: unknown[]) => ipcRenderer.invoke(IPC.invoke, m, args);
}
api.onProgress = (cb: Parameters<FvsApi['onProgress']>[0]) => {
  const listener = (_e: unknown, payload: Parameters<typeof cb>[0]) => cb(payload);
  ipcRenderer.on(IPC.progress, listener);
  return () => ipcRenderer.removeListener(IPC.progress, listener);
};
api.onVoiceDownload = (cb: Parameters<FvsApi['onVoiceDownload']>[0]) => {
  const listener = (_e: unknown, payload: Parameters<typeof cb>[0]) => cb(payload);
  ipcRenderer.on(IPC.voiceDownload, listener);
  return () => ipcRenderer.removeListener(IPC.voiceDownload, listener);
};

contextBridge.exposeInMainWorld('fvs', api as unknown as FvsApi);
