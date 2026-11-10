import { afterEach, describe, expect, it } from 'vitest';
import { AnthropicLLMProvider } from '../../src/core/providers/llm/anthropicLlm';
import { OpenAILLMProvider } from '../../src/core/providers/llm/openaiLlm';
import { ElevenLabsTTSProvider, supportsLanguageCode, wordsFromCharAlignment } from '../../src/core/providers/tts/elevenlabsTts';
import { OpenAITTSProvider } from '../../src/core/providers/tts/openaiTts';
import { OfflineLLMProvider } from '../../src/core/providers/llm/offline/offlineLlm';
import { buildScriptRequest } from '../../src/core/script/scriptEngine';
import { encodeWav } from '../../src/core/audio/wav';
import { setFetchImplementation } from '../../src/core/util/http';
import { GenerationOptionsSchema } from '../../src/shared/schemas';
import { testContext } from '../helpers';

/**
 * Provider connectivity tests against recorded-shape HTTP responses. They verify
 * the exact requests each provider sends (endpoint, auth headers, structured
 * output settings) and that responses are parsed, validated and cost-tracked.
 * No real network calls are made; live checks use Settings → "Test provider".
 */
type Captured = { url: string; init: RequestInit & { headers: Headers } };
let captured: Captured[] = [];

function mockFetch(handler: (url: string, body: unknown) => { status?: number; json?: unknown; body?: Buffer; type?: string }) {
  captured = [];
  setFetchImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    const headers = new Headers(init?.headers as HeadersInit);
    captured.push({ url, init: { ...(init ?? {}), headers } });
    let body: unknown = undefined;
    if (typeof init?.body === 'string') body = JSON.parse(init.body);
    const r = handler(url, body);
    const status = r.status ?? 200;
    if (r.body) return new Response(new Uint8Array(r.body), { status, headers: { 'content-type': r.type ?? 'application/octet-stream' } });
    return new Response(JSON.stringify(r.json ?? {}), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
  });
}

afterEach(() => setFetchImplementation((i, init) => fetch(i, init)));

const options = GenerationOptionsSchema.parse({ topic: 'What if you received €1 million at age 18?', duration: '60', language: 'fr', narrator: 'auto', storytelling: 'hypothetical', visualStyle: 'minimal-finance' });
const req = buildScriptRequest(options);

async function sampleLlmScript() {
  const { ctx } = await testContext();
  const s = await new OfflineLLMProvider().generateScript(req, ctx);
  return {
    title: s.title,
    hook: s.hook,
    isHypothetical: true,
    assumptions: s.assumptions,
    claims: s.claims.map((c) => ({ ...c, source: '' })),
    scenes: s.scenes,
    finalLine: s.finalLine,
    hashtags: s.hashtags,
  };
}

describe('Anthropic provider', () => {
  it('reports a missing key without calling the network', () => {
    const p = new AnthropicLLMProvider(() => undefined, () => 'claude-opus-5-5');
    expect(p.checkReady()).toMatch(/API key/);
  });

  it('sends a structured-output Messages request and parses the script', async () => {
    const llmScript = await sampleLlmScript();
    mockFetch(() => ({
      json: {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: JSON.stringify(llmScript) }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1200, output_tokens: 800 },
      },
    }));
    const { ctx, usage } = await testContext();
    const p = new AnthropicLLMProvider(() => 'sk-ant-test-key-123456', () => 'claude-opus-5-5');
    const script = await p.generateScript(req, ctx);
    expect(script.title).toBe(llmScript.title);
    expect(script.generator).toEqual({ provider: 'anthropic', model: 'claude-opus-5-5' });
    const call = captured[0]!;
    expect(call.url).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/messages/);
    expect(call.init.headers.get('authorization') ?? call.init.headers.get('x-api-key')).toMatch(/sk-ant-test-key-123456$/);
    expect(call.init.headers.get('anthropic-version')).toBeTruthy();
    expect(call.init.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    const body = JSON.parse(String(call.init.body));
    expect(body.model).toBe('claude-opus-5-5');
    expect(body.fallbacks).toBe('default');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.output_config.effort).toBe('medium');
    expect(usage).toContainEqual(expect.objectContaining({ provider: 'anthropic', inputTokens: 1200, outputTokens: 800 }));

    // Identical request is served from the cache (no second HTTP call, recorded as cached).
    await p.generateScript(req, ctx);
    expect(captured.length).toBe(1);
    expect(usage).toContainEqual(expect.objectContaining({ provider: 'anthropic', cached: true }));
  });

  it('surfaces refusals and auth errors as useful messages', async () => {
    mockFetch(() => ({ json: { id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: 'refusal', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } }));
    const { ctx } = await testContext();
    const p = new AnthropicLLMProvider(() => 'sk-ant-test-key-123456', () => 'claude-opus-5-5');
    await expect(p.generateScript(req, ctx)).rejects.toThrow(/declined/);
    mockFetch(() => ({ status: 401, json: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }));
    const t = await p.testConnection(ctx);
    expect(t.ok).toBe(false);
    expect(t.message).toMatch(/Invalid API key/);
  });
});

