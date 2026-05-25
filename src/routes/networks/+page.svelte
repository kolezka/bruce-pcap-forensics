<script lang="ts">
  import MacBadge from '$lib/ui/MacBadge.svelte';
  import EncryptionPill from '$lib/ui/EncryptionPill.svelte';
  import Pill from '$lib/ui/Pill.svelte';
  import Drawer from '$lib/ui/Drawer.svelte';

  let { data } = $props();
  type Net = (typeof data.networks)[number];

  let q = $state('');
  let sortKey = $state<'beacon_total' | 'client_total' | 'captures' | 'bssid'>('beacon_total');
  let sortDir = $state<1 | -1>(-1);
  let selected = $state<Net | null>(null);

  function filtered(): Net[] {
    const needle = q.trim().toLowerCase();
    return data.networks.filter((n: Net) => {
      if (!needle) return true;
      return (
        n.bssid.toLowerCase().includes(needle) ||
        (n.vendor ?? '').toLowerCase().includes(needle) ||
        n.encryption.toLowerCase().includes(needle) ||
        n.ssids.some((s: string) => s.toLowerCase().includes(needle)) ||
        n.channels.some((c: number) => String(c).includes(needle))
      );
    });
  }

  function sorted(): Net[] {
    return filtered().sort((a: any, b: any) => {
      const av = sortKey === 'captures' ? a.captures.length : a[sortKey];
      const bv = sortKey === 'captures' ? b.captures.length : b[sortKey];
      return av > bv ? sortDir : av < bv ? -sortDir : 0;
    });
  }
  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) sortDir = (sortDir * -1) as 1 | -1;
    else { sortKey = k; sortDir = -1; }
  }
</script>

<section class="p-6">
  <h1 class="text-xl font-semibold mb-4">All networks <span class="text-[var(--color-fg-muted)] font-normal text-base">across {new Set(data.networks.flatMap((n: Net) => n.captures.map((c: any) => c.id))).size} capture(s)</span></h1>

  <div class="mb-3 flex items-center gap-3">
    <input
      type="search"
      bind:value={q}
      placeholder="filter by SSID, BSSID, vendor, encryption, channel…"
      class="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-3 py-1.5 text-sm placeholder-[var(--color-fg-muted)] focus:outline-none focus:border-[var(--color-accent)]"
    />
    <span class="text-xs text-[var(--color-fg-muted)] mono">{sorted().length}/{data.networks.length}</span>
  </div>

  <table class="w-full text-sm">
    <thead class="text-left text-[var(--color-fg-muted)] sticky top-0 bg-[var(--color-bg)]">
      <tr>
        <th class="py-2">SSID</th>
        <th class="py-2 cursor-pointer" onclick={() => toggleSort('bssid')}>BSSID</th>
        <th class="py-2">Channels</th>
        <th class="py-2">Encryption</th>
        <th class="py-2 text-right cursor-pointer" onclick={() => toggleSort('beacon_total')}>Beacons</th>
        <th class="py-2 text-right cursor-pointer" onclick={() => toggleSort('client_total')}>Clients</th>
        <th class="py-2 text-right cursor-pointer" onclick={() => toggleSort('captures')}>Captures</th>
      </tr>
    </thead>
    <tbody>
      {#each sorted() as n (n.bssid)}
        <tr class="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-elev)] cursor-pointer" onclick={() => (selected = n)}>
          <td class="py-2 pr-4">
            {n.ssid ?? '<hidden>'}
            {#if n.ssids.length > 1}
              <span class="text-xs text-[var(--color-fg-muted)] mono ml-1">+{n.ssids.length - 1}</span>
            {/if}
          </td>
          <td class="py-2 pr-4"><MacBadge mac={n.bssid} /></td>
          <td class="py-2 pr-4 mono text-xs">{n.channels.join(', ') || '—'}</td>
          <td class="py-2 pr-4"><EncryptionPill encryption={n.encryption} /></td>
          <td class="py-2 pr-4 text-right mono">{n.beacon_total}</td>
          <td class="py-2 pr-4 text-right mono">{n.client_total}</td>
          <td class="py-2 pr-4 text-right mono">{n.captures.length}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<Drawer open={!!selected} onClose={() => (selected = null)} title={selected?.ssid ?? selected?.bssid ?? 'Network'}>
  {#if selected}
    <div class="grid grid-cols-2 gap-3 text-sm mb-4">
      <div><div class="text-xs text-[var(--color-fg-muted)]">BSSID</div><MacBadge mac={selected.bssid} /></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">Encryption</div><EncryptionPill encryption={selected.encryption} /></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">Beacons (total)</div><span class="mono">{selected.beacon_total}</span></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">Max clients</div><span class="mono">{selected.client_total}</span></div>
    </div>

    {#if selected.ssids.length > 0}
      <h3 class="text-xs uppercase text-[var(--color-fg-muted)] mt-4 mb-2">SSIDs advertised</h3>
      <div class="flex flex-wrap gap-1">
        {#each selected.ssids as s (s)}<Pill>{s}</Pill>{/each}
      </div>
    {/if}

    <h3 class="text-xs uppercase text-[var(--color-fg-muted)] mt-4 mb-2">Channels seen</h3>
    <div class="flex gap-1 flex-wrap">
      {#each selected.channels as c (c)}<Pill tone="default">{c}</Pill>{/each}
      {#if selected.channels.length === 0}<span class="text-xs text-[var(--color-fg-muted)]">none</span>{/if}
    </div>

    {#if selected.countries.length > 0}
      <h3 class="text-xs uppercase text-[var(--color-fg-muted)] mt-4 mb-2">Country codes</h3>
      <div class="flex gap-1 flex-wrap">
        {#each selected.countries as c (c)}<Pill tone="default">{c}</Pill>{/each}
      </div>
    {/if}

    <h3 class="text-xs uppercase text-[var(--color-fg-muted)] mt-4 mb-2">Seen in captures ({selected.captures.length})</h3>
    <div class="space-y-1">
      {#each selected.captures as c (c.id)}
        <a class="block rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 hover:border-[var(--color-accent)] text-xs mono"
          href={`/captures/${c.id}`}>
          {c.filename}
        </a>
      {/each}
    </div>
  {/if}
</Drawer>
