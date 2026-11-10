import { useEffect, useState } from 'react';
import { DURATION_OPTIONS, EXPORT_QUALITIES, LANGUAGES, LANGUAGE_LABELS, type Language } from '../../shared/constants';
import type { SystemInfoDTO, VoiceDTO } from '../../shared/ipc';
import type { SecretKey, SecretStatus, Settings } from '../../shared/schemas';
import { api, errorText } from '../api';
import { IconCheck, IconDownload } from '../components/Icons';
import { Badge, Button, Card, Field, Select, Toggle, useToast } from '../components/ui';
import { formatBytes } from '../format';

export function SettingsScreen() {
  const toast = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [secrets, setSecrets] = useState<SecretStatus | null>(null);
  const [info, setInfo] = useState<SystemInfoDTO | null>(null);
  const [cacheBytes, setCacheBytes] = useState<number | null>(null);

  useEffect(() => {
    void api()
      .getSettings()
      .then((r) => {
        setS(r.settings);
        setSecrets(r.secrets);
      });
    void api().systemInfo().then(setInfo);
    void api().dashboard().then((d) => setCacheBytes(d.cache.bytes));
  }, []);

  const save = async (patch: Partial<Settings>) => {
    if (!s) return;
    const optimistic = { ...s, ...patch };
    setS(optimistic);
    try {
      setS(await api().updateSettings(patch));
    } catch (e) {
      toast('error', errorText(e));
    }
  };

  if (!s || !secrets) return <div className="page">Loading…</div>;

  return (
    <div className="page narrow">
      <h1>Settings</h1>

      <Card title="AI providers">
        <div className="form-grid">
          <Field label="Script & storyboard (LLM)" hint={s.llmProvider === 'offline' ? 'Built-in engine: no API, no cost. French and English, five finance scenario types.' : 'Uses structured JSON output; responses are cached.'}>
            <Select
              value={s.llmProvider}
              onChange={(v) => save({ llmProvider: v })}
              options={[
                { value: 'offline', label: 'Offline story engine (free)' },
                { value: 'anthropic', label: 'Anthropic Claude' },
                { value: 'openai', label: 'OpenAI' },
              ]}
            />
          </Field>
          {s.llmProvider !== 'offline' && (
            <Field label="Model">
              <TextInput
                value={s.llmProvider === 'anthropic' ? s.llmModel.anthropic : s.llmModel.openai}
                onCommit={(v) => save({ llmModel: { ...s.llmModel, [s.llmProvider]: v } })}
              />
            </Field>
          )}
          <Field label="Illustrations" hint="Vector library is free and perfectly consistent. AI images are only generated for objects the library cannot draw, then cached.">
            <Select
              value={s.imageProvider}
              onChange={(v) => save({ imageProvider: v })}
              options={[
                { value: 'vector', label: 'Built-in vector library (free)' },
                { value: 'openai', label: 'OpenAI Images' },
              ]}
            />
          </Field>
          {s.imageProvider === 'openai' && (
            <>
              <Field label="Image model">
                <TextInput value={s.imageModel} onCommit={(v) => save({ imageModel: v })} />
              </Field>
              <Field label="Max AI images per video">
                <NumberInput value={s.maxAiImagesPerVideo} min={0} max={8} step={1} onCommit={(v) => save({ maxAiImagesPerVideo: v })} />
              </Field>
            </>
          )}
          <Field label="Icon style" hint="White & grey matches cinematic finance stories: everyday objects in white/grey, money and signals keep their colour.">
            <Select
              value={s.iconTone}
              onChange={(v) => save({ iconTone: v })}
              options={[
                { value: 'mono', label: 'White & grey (cinematic)' },
                { value: 'muted', label: 'Muted colours' },
                { value: 'color', label: 'Full colour' },
              ]}
            />
          </Field>
          <CustomIconsField dir={s.customIconsDir} onChoose={(d) => save({ customIconsDir: d })} />
          <Field label="Voice (TTS)" hint={s.ttsProvider === 'piper' ? 'Local neural voices, offline after a one-time download. Subtitles are aligned on detected pauses.' : s.ttsProvider === 'elevenlabs' ? 'Returns character timestamps for exact subtitle timing.' : 'No timestamps; subtitles aligned on detected pauses.'}>
            <Select
              value={s.ttsProvider}
              onChange={(v) => save({ ttsProvider: v })}
              options={[
                { value: 'piper', label: 'Piper — local neural voices (free)' },
                { value: 'elevenlabs', label: 'ElevenLabs' },
                { value: 'openai', label: 'OpenAI TTS' },
              ]}
            />
          </Field>
          <Field label="Speaking speed" hint={`${s.speakingSpeed.toFixed(2)}×`}>
            <input className="range" type="range" min={0.8} max={1.25} step={0.05} value={s.speakingSpeed} onChange={(e) => save({ speakingSpeed: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="row gap-8 wrap mt-12">
          <TestButton kind="llm" id={s.llmProvider} />
          <TestButton kind="image" id={s.imageProvider} />
          <TestButton kind="tts" id={s.ttsProvider} />
        </div>
      </Card>

      <VoicesCard s={s} save={save} />

      <Card title="API keys">
        <p className="muted small">Keys are encrypted with the operating system's secure storage{info && !info.secureStorage ? ' (unavailable on this system — keys cannot be saved)' : ''}. They never reach the interface or the logs.</p>
        <SecretRow label="Anthropic API key" k="anthropicApiKey" set={secrets.anthropicApiKey} onChange={setSecrets} />
        <SecretRow label="OpenAI API key" k="openaiApiKey" set={secrets.openaiApiKey} onChange={setSecrets} />
        <SecretRow label="ElevenLabs API key" k="elevenlabsApiKey" set={secrets.elevenlabsApiKey} onChange={setSecrets} />
      </Card>

      <Card title="Defaults & export">
        <div className="form-grid">
          <Field label="Default duration">
            <Select value={s.defaultDuration} onChange={(v) => save({ defaultDuration: v })} options={DURATION_OPTIONS.map((d) => ({ value: d, label: d === 'auto' ? 'Automatic' : `${d} seconds` }))} />
          </Field>
          <Field label="Default language">
            <Select value={s.defaultLanguage} onChange={(v) => save({ defaultLanguage: v })} options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))} />
          </Field>
          <Field label="Export quality" hint="H.264 CRF 23 / 18 / 15. All exports are 1080×1920, 30 fps, AAC 192 kb/s.">
            <Select value={s.exportQuality} onChange={(v) => save({ exportQuality: v })} options={EXPORT_QUALITIES.map((q) => ({ value: q, label: q === 'standard' ? 'Standard' : q === 'high' ? 'High' : 'Maximum' }))} />
          </Field>
          <Field label="Output folder" hint={s.outputFolder || 'Videos stay inside the project folder only.'}>
            <div className="row gap-8">
              <Button onClick={async () => { const f = await api().chooseFolder(); if (f) void save({ outputFolder: f }); }}>Choose…</Button>
              {s.outputFolder && <Button variant="ghost" onClick={() => save({ outputFolder: '' })}>Clear</Button>}
            </div>
          </Field>
        </div>
      </Card>

      <Card title="Brand style">
        <div className="form-grid">
          <Field label="Brand name (shown as @handle)">
            <TextInput value={s.brand.name} onCommit={(v) => save({ brand: { ...s.brand, name: v.slice(0, 40) } })} />
          </Field>
          <Field label="Accent colour">
            <input className="color" type="color" value={s.brand.accent} onChange={(e) => save({ brand: { ...s.brand, accent: e.target.value } })} />
          </Field>
          <Field label="Negative colour">
            <input className="color" type="color" value={s.brand.danger} onChange={(e) => save({ brand: { ...s.brand, danger: e.target.value } })} />
          </Field>
        </div>
      </Card>

      <Card title="Audio">
        <div className="form-grid">
          <Field label="Background music" hint="Original music, synthesized for each video — nothing to license.">
            <Toggle checked={s.musicEnabled} onChange={(v) => save({ musicEnabled: v })} label={s.musicEnabled ? 'Enabled' : 'Disabled'} />
          </Field>
          <Field label={`Music volume (${Math.round(s.musicVolume * 100)}%)`}>
            <input className="range" type="range" min={0} max={0.5} step={0.01} value={s.musicVolume} disabled={!s.musicEnabled} onChange={(e) => save({ musicVolume: Number(e.target.value) })} />
          </Field>
          <Field label={`Sound effects (${Math.round(s.sfxVolume * 100)}%)`}>
            <input className="range" type="range" min={0} max={1} step={0.01} value={s.sfxVolume} onChange={(e) => save({ sfxVolume: Number(e.target.value) })} />
          </Field>
          <Field label={`Narration (${Math.round(s.narrationVolume * 100)}%)`}>
            <input className="range" type="range" min={0.5} max={1.5} step={0.01} value={s.narrationVolume} onChange={(e) => save({ narrationVolume: Number(e.target.value) })} />
          </Field>
        </div>
      </Card>

      <Card title="Rendering & performance">
        <div className="form-grid">
          <Field label="Render concurrency" hint="Parallel browser tabs per scene. Higher is faster but uses more memory.">
            <NumberInput value={s.renderConcurrency} min={1} max={16} step={1} onCommit={(v) => save({ renderConcurrency: v })} />
          </Field>
          <Field label="Automatic retries per stage">
            <NumberInput value={s.maxRetries} min={0} max={5} step={1} onCommit={(v) => save({ maxRetries: v })} />
          </Field>
          <Field label="FFmpeg path (optional)" hint="Leave empty to use the bundled FFmpeg.">
            <PathInput value={s.ffmpegPath} onCommit={(v) => save({ ffmpegPath: v })} />
          </Field>
          <Field label="Chrome executable (optional)" hint="Leave empty to let the renderer manage its own headless browser.">
            <PathInput value={s.browserExecutable} onCommit={(v) => save({ browserExecutable: v })} />
          </Field>
        </div>
      </Card>

      <Card title="Cache">
        <div className="form-grid">
          <Field label="Asset cache" hint={`Currently ${formatBytes(cacheBytes)}. Caches LLM responses, voice clips, images and music so identical requests are never paid twice.`}>
            <Toggle checked={s.cacheEnabled} onChange={(v) => save({ cacheEnabled: v })} label={s.cacheEnabled ? 'Enabled' : 'Disabled'} />
          </Field>
          <Field label="Maximum cache size (MB)">
            <NumberInput value={s.cacheMaxMb} min={100} max={100000} step={100} onCommit={(v) => save({ cacheMaxMb: v })} />
          </Field>
        </div>
        <Button
          onClick={async () => {
            await api().clearCache();
            setCacheBytes(0);
            toast('success', 'Cache cleared');
          }}
        >
          Clear cache
        </Button>
      </Card>

      <Card title="Pricing used for cost estimates (USD)">
        <p className="muted small">Set the prices from your provider's current price list. A value of 0 means "unknown" — costs are then shown as unknown instead of guessed.</p>
        <div className="form-grid">
          {(
            [
              ['anthropicInputPerMTok', 'Anthropic input / 1M tokens'],
              ['anthropicOutputPerMTok', 'Anthropic output / 1M tokens'],
              ['openaiInputPerMTok', 'OpenAI input / 1M tokens'],
              ['openaiOutputPerMTok', 'OpenAI output / 1M tokens'],
              ['openaiImagePerImage', 'OpenAI per image'],
              ['openaiTtsPerMChar', 'OpenAI TTS / 1M characters'],
              ['elevenlabsPerMChar', 'ElevenLabs / 1M characters'],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <NumberInput value={s.pricing[k]} min={0} max={10000} step={0.01} onCommit={(v) => save({ pricing: { ...s.pricing, [k]: v } })} />
            </Field>
          ))}
        </div>
      </Card>

      {info && (
        <Card title="System">
          <dl className="details">
            <dt>Version</dt>
            <dd>{info.appVersion}</dd>
            <dt>Electron / Node</dt>
            <dd>
              {info.electron} / {info.node}
            </dd>
            <dt>Platform</dt>
            <dd>{info.platform}</dd>
            <dt>FFmpeg</dt>
            <dd className={info.ffmpegOk ? '' : 'danger-text'}>{info.ffmpeg}</dd>
            <dt>Animation bundle</dt>
            <dd>{info.remotionBundle ? 'Ready' : <span className="danger-text">Missing — reinstall the app</span>}</dd>
            <dt>Data folder</dt>
            <dd className="mono small">{info.dataDir}</dd>
          </dl>
        </Card>
      )}
    </div>
  );
}