describe('OpenAI providers', () => {
  it('uses the Responses API with a JSON schema text format', async () => {
    const llmScript = await sampleLlmScript();
    mockFetch(() => ({
      json: {
        id: 'resp_1',
        object: 'response',
        created_at: 1,
        status: 'completed',
        model: 'gpt-5',
        output: [{ type: 'message', id: 'msg', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(llmScript), annotations: [] }] }],
        usage: { input_tokens: 900, output_tokens: 700, total_tokens: 1600 },
      },
    }));
    const { ctx, usage } = await testContext();
    const p = new OpenAILLMProvider(() => 'sk-proj-testtesttesttest', () => 'gpt-5');
    const script = await p.generateScript(req, ctx);
    expect(script.scenes.length).toBe(llmScript.scenes.length);
    const call = captured[0]!;
    expect(call.url).toBe('https://api.openai.com/v1/responses');
    expect(call.init.headers.get('authorization')).toBe('Bearer sk-proj-testtesttesttest');
    const body = JSON.parse(String(call.init.body));
    expect(body.text.format.type).toBe('json_schema');
    expect(body.text.format.strict).toBe(true);
    expect(usage).toContainEqual(expect.objectContaining({ provider: 'openai', inputTokens: 900 }));
  });

  it('requests WAV speech and decodes it', async () => {
    const wav = encodeWav({ sampleRate: 24000, channels: [new Float32Array(24000).map((_, i) => Math.sin(i / 10) * 0.5)] });
    mockFetch(() => ({ body: wav, type: 'audio/wav' }));
    const { ctx } = await testContext();
    const p = new OpenAITTSProvider(() => 'sk-proj-testtesttesttest', () => 'gpt-4o-mini-tts', () => ({ male: 'onyx', female: 'nova' }));
    const r = await p.synthesize({ text: 'Bonjour', language: 'fr', voiceId: 'nova', speed: 1 }, ctx);
    expect(r.sampleRate).toBe(24000);
    expect(r.samples.length).toBe(24000);
    expect(captured[0]!.url).toBe('https://api.openai.com/v1/audio/speech');
    const body = JSON.parse(String(captured[0]!.init.body));
    expect(body).toMatchObject({ model: 'gpt-4o-mini-tts', voice: 'nova', response_format: 'wav', input: 'Bonjour' });
  });
});

describe('ElevenLabs provider', () => {
  it('groups character alignment into words', () => {
    const words = wordsFromCharAlignment({
      characters: [...'Un million'],
      character_start_times_seconds: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45],
      character_end_times_seconds: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5],
    });
    expect(words).toEqual([
      { text: 'Un', start: 0, end: 0.1 },
      { text: 'million', start: 0.15, end: 0.5 },
    ]);
  });

  it('calls /with-timestamps with the voice and returns PCM + word timings', async () => {
    const pcm = Buffer.alloc(24000 * 2);
    for (let i = 0; i < 24000; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 8) * 8000), i * 2);
    mockFetch(() => ({
      json: {
        audio_base64: pcm.toString('base64'),
        alignment: { characters: [...'Salut toi'], character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] },
      },
    }));
    const { ctx } = await testContext();
    const p = new ElevenLabsTTSProvider(() => 'xi-test-key-1234567890', () => 'eleven_multilingual_v2', () => ({ male: 'voiceM', female: 'voiceF' }));
    const voice = await p.resolveVoice('fr', 'female');
    const r = await p.synthesize({ text: 'Salut toi', language: 'fr', voiceId: voice.id, speed: 1 }, ctx);
    expect(captured[0]!.url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voiceF/with-timestamps?output_format=pcm_24000');
    expect(captured[0]!.init.headers.get('xi-api-key')).toBe('xi-test-key-1234567890');
    expect(r.alignment).toBe('provider-chars');
    expect(r.words?.map((w) => w.text)).toEqual(['Salut', 'toi']);
    expect(r.samples.length).toBe(24000);
    // multilingual v2 rejects language_code — it must not be sent.
    expect(JSON.parse(String(captured[0]!.init.body))).not.toHaveProperty('language_code');
  });

  it('sends language_code only to Turbo/Flash v2.5 models', () => {
    expect(supportsLanguageCode('eleven_flash_v2_5')).toBe(true);
    expect(supportsLanguageCode('eleven_turbo_v2_5')).toBe(true);
    expect(supportsLanguageCode('eleven_multilingual_v2')).toBe(false);
  });

  it('explains paid-plan-only voices and does not retry', async () => {
    mockFetch(() => ({ status: 402, json: { detail: { code: 'paid_plan_required' } } }));
    const { ctx } = await testContext();
    const p = new ElevenLabsTTSProvider(() => 'xi-test-key-1234567890', () => 'eleven_multilingual_v2', () => ({ male: 'm', female: 'f' }));
    await expect(p.synthesize({ text: 'x', language: 'fr', voiceId: 'f', speed: 1 }, ctx)).rejects.toMatchObject({ retryable: false, status: 402, message: expect.stringContaining('premade') });
  });

  it('marks rate limits as retryable', async () => {
    mockFetch(() => ({ status: 429, json: { detail: 'rate limited' } }));
    const { ctx } = await testContext();
    const p = new ElevenLabsTTSProvider(() => 'xi-test-key-1234567890', () => 'eleven_multilingual_v2', () => ({ male: 'm', female: 'f' }));
    await expect(p.synthesize({ text: 'x', language: 'fr', voiceId: 'f', speed: 1 }, ctx)).rejects.toMatchObject({ retryable: true, status: 429 });
  });
});
