import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testContext } from '../helpers';

/**
 * The streamed "write code" call against a local fake of the Messages API: progress is
 * reported, keep-alive pings keep a silent stream alive, and a stalled stream is aborted
 * instead of waiting forever.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let server: http.Server;
let mode = 'normal';

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    for await (const _ of req) void _;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const send = (ev: string, data: unknown) => res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
    send('message_start', { type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } });
    if (mode === 'stall') {
      await sleep(5000);
      return res.end();
    }
    if (mode === 'pings') for (let i = 0; i < 4; i++) {
      await sleep(400);
      res.write('event: ping\ndata: {"type":"ping"}\n\n');
    }
    send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    for (const t of ['```js\nSHOTS', '.push({});\n```']) {
      await sleep(50);
      send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } });
    }
    send('content_block_stop', { type: 'content_block_stop', index: 0 });
    send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 7 } });
    send('message_stop', { type: 'message_stop' });
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.FVS_STREAM_STALL_MS = '1000';
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.FVS_STREAM_STALL_MS;
});

async function provider() {
  const { AnthropicLLMProvider } = await import('../../src/core/providers/llm/anthropicLlm');
  return new AnthropicLLMProvider(() => 'sk-ant-test-0000000000', () => 'claude-opus-5-5');
}

describe('Anthropic streamed code answers', () => {
  it('streams the answer and reports progress', async () => {
    mode = 'normal';
    const { ctx } = await testContext();
    const phases: string[] = [];
    const text = await (await provider()).writeText({ name: 't', system: 's', prompt: 'p', onProgress: (e) => phases.push(e.phase) }, ctx, false);
    expect(text).toBe('```js\nSHOTS.push({});\n```');
    expect(phases[0]).toBe('connecting');
  });

  it('keep-alive pings keep a long silent stream alive', async () => {
    mode = 'pings';
    const { ctx } = await testContext();
    await expect((await provider()).writeText({ name: 't', system: 's', prompt: 'p2' }, ctx, false)).resolves.toContain('SHOTS');
  });

  it('aborts a stalled stream with a retryable error instead of hanging', async () => {
    mode = 'stall';
    const { ctx } = await testContext();
    await expect((await provider()).writeText({ name: 't', system: 's', prompt: 'p3' }, ctx, false)).rejects.toMatchObject({ retryable: true, message: expect.stringContaining('stalled') });
  }, 15000);
});
