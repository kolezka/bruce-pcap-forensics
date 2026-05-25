import { migrate } from '$lib/server/db';
import { startWatcher } from '$lib/server/watcher';
import { mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

migrate();

const CAPTURES_DIR = process.env.PCAP_CAPTURES_DIR ?? 'captures';
mkdirSync(CAPTURES_DIR, { recursive: true });

const samples = ['raw.pcap', 'deauth.pcap'];
const empty = !samples.some((s) => existsSync(join(CAPTURES_DIR, s)));
if (empty) {
  for (const s of samples) {
    if (existsSync(s)) copyFileSync(s, join(CAPTURES_DIR, s));
  }
}

startWatcher();
