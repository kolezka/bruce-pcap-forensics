import { resolve } from 'node:path';

export type FetchOptions = { force?: boolean; includeCrackstation?: boolean; crunchBig?: boolean };

export type FetchJobState = {
  status: 'idle' | 'running' | 'done' | 'error';
  log: string;
  startedAt: number | null;
  finishedAt: number | null;
  exitCode: number | null;
  options: FetchOptions | null;
};

const state: FetchJobState = {
  status: 'idle',
  log: '',
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  options: null,
};

let currentProc: ReturnType<typeof Bun.spawn> | null = null;

export function getFetchState(): FetchJobState {
  return { ...state, log: state.log.slice(-16 * 1024) };
}

export function startFetch(opts: FetchOptions): void {
  if (state.status === 'running') throw new Error('fetch already running');
  state.status = 'running';
  state.log = '';
  state.startedAt = Date.now();
  state.finishedAt = null;
  state.exitCode = null;
  state.options = opts;

  const args = ['bash', resolve('scripts/fetch-wordlists.sh')];
  if (opts.force) args.push('--force');
  if (!opts.includeCrackstation) args.push('--skip-crackstation');
  if (opts.crunchBig) args.push('--crunch-big');

  const proc = Bun.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
  currentProc = proc;
  void pipe(proc.stdout as ReadableStream<Uint8Array>);
  void pipe(proc.stderr as ReadableStream<Uint8Array>);
  void proc.exited.then((code) => {
    state.exitCode = code;
    state.status = code === 0 ? 'done' : 'error';
    state.finishedAt = Date.now();
    if (currentProc === proc) currentProc = null;
  });
}

async function pipe(stream: ReadableStream<Uint8Array> | undefined): Promise<void> {
  if (!stream) return;
  const dec = new TextDecoder();
  const reader = stream.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      state.log += dec.decode(value, { stream: true });
      if (state.log.length > 64 * 1024) state.log = state.log.slice(-64 * 1024);
    }
  } finally {
    reader.releaseLock();
  }
}

export function sanitizeSsid(raw: string): string {
  const cleaned = raw.replace(/[^\w.\-]/g, '_').slice(0, 32);
  if (!cleaned || cleaned === '_'.repeat(cleaned.length)) {
    throw new Error('ssid has no filename-safe characters');
  }
  return cleaned;
}

export async function genSsidList(rawSsid: string): Promise<{ path: string; lines: number }> {
  const safe = sanitizeSsid(rawSsid);
  const proc = Bun.spawn(
    ['bash', resolve('scripts/gen-crunch.sh'), 'ssid-suffix', safe],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  const [code, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stderr as ReadableStream<Uint8Array>).text(),
  ]);
  if (code !== 0) throw new Error('gen-crunch failed: ' + stderr.slice(0, 500));
  const rel = `generated/ssid-${safe}.txt`;
  const f = Bun.file(resolve(process.env.PCAP_WORDLISTS_DIR ?? 'wordlists', rel));
  const text = await f.text().catch(() => '');
  const lines = text ? text.split('\n').filter(Boolean).length : 0;
  return { path: rel, lines };
}
