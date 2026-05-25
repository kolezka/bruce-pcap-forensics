import chokidar from 'chokidar';
import { db } from './db';
import { ingestFile } from './ingest';
import { join } from 'node:path';

const CAPTURES_DIR = process.env.PCAP_CAPTURES_DIR ?? 'captures';
let started = false;

export function startWatcher(): void {
  if (started) return;
  started = true;
  const watcher = chokidar.watch(CAPTURES_DIR, {
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    depth: 0
  });
  watcher.on('add', async (path) => {
    if (!path.toLowerCase().match(/\.pcap(ng)?$/)) return;
    try {
      await ingestFile(db, path, 'watch');
      console.log('[watcher] ingested', path);
    } catch (e) {
      console.error('[watcher] ingest failed', path, e);
    }
  });
  console.log('[watcher] watching', join(process.cwd(), CAPTURES_DIR));
}
