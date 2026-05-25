import { db } from './db';
import { readdir, stat } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import type { HandshakeRow } from '../types';

const CAPTURES_DIR = process.env.PCAP_CAPTURES_DIR ?? 'captures';
const WORDLISTS_DIR = process.env.PCAP_WORDLISTS_DIR ?? 'wordlists';

export interface Wordlist { name: string; bytes: number; }

export async function listWordlists(): Promise<Wordlist[]> {
  try {
    const entries = await readdir(WORDLISTS_DIR);
    const out: Wordlist[] = [];
    for (const name of entries) {
      const path = join(WORDLISTS_DIR, name);
      try {
        const s = await stat(path);
        if (s.isFile()) out.push({ name, bytes: s.size });
      } catch { /* skip */ }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export function getHandshake(id: number): HandshakeRow | null {
  return db.query<HandshakeRow, [number]>(`SELECT * FROM handshakes WHERE id=?`).get(id) as HandshakeRow | null;
}

export async function startCrack(handshakeId: number, wordlistName: string): Promise<void> {
  const hs = getHandshake(handshakeId);
  if (!hs) throw new Error('handshake not found');
  if (hs.crack_status === 'running') throw new Error('crack already running');

  const safe = basename(wordlistName);
  const wlPath = resolve(WORDLISTS_DIR, safe);
  const wlRoot = resolve(WORDLISTS_DIR) + '/';
  if (!wlPath.startsWith(wlRoot)) throw new Error('wordlist path escape');
  const wlFile = Bun.file(wlPath);
  if (!(await wlFile.exists())) throw new Error('wordlist not found: ' + safe);

  const cap = db
    .query<{ filename: string }, [number]>(`SELECT filename FROM captures WHERE id=?`)
    .get(hs.capture_id) as { filename: string } | null;
  if (!cap) throw new Error('capture not found');
  const pcapPath = join(CAPTURES_DIR, cap.filename);
  if (!(await Bun.file(pcapPath).exists())) throw new Error('pcap file missing on disk');

  db.run(
    `UPDATE handshakes SET crack_status='running', crack_password=NULL, crack_log='', crack_started_at=?, crack_finished_at=NULL, crack_keys_tested=NULL, crack_wordlist=? WHERE id=?`,
    [Date.now(), safe, handshakeId]
  );

  const proc = Bun.spawn(
    ['aircrack-ng', '-w', wlPath, '-b', hs.bssid, '-q', pcapPath],
    { stdout: 'pipe', stderr: 'pipe' }
  );

  runJob(proc, handshakeId).catch((e) => {
    db.run(
      `UPDATE handshakes SET crack_status='error', crack_log=?, crack_finished_at=? WHERE id=?`,
      [String(e).slice(0, 2000), Date.now(), handshakeId]
    );
  });
}

async function runJob(proc: ReturnType<typeof Bun.spawn>, handshakeId: number): Promise<void> {
  const decoder = new TextDecoder();
  let log = '';
  let keysTested: number | null = null;

  const KEYS_RE = /\b(\d{1,15})\s+keys tested/i;
  const FOUND_RE = /KEY FOUND!\s*\[\s*([^\]]+?)\s*\]/i;

  const reader = proc.stdout.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      log += decoder.decode(value, { stream: true });
      if (log.length > 32 * 1024) log = log.slice(-32 * 1024);

      const km = KEYS_RE.exec(log);
      if (km) keysTested = parseInt(km[1], 10);

      db.run(`UPDATE handshakes SET crack_log=?, crack_keys_tested=? WHERE id=?`, [log, keysTested, handshakeId]);
    }
  } finally {
    reader.releaseLock();
  }

  const code = await proc.exited;
  const found = FOUND_RE.exec(log);
  const notFound = /KEY NOT FOUND/i.test(log);
  let status: 'cracked' | 'not_found' | 'error';
  let password: string | null = null;
  if (found) { status = 'cracked'; password = found[1]; }
  else if (notFound || code === 0) status = 'not_found';
  else status = 'error';

  db.run(
    `UPDATE handshakes SET crack_status=?, crack_password=?, crack_log=?, crack_keys_tested=?, crack_finished_at=? WHERE id=?`,
    [status, password, log, keysTested, Date.now(), handshakeId]
  );
}
