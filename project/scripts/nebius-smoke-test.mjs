// Manual Nebius Token Factory Integration Smoke Test
// HARD BUDGET SAFEGUARD: This script NEVER runs during regular test suites (npm run test:backend).
// It only runs when explicitly invoked with SOMNIA_ENABLE_LIVE_TEST=true.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve('.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

const apiKey = process.env.SOMNIA_AI_API_KEY?.trim();
const model = process.env.SOMNIA_AI_MODEL?.trim() || 'nvidia/nemotron-3-super-120b-a12b';
const baseUrl = (process.env.SOMNIA_AI_BASE_URL?.trim() || 'https://api.tokenfactory.nebius.com/v1').replace(/\/+$/, '');
const isLiveEnabled = process.env.SOMNIA_ENABLE_LIVE_TEST === 'true';

console.log('────────────────────────────────────────────────────────────');
console.log('Nebius Token Factory & NVIDIA Nemotron Live Smoke Test');
console.log('────────────────────────────────────────────────────────────');

if (!isLiveEnabled) {
  console.log('\n[SAFEGUARD ACTIVE] Live test was NOT executed.');
  console.log('Reason: SOMNIA_ENABLE_LIVE_TEST is not set to "true".');
  console.log('\nTo protect your ₹0 budget, live API calls are strictly opt-in.');
  console.log('When you have verified that your Nebius promotional credits are active');
  console.log('and require no credit card, you can manually run:');
  console.log('\n  SOMNIA_ENABLE_LIVE_TEST=true node scripts/nebius-smoke-test.mjs\n');
  process.exit(0);
}

if (!apiKey) {
  console.error('\n[CONFIG ERROR] SOMNIA_AI_API_KEY is not set in your environment or .env file.');
  console.error('Add your key to project/.env to test live connectivity.');
  process.exit(1);
}

console.log(`Target URL : ${baseUrl}/chat/completions`);
console.log(`Model      : ${model}`);
console.log('Sending lightweight probe (1 token test)...');

const start = Date.now();
try {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Respond with the word "READY" only.' }],
      max_tokens: 5,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const elapsed = Date.now() - start;
  if (!response.ok) {
    console.error(`\n[FAILED] Nebius returned HTTP ${response.status} (${response.statusText}) in ${elapsed}ms.`);
    const errorText = await response.text();
    console.error('Details:', errorText.slice(0, 300));
    process.exit(1);
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();
  console.log(`\n[SUCCESS] Connected to ${model} via Nebius Token Factory in ${elapsed}ms!`);
  console.log(`Probe response: "${reply}"`);
  console.log('Smoke test passed cleanly.');
} catch (error) {
  const elapsed = Date.now() - start;
  console.error(`\n[FAILED] Request failed after ${elapsed}ms:`, error.message);
  process.exit(1);
}

