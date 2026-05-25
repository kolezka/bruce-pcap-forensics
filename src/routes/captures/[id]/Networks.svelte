<script lang="ts">
  import Drawer from '$lib/ui/Drawer.svelte';
  import MacBadge from '$lib/ui/MacBadge.svelte';
  import EncryptionPill from '$lib/ui/EncryptionPill.svelte';
  import Pill from '$lib/ui/Pill.svelte';
  import { formatDuration } from '$lib/format';

  type Scope = { kind: 'bssid'; value: string } | null;

  let {
    data,
    scope = null,
    onClearScope,
    gotoDevicesOfNetwork,
    gotoDevice,
    gotoTimelineForActor
  } = $props<{
    data: any;
    scope?: Scope;
    onClearScope?: () => void;
    gotoDevicesOfNetwork: (bssid: string, ssid: string | null) => void;
    gotoDevice: (mac: string) => void;
    gotoTimelineForActor: (mac: string) => void;
  }>();

  type Net = (typeof data.networks)[number];
  type Dev = (typeof data.devices)[number];

  let sortKey = $state<'ssid' | 'beacon_count' | 'client_count' | 'channel'>('beacon_count');
  let sortDir = $state<1 | -1>(-1);
  let selected = $state<Net | null>(null);
  let q = $state('');

  // If scope changes (e.g. user clicked into a specific BSSID from devices),
  // surface that as the filter text initially for clarity.
  $effect(() => {
    if (scope?.kind === 'bssid') q = scope.value;
  });

  function filtered(): Net[] {
    const needle = q.trim().toLowerCase();
    return data.networks.filter((n: Net) => {
      if (!needle) return true;
      return (
        (n.ssid ?? '').toLowerCase().includes(needle) ||
        n.bssid.toLowerCase().includes(needle) ||
        (n.vendor ?? '').toLowerCase().includes(needle) ||
        n.encryption.toLowerCase().includes(needle) ||
        String(n.channel ?? '').includes(needle)
      );
    });
  }

  function sorted(): Net[] {
    return filtered().sort((a: any, b: any) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      return av > bv ? sortDir : av < bv ? -sortDir : 0;
    });
  }
  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) sortDir = (sortDir * -1) as 1 | -1;
    else { sortKey = k; sortDir = -1; }
  }

  function clientsOf(bssid: string): Dev[] {
    return data.devices.filter((d: Dev) => {
      try {
        const arr = JSON.parse(d.associated_bssids_json) as string[];
        return arr.includes(bssid);
      } catch { return false; }
    });
  }
</script>

<div class="mb-3 flex items-center gap-3">
  <input
    type="search"
    bind:value={q}
    placeholder="filter by SSID, BSSID, vendor, encryption, channel…"
    class="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-3 py-1.5 text-sm placeholder-[var(--color-fg-muted)] focus:outline-none focus:border-[var(--color-accent)]"
  />
  <span class="text-xs text-[var(--color-fg-muted)] mono">{sorted().length}/{data.networks.length}</span>
  {#if q || scope}
    <button class="text-xs hover:underline" onclick={() => { q = ''; onClearScope?.(); }}>clear</button>
  {/if}
</div>

<table class="w-full text-sm">
  <thead class="text-left text-[var(--color-fg-muted)] sticky top-0 bg-[var(--color-bg)]">
    <tr>
      <th class="py-2 cursor-pointer" onclick={() => toggleSort('ssid')}>SSID</th>
      <th class="py-2">BSSID</th>
      <th class="py-2 text-right cursor-pointer" onclick={() => toggleSort('channel')}>Ch</th>
      <th class="py-2">Encryption</th>
      <th class="py-2 text-right cursor-pointer" onclick={() => toggleSort('beacon_count')}>Beacons</th>
      <th class="py-2 text-right cursor-pointer" onclick={() => toggleSort('client_count')}>Clients</th>
      <th class="py-2 text-right">Duration</th>
    </tr>
  </thead>
  <tbody>
    {#each sorted() as n (n.bssid)}
      <tr class="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-elev)] cursor-pointer"
          onclick={() => (selected = n)}>
        <td class="py-2 pr-4">{n.ssid ?? '<hidden>'}</td>
        <td class="py-2 pr-4"><MacBadge mac={n.bssid} /></td>
        <td class="py-2 pr-4 text-right mono">{n.channel ?? '—'}</td>
        <td class="py-2 pr-4"><EncryptionPill encryption={n.encryption} /></td>
        <td class="py-2 pr-4 text-right mono">{n.beacon_count}</td>
        <td class="py-2 pr-4 text-right">
          {#if n.client_count > 0}
            <button
              class="mono text-[var(--color-accent)] hover:underline"
              onclick={(e) => { e.stopPropagation(); gotoDevicesOfNetwork(n.bssid, n.ssid); }}
              title="show clients of this network"
            >{n.client_count} →</button>
          {:else}
            <span class="mono text-[var(--color-fg-muted)]">0</span>
          {/if}
        </td>
        <td class="py-2 pr-4 text-right mono">{formatDuration(n.last_seen - n.first_seen)}</td>
      </tr>
    {/each}
  </tbody>
</table>

<Drawer open={!!selected} onClose={() => (selected = null)} title={selected?.ssid ?? selected?.bssid ?? 'Network'}>
  {#if selected}
    <div class="grid grid-cols-2 gap-3 text-sm mb-4">
      <div><div class="text-xs text-[var(--color-fg-muted)]">BSSID</div><MacBadge mac={selected.bssid} /></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">Channel</div><span class="mono">{selected.channel ?? '—'}</span></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">Encryption</div><EncryptionPill encryption={selected.encryption} /></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">Country</div>{selected.country ?? '—'}</div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">Beacons</div><span class="mono">{selected.beacon_count}</span></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">Clients</div><span class="mono">{selected.client_count}</span></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">First seen</div><span class="mono">{formatDuration(selected.first_seen)}</span></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">Last seen</div><span class="mono">{formatDuration(selected.last_seen)}</span></div>
    </div>

    <div class="flex gap-2 mb-4">
      <button
        class="text-xs rounded-md border border-[var(--color-border)] px-2 py-1 hover:border-[var(--color-accent)]"
        onclick={() => gotoTimelineForActor(selected!.bssid)}
      >show in timeline</button>
      {#if selected.client_count > 0}
        <button
          class="text-xs rounded-md border border-[var(--color-border)] px-2 py-1 hover:border-[var(--color-accent)]"
          onclick={() => gotoDevicesOfNetwork(selected!.bssid, selected!.ssid)}
        >view all clients →</button>
      {/if}
    </div>

    {#if clientsOf(selected.bssid).length > 0}
      <h3 class="text-xs uppercase text-[var(--color-fg-muted)] mb-2">Clients ({clientsOf(selected.bssid).length})</h3>
      <div class="space-y-1">
        {#each clientsOf(selected.bssid) as c (c.mac)}
          <button
            class="block w-full text-left rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 hover:border-[var(--color-accent)]"
            onclick={() => gotoDevice(c.mac)}
          >
            <MacBadge mac={c.mac} />
            <Pill tone={c.role === 'ap' ? 'info' : 'default'}>{c.role}</Pill>
            <span class="text-xs text-[var(--color-fg-muted)] mono ml-2">{c.packets_tx + c.packets_rx} pkts</span>
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</Drawer>
