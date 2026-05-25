// Regenerate the bundled vendor list. Run with: bun scripts/build-oui.ts
const SRC = 'https://standards-oui.ieee.org/oui/oui.txt';
console.log('fetching', SRC);
const res = await fetch(SRC);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const txt = await res.text();
const map: Record<string, string> = {};
for (const raw of txt.split('\n')) {
  const line = raw.replace(/\r$/, '');
  const m = line.match(/^([0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2})\s+\(hex\)\s+(.+)$/);
  if (m) map[m[1].replace(/-/g, '').toUpperCase()] = m[2].trim();
}
await Bun.write('src/lib/oui-data.json', JSON.stringify(map));
console.log('wrote', Object.keys(map).length, 'OUIs');
