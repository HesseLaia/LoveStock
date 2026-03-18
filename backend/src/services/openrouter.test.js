import assert from 'node:assert/strict';
import test from 'node:test';

import { OPENROUTER_CONFIG, buildPrompt, generateComment } from './openrouter.js';

test('buildPrompt includes required fields', () => {
  const p = buildPrompt('Growth Stock', 1234.56, 'A-', 'RARE FIND');
  assert.ok(p.includes('Growth Stock'));
  assert.ok(p.includes('$1234.56'));
  assert.ok(p.includes('A-'));
  assert.ok(p.includes('RARE FIND'));
});

test('generateComment returns fallback on non-ok response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({})
  });

  try {
    const c = await generateComment('Growth Stock', 100, 'C-', null);
    assert.equal(c, OPENROUTER_CONFIG.fallbackComment);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateComment returns fallback on timeout (AbortError)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    throw err;
  };

  try {
    const c = await generateComment('Growth Stock', 100, 'C-', null);
    assert.equal(c, OPENROUTER_CONFIG.fallbackComment);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

