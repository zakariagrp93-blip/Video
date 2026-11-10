import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { customIconKey, importCustomIcons, scanCustomIcons } from '../../src/core/characters/customIcons';
import type { Storyboard } from '../../src/shared/schemas';

const sb = { scenes: [{ props: [{ asset: 'house' }, { asset: 'phone' }, { asset: 'calendar' }] }] } as unknown as Storyboard;

describe('custom icon folder (user-licensed icons)', () => {
  it('detects icons by asset name, imports only the used ones, and rejects unsafe SVG', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvs-icons-'));
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'fvs-ill-'));
    fs.writeFileSync(path.join(dir, 'House.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>');
    fs.writeFileSync(path.join(dir, 'phone.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    fs.writeFileSync(path.join(dir, 'calendar.svg'), '<svg onload="alert(1)"></svg>');
    fs.writeFileSync(path.join(dir, 'not-an-asset.svg'), '<svg/>');
    fs.writeFileSync(path.join(dir, 'car.svg'), '<svg/>');
    expect(Object.keys(scanCustomIcons(dir)).sort()).toEqual(['calendar', 'car', 'house', 'phone']);
    const res = await importCustomIcons(dir, sb, out);
    expect(Object.keys(res.images).sort()).toEqual([customIconKey('house'), customIconKey('phone')]);
    expect(res.warnings.join(' ')).toMatch(/calendar\.svg contains scripts/);
    for (const f of Object.values(res.images)) expect(fs.existsSync(path.join(out, f))).toBe(true);
    // Replacing an icon changes its content-hashed name (so cached scene renders are invalidated).
    const before = res.images[customIconKey('house')];
    fs.writeFileSync(path.join(dir, 'House.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>');
    const again = await importCustomIcons(dir, sb, out);
    expect(again.images[customIconKey('house')]).not.toBe(before);
  });
  it('reports a missing folder without failing', async () => {
    const res = await importCustomIcons('/does/not/exist', sb, os.tmpdir());
    expect(res.images).toEqual({});
    expect(res.warnings[0]).toMatch(/not found/);
  });
});
