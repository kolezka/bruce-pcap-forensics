<script lang="ts">
  import MacBadge from '$lib/ui/MacBadge.svelte';
  import Pill from '$lib/ui/Pill.svelte';
  import Drawer from '$lib/ui/Drawer.svelte';

  let { data } = $props();
  type Dev = (typeof data.devices)[number];

  let q = $state('');
  let sortKey = $state<'mac' | 'role' | 'packets_tx' | 'packets_rx' | 'captures'>('packets_tx');
  let sortDir = $state<1 | -1>(-1);
  let selected = $state<Dev | null>(null);

  function filtered(): Dev[] {
    const needle = q.trim().toLowerCase();
    return data.devices.filter((d: Dev) => {
      if (!needle) return true;
      const hay = (
        d.mac + '|' +
        (d.vendor ?? '') + '|' +
        d.role + '|' +
        d.probed_ssids.join(',') + '|' +
        d.associated_bssids.join(',') + '|' +
        d.channels.join(',')
      ).toLowerCase();
      return hay.includes(needle);
    });
  }

  function sorted(): Dev[] {
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
  <h1 class="text-xl font-semibold mb-4">All devices <span class="text-[var(--color-fg-muted)] font-normal text-base">across {new Set(data.devices.flatMap((d: Dev) => d.captures.map((c: any) => c.id))).size} capture(s)</span></h1>

  <div class="mb-3 flex items-center gap-3">
    <input
      type="search"
      bind:value={q}
      placeholder="filter by MAC, vendor, role, probed SSID, BSSID, channel…"
      class="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-3 py-1.5 text-sm placeholder-[var(--color-fg-muted)] focus:outline-none focus:border-[var(--color-accent)]"
    />
    <span class="text-xs text-[var(--color-fg-muted)] mono">{sorted().length}/{data.devices.length}</span>
  </div>

  <table class="w-full text-sm">
    <thead class="text-left text-[var(--color-fg-muted)] sticky top-0 bg-[var(--color-bg)]">
      <tr>
        <th class="py-2 cursor-pointer" onclick={() => toggleSort('mac')}>MAC</th>
        <th class="py-2 cursor-pointer" onclick={() => toggleSort('role')}>Role</th>
        <th class="py-2 text-right cursor-pointer" onclick={() => toggleSort('packets_tx')}>TX</th>
        <th class="py-2 text-right cursor-pointer" onclick={() => toggleSort('packets_rx')}>RX</th>
        <th class="py-2">Channels</th>
        <th class="py-2">Probed SSIDs</th>
        <th class="py-2 text-right cursor-pointer" onclick={() => toggleSort('captures')}>Captures</th>
      </tr>
    </thead>
    <tbody>
      {#each sorted() as d (d.mac)}
        <tr class="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-elev)] cursor-pointer" onclick={() => (selected = d)}>
          <td class="py-2 pr-4"><MacBadge mac={d.mac} /></td>
          <td class="py-2 pr-4"><Pill tone={d.role === 'ap' ? 'info' : 'default'}>{d.role}</Pill></td>
          <td class="py-2 pr-4 text-right mono">{d.packets_tx}</td>
          <td class="py-2 pr-4 text-right mono">{d.packets_rx}</td>
          <td class="py-2 pr-4 mono text-xs">{d.channels.join(', ') || '—'}</td>
          <td class="py-2 pr-4 text-xs">
            {d.probed_ssids.slice(0, 3).join(', ')}{d.probed_ssids.length > 3 ? ` +${d.probed_ssids.length - 3}` : ''}
          </td>
          <td class="py-2 pr-4 text-right mono">{d.captures.length}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<Drawer open={!!selected} onClose={() => (selected = null)} title={selected?.mac ?? 'Device'}>
  {#if selected}
    <div class="grid grid-cols-2 gap-3 text-sm mb-4">
      <div><div class="text-xs text-[var(--color-fg-muted)]">MAC</div><MacBadge mac={selected.mac} /></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">Role</div><Pill tone={selected.role === 'ap' ? 'info' : 'default'}>{selected.role}</Pill></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">TX (total)</div><span class="mono">{selected.packets_tx}</span></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">RX (total)</div><span class="mono">{selected.packets_rx}</span></div>
    </div>

    <h3 class="text-xs uppercase text-[var(--color-fg-muted)] mt-4 mb-2">Probed SSIDs ({selected.probed_ssids.length})</h3>
    <div class="flex flex-wrap gap-1">
      {#each selected.probed_ssids as s (s)}<Pill>{s || '<broadcast>'}</Pill>{/each}
      {#if selected.probed_ssids.length === 0}<span class="text-xs text-[var(--color-fg-muted)]">none</span>{/if}
    </div>

    <h3 class="text-xs uppercase text-[var(--color-fg-muted)] mt-4 mb-2">Associated BSSIDs ({selected.associated_bssids.length})</h3>
    <div class="flex flex-col gap-1">
      {#each selected.associated_bssids as b (b)}<MacBadge mac={b} />{/each}
      {#if selected.associated_bssids.length === 0}<span class="text-xs text-[var(--color-fg-muted)]">none</span>{/if}
    </div>

    <h3 class="text-xs uppercase text-[var(--color-fg-muted)] mt-4 mb-2">Channels seen</h3>
    <div class="flex gap-1 flex-wrap">
      {#each selected.channels as c (c)}<Pill tone="default">{c}</Pill>{/each}
      {#if selected.channels.length === 0}<span class="text-xs text-[var(--color-fg-muted)]">none</span>{/if}
    </div>

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
