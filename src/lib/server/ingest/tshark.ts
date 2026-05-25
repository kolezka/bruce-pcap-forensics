export interface TsharkRow {
  timestamp: string;
  layers: {
    frame: Record<string, any>;
    wlan?: Record<string, any>;
    wlan_wlan_mgt?: Record<string, any>;
    [k: string]: any;
  };
}

/**
 * Stream packets from a pcap using `tshark -T ek` (Elasticsearch ndjson).
 * tshark emits two lines per packet:
 *   {"index":{...}}
 *   {"timestamp":"...","layers":{...}}
 * We yield only the second.
 */
export async function* streamPackets(pcapPath: string): AsyncGenerator<TsharkRow> {
  const proc = Bun.spawn(['tshark', '-r', pcapPath, '-n', '-T', 'ek', '-E', 'header=n'], {
    stdout: 'pipe',
    stderr: 'pipe'
  });

  const decoder = new TextDecoder();
  let buf = '';
  const reader = proc.stdout.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let obj: any;
        try { obj = JSON.parse(line); } catch { continue; }
        if (obj.index) continue;
        if (obj.layers) yield obj as TsharkRow;
      }
    }
  } finally {
    reader.releaseLock();
  }

  const code = await proc.exited;
  if (code !== 0) {
    const errText = await new Response(proc.stderr).text();
    throw new Error(`tshark exited ${code}: ${errText.slice(0, 500)}`);
  }
}

/** First-packet encap_type peek: 127 = radiotap, 20 = plain 802.11. */
export async function detectRadiotap(pcapPath: string): Promise<boolean> {
  const proc = Bun.spawn(
    ['tshark', '-r', pcapPath, '-c', '1', '-T', 'fields', '-e', 'frame.encap_type'],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) throw new Error(`tshark encap probe exited ${code}`);
  return out.trim() === '127';
}
