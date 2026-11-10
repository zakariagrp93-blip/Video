// Same packaging as the Windows build, targeting Linux, used to run the UI e2e
// test against a *packaged* app (asar, unpacked natives, resources) on CI/Linux.
const pkg = require('../package.json');
const files = pkg.build.files.filter((f) => !/linux|ffmpeg-static\/ffmpeg$/.test(f)).concat(['!node_modules/@remotion/compositor-win32-*/**', '!node_modules/ffmpeg-static/ffmpeg.exe', '!node_modules/onnxruntime-node/bin/napi-v*/win32/**', '!node_modules/ffprobe-static/bin/win32/**']);
module.exports = { ...pkg.build, files, directories: { output: 'release-linux-test', buildResources: 'assets' }, linux: { target: ['dir'], icon: 'assets/icon.png' } };