function CustomIconsField({ dir, onChoose }: { dir: string; onChoose: (d: string) => void }) {
  const [info, setInfo] = useState<{ found: string[]; expected: string[] } | null>(null);
  useEffect(() => {
    void api().customIcons().then(setInfo);
  }, [dir]);
  return (
    <Field
      label="My icons (optional)"
      hint={
        <>
          Put your own icons (SVG/PNG, e.g. licensed from Flaticon or The Noun Project) in a folder, named after the object: <span className="mono">house.svg</span>, <span className="mono">phone.png</span>… They replace the built-in ones.
          {info && (
            <>
              {' '}
              {dir ? `${info.found.length} icon(s) detected${info.found.length ? `: ${info.found.join(', ')}` : ''}.` : 'No folder selected.'}
              <details>
                <summary>Accepted names</summary>
                <span className="mono small">{info.expected.join(', ')}</span>
              </details>
            </>
          )}
        </>
      }
    >
      <div className="row gap-8 wrap">
        <Button onClick={async () => { const f = await api().chooseFolder(); if (f) onChoose(f); }}>Choose folder…</Button>
        <Button variant="ghost" onClick={async () => { await api().openCustomIconsFolder(); setInfo(await api().customIcons()); }}>Open folder</Button>
        {dir && <Button variant="ghost" onClick={() => onChoose('')}>Clear</Button>}
      </div>
    </Field>
  );
}

function TextInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input className="input" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onCommit(v.trim())} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />;
}

function PathInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  return (
    <div className="row gap-8">
      <TextInput value={value} onCommit={onCommit} />
      <Button onClick={async () => { const f = await api().chooseFile(); if (f) onCommit(f); }}>Browse</Button>
    </div>
  );
}

function NumberInput({ value, min, max, step, onCommit }: { value: number; min: number; max: number; step: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <input
      className="input"
      type="number"
      min={min}
      max={max}
      step={step}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = Math.min(max, Math.max(min, Number(v)));
        if (Number.isFinite(n) && n !== value) onCommit(n);
        else setV(String(value));
      }}
    />
  );
}

function SecretRow({ label, k, set, onChange }: { label: string; k: SecretKey; set: boolean; onChange: (s: SecretStatus) => void }) {
  const toast = useToast();
  const [value, setValue] = useState('');
  return (
    <div className="secret-row">
      <div className="secret-label">
        {label} {set ? <Badge tone="success">Saved</Badge> : <Badge>Not set</Badge>}
      </div>
      <div className="row gap-8">
        <input className="input" type="password" autoComplete="off" placeholder={set ? '•••••••••••• (stored securely)' : 'Paste key'} value={value} onChange={(e) => setValue(e.target.value)} />
        <Button
          variant="primary"
          disabled={!value.trim()}
          onClick={async () => {
            try {
              onChange(await api().setSecret(k, value));
              setValue('');
              toast('success', `${label} saved`);
            } catch (e) {
              toast('error', errorText(e));
            }
          }}
        >
          Save
        </Button>
        {set && (
          <Button
            variant="ghost"
            onClick={async () => {
              onChange(await api().setSecret(k, null));
              toast('info', `${label} removed`);
            }}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function TestButton({ kind, id }: { kind: 'llm' | 'image' | 'tts'; id: string }) {
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setState(null), [id]);
  return (
    <div className="test-btn">
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setState(await api().testProvider(kind, id));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Testing…' : `Test ${kind === 'llm' ? 'script' : kind === 'image' ? 'image' : 'voice'} provider`}
      </Button>
      {state && <span className={`small ${state.ok ? 'success-text' : 'danger-text'}`}>{state.ok ? <IconCheck size={12} /> : null} {state.message}</span>}
    </div>
  );
}

function VoicesCard({ s, save }: { s: Settings; save: (p: Partial<Settings>) => Promise<void> }) {
  const [lang, setLang] = useState<Language>(s.defaultLanguage);
  const [voices, setVoices] = useState<VoiceDTO[]>([]);
  const [downloads, setDownloads] = useState<Record<string, number>>({});
  const toast = useToast();
  const load = () => void api().listVoices(s.ttsProvider, lang).then(setVoices).catch(() => setVoices([]));
  useEffect(load, [s.ttsProvider, lang]);
  useEffect(
    () =>
      api().onVoiceDownload((e) => {
        setDownloads((d) => ({ ...d, [e.voiceId]: e.fraction }));
        if (e.done) {
          setDownloads((d) => {
            const { [e.voiceId]: _, ...rest } = d;
            void _;
            return rest;
          });
          load();
        }
        if (e.error) toast('error', e.error);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, s.ttsProvider],
  );

  return (
    <Card title="Voices">
      {s.ttsProvider === 'piper' && (
        <>
          <div className="row gap-8 mb-12">
            {LANGUAGES.map((l) => (
              <button key={l} className={`chip ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>
                {LANGUAGE_LABELS[l]}
              </button>
            ))}
          </div>
          <div className="form-grid">
            {(['female', 'male'] as const).map((g) => (
              <Field key={g} label={`${g === 'female' ? 'Female' : 'Male'} narrator (${LANGUAGE_LABELS[lang]})`}>
                <Select
                  value={s.voices.piper[`${lang}-${g}`] ?? ''}
                  onChange={(v) => save({ voices: { ...s.voices, piper: { ...s.voices.piper, [`${lang}-${g}`]: v } } })}
                  options={[{ value: '', label: 'Default' }, ...voices.map((v) => ({ value: v.id, label: v.label }))]}
                />
              </Field>
            ))}
          </div>
          <table className="table mt-12">
            <tbody>
              {voices.map((v) => (
                <tr key={v.id}>
                  <td>{v.label}</td>
                  <td className="muted small">{v.sizeMb} MB</td>
                  <td className="right">
                    {v.installed ? (
                      <Badge tone="success">Installed</Badge>
                    ) : downloads[v.id] !== undefined ? (
                      <span className="small muted">{Math.round(downloads[v.id]! * 100)}%</span>
                    ) : (
                      <Button size="sm" icon={<IconDownload size={14} />} onClick={() => { setDownloads((d) => ({ ...d, [v.id]: 0 })); void api().installVoice(v.id).catch(() => undefined); }}>
                        Download
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {s.ttsProvider === 'elevenlabs' && (
        <>
          <div className="row gap-8 mb-12">
            <Button
              size="sm"
              onClick={() =>
                void api()
                  .listVoices('elevenlabs', lang)
                  .then((v) => {
                    setVoices(v);
                    toast(v.length ? 'success' : 'error', v.length ? `${v.length} voices loaded.` : 'No voices returned — check your API key.');
                  })
                  .catch((err) => toast('error', errorText(err)))
              }
            >
              Load my voices
            </Button>
            <span className="small muted">Free plans can only use voices marked “free” (premade) or voices you created.</span>
          </div>
          <div className="form-grid">
            {(['male', 'female'] as const).map((g) => {
              const current = s.voices.elevenlabs[g];
              const set = (v: string) => save({ voices: { ...s.voices, elevenlabs: { ...s.voices.elevenlabs, [g]: v } } });
              return (
                <Field key={g} label={`${g === 'male' ? 'Male' : 'Female'} voice`}>
                  {voices.length > 0 ? (
                    <Select
                      value={current}
                      onChange={set}
                      options={[
                        { value: '', label: '— none —' },
                        ...(current && !voices.some((v) => v.id === current) ? [{ value: current, label: `${current} (not in your account)` }] : []),
                        ...[...voices]
                          .sort((a, b) => Number(b.category === 'premade') - Number(a.category === 'premade') || a.label.localeCompare(b.label))
                          .map((v) => ({ value: v.id, label: `${v.label}${v.gender !== 'unspecified' ? ` · ${v.gender}` : ''}${v.category === 'premade' ? ' · free' : v.category === 'cloned' || v.category === 'generated' ? ' · yours' : v.category ? ` · ${v.category}` : ''}` })),
                      ]}
                    />
                  ) : (
                    <TextInput value={current} onCommit={set} />
                  )}
                </Field>
              );
            })}
            <Field label="Model">
              <TextInput value={s.elevenlabsModel} onCommit={(v) => save({ elevenlabsModel: v })} />
            </Field>
          </div>
        </>
      )}
      {s.ttsProvider === 'openai' && (
        <div className="form-grid">
          <Field label="Male voice">
            <TextInput value={s.voices.openai.male} onCommit={(v) => save({ voices: { ...s.voices, openai: { ...s.voices.openai, male: v } } })} />
          </Field>
          <Field label="Female voice">
            <TextInput value={s.voices.openai.female} onCommit={(v) => save({ voices: { ...s.voices, openai: { ...s.voices.openai, female: v } } })} />
          </Field>
          <Field label="Model">
            <TextInput value={s.openaiTtsModel} onCommit={(v) => save({ openaiTtsModel: v })} />
          </Field>
        </div>
      )}
    </Card>
  );
}
