// UI end-to-end test: launches the real Electron app, navigates every screen,
// generates a video through the interface and verifies the result.
//   xvfb-run -a node tests/e2e/ui.e2e.mjs [screenshotDir]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright-core';

const require = createRequire(import.meta.url);
const shots = path.resolve(process.argv[2] ?? 'scratch/ui');
fs.mkdirSync(shots, { recursive: true });
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvs-ui-'));
const voiceCache = process.env.FVS_TEST_VOICES_DIR ?? path.join(os.homedir(), '.cache', 'finance-video-studio-test', 'voices');
if (fs.existsSync(voiceCache)) fs.cpSync(voiceCache, path.join(dataDir, 'voices'), { recursive: true });

const assert = (cond, msg) => {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
};

// FVS_APP_EXECUTABLE runs the test against a packaged build instead of the dev tree.
const packaged = process.env.FVS_APP_EXECUTABLE;
const app = await electron.launch({
  executablePath: packaged ?? require('electron'),
  args: packaged ? ['--no-sandbox'] : ['.', '--no-sandbox'],
  env: { ...process.env, FVS_DATA_DIR: dataDir, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
});
const win = await app.firstWindow();
// On failure, dump everything needed to diagnose (CI has no interactive access).
async function diagnose(err) {
  console.error('UI e2e FAILED:', err?.message ?? err);
  try {
    await win.screenshot({ path: path.join(shots, 'failure.png') });
  } catch {}
  try {
    const projects = await win.evaluate(() => window.fvs.listProjects());
    for (const p of projects) {
      const d = await win.evaluate((id) => window.fvs.getProject(id), p.id);
      console.error('project', p.id, p.status, d.project.failedStage ?? '', d.project.error ?? '');
      console.error('  stages', JSON.stringify(Object.fromEntries(Object.entries(d.project.stages).map(([k, v]) => [k, `${v.status}${v.error ? `: ${v.error}` : ''}`]))));
      console.error('  last progress', JSON.stringify(d.progress ?? null));
    }
  } catch (e) {
    console.error('could not query projects', e?.message);
  }
  const log = path.join(dataDir, 'logs', 'studio.log');
  if (fs.existsSync(log)) {
    const text = fs.readFileSync(log, 'utf8').split('\n').filter((l) => /WARN|ERROR/.test(l)).slice(-40).join('\n');
    console.error('--- studio.log (warnings/errors) ---\n' + text);
    fs.copyFileSync(log, path.join(shots, 'studio.log'));
  }
  await app.close().catch(() => {});
  process.exit(1);
}

try {
  win.on('console', (m) => m.type() === 'error' && console.log('[renderer]', m.text()));
  await win.setViewportSize({ width: 1440, height: 920 });
  await win.waitForSelector('text=CREATE A VIDEO');
  await win.screenshot({ path: path.join(shots, '1-dashboard-empty.png') });

  // Settings screen renders real system info
  await win.click('nav >> text=Settings');
  await win.waitForSelector('text=API keys');
  await win.waitForSelector('text=Animation bundle');
  await win.screenshot({ path: path.join(shots, '5-settings.png'), fullPage: false });
  const sysText = await win.textContent('main');
  assert(sysText.includes('Ready'), 'animation bundle should be ready');
  // Secrets never come back to the renderer
  const secure = await win.evaluate(() => window.fvs.systemInfo().then((i) => i.secureStorage));
  await win.fill('input[placeholder="Paste key"] >> nth=0', 'sk-ant-test-1234567890abcdef');
  await win.click('.secret-row >> nth=0 >> text=Save');
  if (secure) {
    await win.waitForSelector('.secret-row >> nth=0 >> text=Saved');
    const leaked = await win.evaluate(() => document.body.innerHTML.includes('sk-ant-test-1234567890abcdef'));
    assert(!leaked, 'API key must not be present in the DOM after saving');
    const status = await win.evaluate(() => window.fvs.getSettings().then((r) => JSON.stringify(r)));
    assert(!status.includes('sk-ant-test'), 'settings API must not return secrets');
    await win.click('.secret-row >> nth=0 >> text=Remove');
  } else {
    // No OS keyring (e.g. headless Linux): the app must refuse to store the key in plain text.
    await win.waitForSelector('.toast-error >> text=Secure storage is not available');
    console.log('secure storage unavailable on this host: key correctly refused');
  }

  // Regression: entering an ElevenLabs voice ID must not reset the TTS provider.
  await win.selectOption('.field:has-text("Voice (TTS)") select', 'elevenlabs');
  await win.waitForSelector('text=Female voice');
  const femaleInput = win.locator('.field:has-text("Female voice") input');
  await femaleInput.fill('test-voice-id-123');
  await femaleInput.press('Enter');
  await win.waitForTimeout(500);
  const afterVoice = await win.evaluate(() => window.fvs.getSettings().then((r) => ({ tts: r.settings.ttsProvider, id: r.settings.voices.elevenlabs.female })));
  assert(afterVoice.tts === 'elevenlabs' && afterVoice.id === 'test-voice-id-123', `voice ID edit reset settings: ${JSON.stringify(afterVoice)}`);
  await win.selectOption('.field:has-text("Voice (TTS)") select', 'piper');
  await win.waitForSelector('tr:has-text("Gilles")');

  // Real voice download through Electron's network stack.
  await win.click('tr:has-text("Gilles") >> text=Download');
  await win.waitForSelector('tr:has-text("Gilles") >> text=Installed', { timeout: 300_000 });

  // Generator with live preflight: an unsupported topic is rejected before generating.
  await win.click('nav >> text=Create video');
  await win.waitForSelector('textarea');
  await win.fill('textarea', 'Why is the sky blue on Tuesdays?');
  await win.waitForSelector('.alert-danger >> text=could not recognise');
  const disabled = await win.isDisabled('text=GENERATE VIDEO');
  assert(disabled, 'generate must be disabled for an unsupported topic');

  // Motivation edits accept any topic offline (no recognised finance scenario needed).
  await win.click('.segmented button:has-text("Motivation edit")');
  await win.waitForSelector('text=Music');
  await win.waitForFunction(() => !document.querySelector('.alert-danger'));
  await win.screenshot({ path: path.join(shots, '2b-generator-motivation.png') });
  await win.click('.segmented button:has-text("Finance story")');

  await win.fill('textarea', 'What if you received €1 million at age 18?');
  await win.click('.segmented button:has-text("30 s")');
  await win.click('.segmented button:has-text("Français")');
  await win.waitForFunction(() => !document.querySelector('.alert-danger'));
  await win.screenshot({ path: path.join(shots, '2-generator.png') });
  await win.click('text=GENERATE VIDEO');

  // Progress screen with real stages
  await win.waitForSelector('text=Writing script');
  await win.waitForSelector('.stage-running', { timeout: 60_000 });
  await win.waitForSelector('text=Rendering video');
  await win.waitForFunction(() => document.querySelector('.stage-running')?.textContent?.includes('Rendering video'), null, { timeout: 600_000 });
  await win.screenshot({ path: path.join(shots, '3-progress-rendering.png') });
  await win.waitForSelector('video.player', { timeout: 900_000 });
  await win.waitForSelector('text=Video ready');
  await win.waitForTimeout(1500);
  await win.screenshot({ path: path.join(shots, '4-completed.png') });

  // The <video> element must actually load the MP4 through the media protocol.
  const meta = await win.evaluate(
    () =>
      new Promise((resolve) => {
        const v = document.querySelector('video.player');
        if (v.readyState >= 1) return resolve({ duration: v.duration, w: v.videoWidth, h: v.videoHeight });
        v.addEventListener('loadedmetadata', () => resolve({ duration: v.duration, w: v.videoWidth, h: v.videoHeight }), { once: true });
        v.addEventListener('error', () => resolve({ error: v.error?.code }), { once: true });
      }),
  );
  console.log('video element metadata', meta);
  assert(meta.w === 1080 && meta.h === 1920 && meta.duration > 15, 'video must load in the player');

  // Library
  await win.click('nav >> text=Video library');
  await win.waitForSelector('.video-card');
  await win.waitForSelector('.video-thumb img');
  await win.screenshot({ path: path.join(shots, '6-library.png') });
  await win.click('.video-card >> nth=0 >> [title="Duplicate project"]');
  try {
    await win.waitForFunction(() => document.querySelectorAll('.video-card').length === 2, null, { timeout: 30_000 });
  } catch (err) {
    await win.screenshot({ path: path.join(shots, 'fail-duplicate.png') });
    console.log('toasts:', await win.textContent('.toasts'));
    console.log('projects:', JSON.stringify(await win.evaluate(() => window.fvs.listProjects().then((l) => l.map((p) => [p.id, p.status])))));
    throw err;
  }
  await win.click('.video-card >> nth=0 >> [title="Delete project"]');
  await win.click('.modal button.btn-danger');
  await win.waitForFunction(() => document.querySelectorAll('.video-card').length === 1);

  // Dashboard reflects stats
  await win.click('nav >> text=Dashboard');
  await win.waitForSelector('.recent-item');
  await win.screenshot({ path: path.join(shots, '7-dashboard.png') });
  const statText = await win.textContent('.stats');
  assert(/1\s*Videos generated/.test(statText), `dashboard should count 1 video, got: ${statText}`);

} catch (err) {
  await diagnose(err);
}
await app.close();
console.log('UI e2e passed. Screenshots in', shots);
if (process.env.FVS_KEEP !== '1') fs.rmSync(dataDir, { recursive: true, force: true });
