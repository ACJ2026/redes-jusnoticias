import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from '../functions/api/whatsapp-channel.js';

const expectedName = 'JUSCHUBUT Noticias del Poder Judicial de Chubut';
const channelId = '0029VaGP0tX0lwgpiNAnBb1p';

test('identifies the exact WhatsApp channel and keeps its follower count unverified', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(
    `<meta property="og:title" content="${expectedName}">` +
    `<meta property="og:description" content="Channel &#x2022; 341 followers">` +
    `<span>Channel • 341 followers</span><a>${channelId}</a>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );

  const response = await onRequestGet();
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.channelIdentifierFound, true);
  assert.equal(data.channelName, expectedName);
  assert.equal(data.channelNameFound, true);
  assert.equal(data.followerCountCandidate, '341');
  assert.equal(data.followerCountVerified, false);
  assert.equal(JSON.stringify(data).includes('<span>'), false);
});

test('does not accept a different public title as the expected channel name', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(
    `<meta property="og:title" content="JUSCHUBUT Noticias de otra cuenta"><a>${channelId}</a>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );

  const response = await onRequestGet();
  const data = await response.json();

  assert.equal(data.channelIdentifierFound, true);
  assert.equal(data.channelNameFound, false);
  assert.equal(data.followerCountCandidate, null);
  assert.equal(data.followerCountVerified, false);
});
