import { spawn } from 'node:child_process';

const child = spawn('node', ['src/index.js'], {
  env: { ...process.env, TIKTOOLS_API_KEY: process.env.TIKTOOLS_API_KEY },
  stdio: ['pipe', 'pipe', 'inherit'],
});

let buf = '';
const pending = [];
child.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line) { try { pending.push(JSON.parse(line)); } catch {} }
  }
});

const send = (msg) => child.stdin.write(JSON.stringify(msg) + '\n');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function nextWithId(id, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const m = pending.find((p) => p.id === id);
    if (m) return m;
    await wait(100);
  }
  return null;
}

send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
await nextWithId(1);
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
await wait(200);

send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
const list = await nextWithId(2);
console.log('TOOLS:', (list?.result?.tools || []).map((t) => t.name).join(', '));

send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'check_live', arguments: { usernames: ['tv_asahi_news'] } } });
const call = await nextWithId(3, 15000);
console.log('CHECK_LIVE:', JSON.stringify(call?.result?.content?.[0]?.text || call).slice(0, 300));

send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_creator_profile', arguments: { username: 'tv_asahi_news' } } });
const gated = await nextWithId(4, 15000);
console.log('PROFILE(pro-gated):', JSON.stringify(gated?.result?.content?.[0]?.text || gated).slice(0, 220));

child.kill();
process.exit(0);
