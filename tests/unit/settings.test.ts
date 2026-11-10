import { describe, expect, it } from 'vitest';
import { SettingsStore } from '../../src/core/settings/settingsStore';

describe('settings store', () => {
  it('applies and reverts updates', async () => {
    const s = new SettingsStore(null);
    const original = s.get().browserExecutable;
    await s.update({ browserExecutable: '/nonexistent/chrome', maxRetries: 0 });
    expect(s.get().browserExecutable).toBe('/nonexistent/chrome');
    await s.update({ browserExecutable: original, maxRetries: 2 });
    expect(s.get().browserExecutable).toBe('');
    expect(s.get().maxRetries).toBe(2);
  });
});
