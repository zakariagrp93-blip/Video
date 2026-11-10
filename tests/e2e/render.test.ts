import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../pngDecode';
import { FFmpeg, resolveMediaBinaries } from '../../src/core/media/ffmpeg';
import { renderCharacterSheet, renderSceneChunks, renderStillFrame, validateMp4 } from '../../src/core/render/renderer';
import { sampleEditPlan, samplePlan } from '../../src/remotion/samplePlan';

const serveUrl = path.resolve('build/remotion-bundle');
const browserExecutable = process.env.FVS_BROWSER ?? null;
const ffmpeg = new FFmpeg(resolveMediaBinaries());
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvs-render-'));

function brightFraction(file: string): number {
  const img = decodePng(fs.readFileSync(file));
  let bright = 0;
  for (let i = 0; i < img.pixels.length; i += 4) if (img.pixels[i]! > 200 && img.pixels[i + 1]! > 200 && img.pixels[i + 2]! > 200) bright++;
  return bright / (img.width * img.height);
}

/** Share of pixels that are not near-black (the shot itself is drawn, not an empty frame). */
function litFraction(file: string): number {
  const img = decodePng(fs.readFileSync(file));
  let lit = 0;
  for (let i = 0; i < img.pixels.length; i += 4) if (img.pixels[i]! + img.pixels[i + 1]! + img.pixels[i + 2]! > 60) lit++;
  return lit / (img.width * img.height);
}

describe('scene composition and rendering', () => {
  it('composes a scene with the mascot and props (not a blank frame)', async () => {
    const out = path.join(dir, 'still.png');
    await renderStillFrame(samplePlan(3, 2), 45, out, { serveUrl, browserExecutable });
    const f = brightFraction(out);
    expect(f).toBeGreaterThan(0.03); // white mascot + text present
    expect(f).toBeLessThan(0.6); // still a dark composition
  });

  it('renders every motivation-edit shot with its kinetic words', async () => {
    const plan = sampleEditPlan(2);
    for (const sc of plan.scenes) {
      const out = path.join(dir, `edit-${sc.id}.png`);
      await renderStillFrame(plan, sc.startFrame + 40, out, { serveUrl, browserExecutable });
      const f = brightFraction(out);
      // Big white/gold words on a dark, lit shot: some bright pixels, a clearly non-black frame.
      expect(f, `${sc.motif}`).toBeGreaterThan(0.001);
      expect(f, `${sc.motif}`).toBeLessThan(0.35);
      expect(litFraction(out), `${sc.motif}`).toBeGreaterThan(0.03);
    }
  });

  it('renders the character reference sheet', async () => {
    const out = path.join(dir, 'sheet.png');
    await renderCharacterSheet(out, { serveUrl, browserExecutable });
    expect(brightFraction(out)).toBeGreaterThan(0.05);
  });

  it('renders scene chunks, reuses unchanged chunks, and produces valid H.264', async () => {
    const plan = samplePlan(3, 1);
    const env = { serveUrl, browserExecutable, concurrency: 2, quality: 'standard' as const, ffmpeg, bundleHash: 'test' };
    const scenesDir = path.join(dir, 'scenes');
    const chunks = await renderSceneChunks(plan, scenesDir, env, {});
    expect(chunks).toHaveLength(3);
    const probe = await ffmpeg.probe(chunks[0]!);
    expect(probe.streams[0]).toMatchObject({ codecName: 'h264', width: 1080, height: 1920, pixFmt: 'yuv420p' });
    // Change only scene 2 → only that chunk is re-rendered.
    const before = chunks.map((c) => fs.statSync(c).mtimeMs);
    plan.scenes[1]!.character.expression = 'shocked';
    const cachedByScene = new Map<number, boolean>();
    const again = await renderSceneChunks(plan, scenesDir, env, { onProgress: (p) => cachedByScene.set(p.sceneIndex, p.cached) });
    const progress = [0, 1, 2].map((i) => cachedByScene.get(i));
    expect(again[0]).toBe(chunks[0]);
    expect(again[1]).not.toBe(chunks[1]);
    expect(fs.statSync(again[0]!).mtimeMs).toBe(before[0]);
    expect(progress).toEqual([true, false, true]);
    expect(fs.existsSync(chunks[1]!)).toBe(false); // stale chunk removed
  });

  it('detects MP4 files that violate the delivery spec', async () => {
    const bad = path.join(dir, 'bad.mp4');
    await ffmpeg.run(['-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=25:duration=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', bad]);
    const v = await validateMp4(bad, ffmpeg, { width: 1080, height: 1920, fps: 30, durationSec: 5 });
    expect(v.ok).toBe(false);
    expect(v.issues.join(' ')).toMatch(/Resolution/);
    expect(v.issues.join(' ')).toMatch(/Frame rate/);
    expect(v.issues.join(' ')).toMatch(/No audio/);
    expect(v.issues.join(' ')).toMatch(/Duration/);
    const truncated = path.join(dir, 'trunc.mp4');
    fs.writeFileSync(truncated, fs.readFileSync(bad).subarray(0, 2000));
    expect((await validateMp4(truncated, ffmpeg, { width: 320, height: 240, fps: 25, durationSec: 1 })).ok).toBe(false);
  });
});
