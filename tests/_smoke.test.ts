import { test, expect } from 'bun:test';

test('tshark is installed and >=4', async () => {
  const proc = Bun.spawn(['tshark', '--version'], { stdout: 'pipe', stderr: 'pipe' });
  const code = await proc.exited;
  expect(code).toBe(0);
  const out = await new Response(proc.stdout).text();
  const m = out.split('\n')[0].match(/TShark.*?(\d+)\./);
  expect(m).toBeTruthy();
  expect(Number(m![1])).toBeGreaterThanOrEqual(4);
});

test('fixtures present', async () => {
  expect(await Bun.file('tests/fixtures/raw.pcap').exists()).toBe(true);
  expect(await Bun.file('tests/fixtures/deauth.pcap').exists()).toBe(true);
});
