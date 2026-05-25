const MAC_RE = /^([0-9a-f]{2})([:-]?)([0-9a-f]{2})\2([0-9a-f]{2})\2([0-9a-f]{2})\2([0-9a-f]{2})\2([0-9a-f]{2})$/i;

export function canonicalMac(mac: string | null | undefined): string | null {
  if (!mac) return null;
  const m = mac.match(MAC_RE);
  if (!m) return null;
  return [m[1], m[3], m[4], m[5], m[6], m[7]].join(':').toLowerCase();
}

export function decodeTsharkSsid(hex: string | null | undefined): string | null {
  if (hex === null || hex === undefined) return null;
  if (hex === '') return '';
  const bytes = hex.split(':').map((b) => parseInt(b, 16));
  if (bytes.some((n) => Number.isNaN(n))) return null;
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, seconds);
  const mm = Math.floor(total / 60);
  const ss = Math.floor(total % 60);
  const ms = Math.round((total - Math.floor(total)) * 1000);
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function vendorOuiKey(mac: string): string {
  return mac.replace(/:/g, '').slice(0, 6).toUpperCase();
}
