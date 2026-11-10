import { describe, expect, it } from 'vitest';
import { SettingsStore, parseSettingsPatch } from '../../src/core/settings/settingsStore';

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

describe('settings updates from the UI', () => {
  it('changing one field (e.g. an ElevenLabs voice ID) never resets the others', async () => {
    const s = new SettingsStore(null);
    await s.update(parseSettingsPatch({ ttsProvider: 'elevenlabs', llmProvider: 'anthropic', musicVolume: 0.3 }));
    const voices = { ...s.get().voices, elevenlabs: { male: '', female: 'voice-id-123' } };
    const patch = parseSettingsPatch({ voices });
    expect(Object.keys(patch)).toEqual(['voices']);
    await s.update(patch);
    expect(s.get().ttsProvider).toBe('elevenlabs');
    expect(s.get().llmProvider).toBe('anthropic');
    expect(s.get().musicVolume).toBe(0.3);
    expect(s.get().voices.elevenlabs.female).toBe('voice-id-123');
  });
  it('rejects invalid values', () => {
    expect(() => parseSettingsPatch({ ttsProvider: 'nope' })).toThrow();
    expect(() => parseSettingsPatch(null)).toThrow();
  });
});
