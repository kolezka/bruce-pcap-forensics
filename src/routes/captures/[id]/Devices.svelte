<script lang="ts">
  import Drawer from '$lib/ui/Drawer.svelte';
  import MacBadge from '$lib/ui/MacBadge.svelte';
  import Pill from '$lib/ui/Pill.svelte';
  import { formatDuration } from '$lib/format';

  type Scope =
    | { kind: 'mac'; value: string }
    | { kind: 'clients_of'; bssid: string; ssid: string | null }
    | null;

  let {
    data,
    scope = null,
    onClearScope,
    gotoNetwork,
    gotoTimelineForActor
  } = $props<{
    data: any;
    scope?: Scope;
    onClearScope?: () => void;
    gotoNetwork: (bssid: string) => void;
    gotoTimelineForActor: (mac: string) => void;
  }>();

  type Dev = (typeof data.devices)[number];
  type Net = (typeof data.networks)[number];

  let sortKey = $state<'mac' | 'role' | 'packets_tx' | 'packets_rx'>('packets_tx');
  let sortDir = $state<1 | -1>(-1);
  let selected = $state<Dev | null>(null);
  let q = $state('');

  $effect(() => {
    if (scope?.kind === 'mac') q = scope.value;
    else if (scope?.kind === 'clients_of') q = '';
  });

  function probed(d: Dev): string[] { try { return JSON.parse(d.probed_ssids_json); } catch { return []; } }
  function channels(d: Dev): number[] { try { return JSON.parse(d.channels_json); } catch { return []; } }
  function assoc(d: Dev): string[] { try { return JSON.parse(d.associated_bssids_json); } catch { return []; } }

  function networkFor(bssid: string): Net | undefined {
    return data.networks.find((n: Net) => n.bssid === bssid);
  }

  function filtered(): Dev[] {
    const needle = q.trim().toLowerCase();
    return data.devices.filter((d: Dev) => {
      if (scope?.kind === 'clients_of') {
        if (!assoc(d).includes(scope.bssid)) return false;
      }
      if (!needle) return true;
      const hay =
        d.mac.toLowerCase() +
        '|' + (d.vendor ?? '').toLowerCase() +
        '|' + d.role.toLowerCase() +
        '|' + probed(d).join(',').toLowerCase() +
        '|' + assoc(d).join(',').toLowerCase() +
        '|' + channels(d).join(',');
      return hay.includes(needle);
    });
  }

  function sorted(): Dev[] {
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
</script>

<div class="mb-3 flex items-center gap-3">
  <input
    type="search"
    bind:value={q}
    placeholder="filter by MAC, vendor, role, probed SSID, channel…"
    class="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-3 py-1.5 text-sm placeholder-[var(--color-fg-muted)] focus:outline-none focus:border-[var(--color-accent)]"
  />
  <span class="text-xs text-[var(--color-fg-muted)] mono">{sorted().length}/{data.devices.length}</span>
  {#if q || scope}
    <button class="text-xs hover:underline" onclick={() => { q = ''; onClearScope?.(); }}>clear</button>
  {/if}
</div>

{#if scope?.kind === 'clients_of'}
  <div class="mb-3 flex items-center gap-2 text-sm">
    <Pill tone="info">clients of {scope.ssid ?? scope.bssid}</Pill>
    <button class="text-xs hover:underline" onclick={() => gotoNetwork(scope.bssid)}>view network →</button>
  </div>
{/if}

<table class="w-full text-sm">
  <thead class="text-left text-[var(--color-fg-muted)] sticky top-0 bg-[var(--color-bg)]">
    <tr>
      <th class="py-2 cursor-pointer" onclick={() => toggleSort('mac')}>MAC</th>
      <th class="py-2 cursor-pointer" onclick={() => toggleSort('role')}>Role</th>
      <th class="py-2 text-right cursor-pointer" onclick={() => toggleSort('packets_tx')}>TX</th>
      <th class="py-2 text-right cursor-pointer" onclick={() => toggleSort('packets_rx')}>RX</th>
      <th class="py-2">Channels</th>
      <th class="py-2">Probed SSIDs</th>
      <th class="py-2 text-right">Duration</th>
    </tr>
  </thead>
  <tbody>
    {#each sorted() as d (d.mac)}
      <tr class="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-elev)] cursor-pointer" onclick={() => (selected = d)}>
        <td class="py-2 pr-4"><MacBadge mac={d.mac} /></td>
        <td class="py-2 pr-4"><Pill tone={d.role === 'ap' ? 'info' : 'default'}>{d.role}</Pill></td>
        <td class="py-2 pr-4 text-right mono">{d.packets_tx}</td>
        <td class="py-2 pr-4 text-right mono">{d.packets_rx}</td>
        <td class="py-2 pr-4 mono text-xs">{channels(d).join(', ') || '—'}</td>
        <td class="py-2 pr-4 text-xs">
          {probed(d).slice(0, 3).join(', ')}{probed(d).length > 3 ? ` +${probed(d).length - 3}` : ''}
        </td>
        <td class="py-2 pr-4 text-right mono">{formatDuration(d.last_seen - d.first_seen)}</td>
      </tr>
    {/each}
  </tbody>
</table>

<Drawer open={!!selected} onClose={() => (selected = null)} title={selected?.mac ?? 'Device'}>
  {#if selected}
    <div class="grid grid-cols-2 gap-3 text-sm mb-4">
      <div><div class="text-xs text-[var(--color-fg-muted)]">MAC</div><MacBadge mac={selected.mac} /></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">Role</div><Pill tone={selected.role === 'ap' ? 'info' : 'default'}>{selected.role}</Pill></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">TX</div><span class="mono">{selected.packets_tx}</span></div>
      <div><div class="text-xs text-[var(--color-fg-muted)]">RX</div><span class="mono">{selected.packets_rx}</span></div>
    </div>

    <div class="flex gap-2 mb-4">
      <button
        class="text-xs rounded-md border border-[var(--color-border)] px-2 py-1 hover:border-[var(--color-accent)]"
        onclick={() => gotoTimelineForActor(selected!.mac)}
      >show in timeline</button>
    </div>

    <h3 class="text-xs uppercase text-[var(--color-fg-muted)] mt-4 mb-2">Probed SSIDs</h3>
    <div class="flex flex-wrap gap-1">
      {#each probed(selected) as s (s)}<Pill>{s || '<broadcast>'}</Pill>{/each}
      {#if probed(selected).length === 0}<span class="text-xs text-[var(--color-fg-muted)]">none</span>{/if}
    </div>

    <h3 class="text-xs uppercase text-[var(--color-fg-muted)] mt-4 mb-2">Associated BSSIDs</h3>
    <div class="flex flex-col gap-1">
      {#each assoc(selected) as b (b)}
        {@const net = networkFor(b)}
        <button
          class="text-left rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 hover:border-[var(--color-accent)]"
          onclick={() => gotoNetwork(b)}
        >
          <MacBadge mac={b} />
          {#if net?.ssid}<span class="ml-2 text-xs">{net.ssid}</span>{/if}
          {#if net}<span class="ml-2 text-xs text-[var(--color-fg-muted)] mono">ch {net.channel ?? '—'}</span>{/if}
        </button>
      {/each}
      {#if assoc(selected).length === 0}<span class="text-xs text-[var(--color-fg-muted)]">none</span>{/if}
    </div>

    <h3 class="text-xs uppercase text-[var(--color-fg-muted)] mt-4 mb-2">Channels seen</h3>
    <div class="flex gap-1 flex-wrap">
      {#each channels(selected) as c (c)}<Pill tone="default">{c}</Pill>{/each}
      {#if channels(selected).length === 0}<span class="text-xs text-[var(--color-fg-muted)]">none</span>{/if}
    </div>
  {/if}
</Drawer>
