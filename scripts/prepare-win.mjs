// Ensures the Windows-specific native binaries are present before electron-builder
// packages the Windows installer. On a Windows host npm already installed them;
// on Linux/macOS hosts (cross-build) they are fetched explicitly here.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nm = path.join(root, 'node_modules');
const remotionVersion = JSON.parse(fs.readFileSync(path.join(nm, '@remotion/renderer/package.json'), 'utf8')).version;

function ok(msg) {
  console.log(`✓ ${msg}`);
}

// 1. Remotion compositor for win32-x64
const compositor = path.join(nm, '@remotion/compositor-win32-x64-msvc');
if (!fs.existsSync(compositor)) {
  console.log(`Installing @remotion/compositor-win32-x64-msvc@${remotionVersion} for the Windows build…`);
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-save', '--force', '--os=win32', '--cpu=x64', `@remotion/compositor-win32-x64-msvc@${remotionVersion}`], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}
if (!fs.existsSync(path.join(compositor, 'remotion.exe')) && !fs.readdirSync(compositor).some((f) => f.endsWith('.exe'))) {
  throw new Error('Remotion Windows compositor binaries are missing.');
}
ok('Remotion compositor (win32-x64)');

// 2. FFmpeg for Windows (ffmpeg-static picks ffmpeg.exe at runtime on win32)
const ffmpegDir = path.join(nm, 'ffmpeg-static');
const ffmpegExe = path.join(ffmpegDir, 'ffmpeg.exe');
if (!fs.existsSync(ffmpegExe)) {
  const pkg = JSON.parse(fs.readFileSync(path.join(ffmpegDir, 'package.json'), 'utf8'));
  const tag = pkg['ffmpeg-static']['binary-release-tag'];
  const url = `https://github.com/eugeneware/ffmpeg-static/releases/download/${tag}/ffmpeg-win32-x64.gz`;
  console.log(`Downloading Windows FFmpeg (${tag})…`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`FFmpeg download failed: HTTP ${res.status}`);
  const gz = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(ffmpegExe, zlib.gunzipSync(gz));
  const licenseUrl = `https://github.com/eugeneware/ffmpeg-static/releases/download/${tag}/ffmpeg-win32-x64.LICENSE`;
  const lic = await fetch(licenseUrl, { redirect: 'follow' });
  if (lic.ok) fs.writeFileSync(path.join(ffmpegDir, 'ffmpeg.exe.LICENSE'), Buffer.from(await lic.arrayBuffer()));
}
const head = fs.readFileSync(ffmpegExe).subarray(0, 2).toString('latin1');
if (head !== 'MZ') throw new Error('ffmpeg.exe is not a Windows executable.');
ok('FFmpeg (win32-x64)');

// 3. FFprobe and ONNX Runtime ship Windows binaries inside their npm packages.
if (!fs.existsSync(path.join(nm, 'ffprobe-static/bin/win32/x64/ffprobe.exe'))) throw new Error('ffprobe.exe missing');
ok('FFprobe (win32-x64)');
const ortWin = fs.readdirSync(path.join(nm, 'onnxruntime-node/bin')).some((napi) => fs.existsSync(path.join(nm, 'onnxruntime-node/bin', napi, 'win32/x64')));
if (!ortWin) throw new Error('onnxruntime-node win32-x64 binaries missing');
ok('ONNX Runtime (win32-x64)');

// 4. Pre-built animation bundle
if (!fs.existsSync(path.join(root, 'build/remotion-bundle/index.html'))) throw new Error('Run "npm run build:remotion" first.');
ok('Remotion animation bundle');
