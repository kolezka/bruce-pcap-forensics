<script lang="ts">
  import Overview from './Overview.svelte';
  import Networks from './Networks.svelte';
  import Devices from './Devices.svelte';
  import Handshakes from './Handshakes.svelte';
  import Timeline from './Timeline.svelte';
  import EventsSidebar from '$lib/ui/EventsSidebar.svelte';
  import Pill from '$lib/ui/Pill.svelte';
  import { formatDuration } from '$lib/format';

  let { data } = $props();
  let tab = $state<'overview' | 'networks' | 'devices' | 'handshakes' | 'timeline'>('overview');
  let scopedActor = $state<string | null>(null);
  let scopedRange = $state<{ from: number; to: number } | null>(null);

  // Cross-nav filters. The `scope` discriminates how to filter the table.
  // - networks: { kind: 'bssid', value } | { kind: 'free', value }
  // - devices: { kind: 'mac', value: string[] } | { kind: 'clients_of', bssid } | { kind: 'free', value }
  let networkScope = $state<NetworkScope | null>(null);
  let deviceScope = $state<DeviceScope | null>(null);

  type NetworkScope = { kind: 'bssid'; value: string };
  type DeviceScope =
    | { kind: 'mac'; value: string }
    | { kind: 'clients_of'; bssid: string; ssid: string | null };

  async function reparse() {
    if (!confirm('Re-parse this capture?')) return;
    const r = await fetch(`/api/captures/${data.capture.id}/reparse`, { method: 'POST' });
    if (!r.ok) alert('reparse failed');
    location.reload();
  }
  async function deleteCapture() {
    if (!confirm(`Delete ${data.capture.filename}? This also removes the pcap file from captures/.`)) return;
    const r = await fetch(`/api/captures/${data.capture.id}`, { method: 'DELETE' });
    if (!r.ok) { alert('delete failed'); return; }
    location.href = '/';
  }

  function onEventSelect(ev: any) {
    scopedRange = { from: ev.ts_rel_start, to: ev.ts_rel_end };
    try {
      const a = JSON.parse(ev.actors_json);
      scopedActor = a[0] ?? null;
    } catch { /* skip */ }
    tab = 'timeline';
  }

  function gotoDevicesOfNetwork(bssid: string, ssid: string | null) {
    deviceScope = { kind: 'clients_of', bssid, ssid };
    tab = 'devices';
  }
  function gotoDevice(mac: string) {
    deviceScope = { kind: 'mac', value: mac };
    tab = 'devices';
  }
  function gotoNetwork(bssid: string) {
    networkScope = { kind: 'bssid', value: bssid };
    tab = 'networks';
  }
  function gotoTimelineForActor(mac: string) {
    scopedActor = mac;
    scopedRange = null;
    tab = 'timeline';
  }
</script>

<div class="flex h-[calc(100vh-49px)]">
  <main class="flex-1 overflow-y-auto">
    <div class="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-border)] px-6 py-3 flex items-baseline gap-4">
      <h1 class="text-lg font-semibold mono">{data.capture.filename}</h1>
      <Pill tone={data.capture.status === 'ready' ? 'success' : data.capture.status === 'error' ? 'high' : 'info'}>
        {data.capture.status}
      </Pill>
      <span class="text-sm text-[var(--color-fg-muted)] mono">
        {data.capture.packet_count} pkts ·
        {data.capture.first_ts_rel != null && data.capture.last_ts_rel != null
          ? formatDuration(data.capture.last_ts_rel - data.capture.first_ts_rel)
          : '—'}
      </span>
      <span class="text-xs text-[var(--color-fg-muted)] mono">
        {#if data.capture.started_at}
          started: {new Date(data.capture.started_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })} UTC
        {:else}
          no RTC (relative time only)
        {/if}
      </span>
      <div class="flex-1"></div>
      <a
        class="text-sm hover:underline text-[var(--color-fg-muted)]"
        href={`/api/captures/${data.capture.id}/file`}
        download
      >download pcap</a>
      <button class="text-sm hover:underline text-[var(--color-fg-muted)]" onclick={reparse}>re-parse</button>
      <button class="text-sm hover:underline text-[var(--color-sev-high)]" onclick={deleteCapture}>delete</button>
    </div>

    <nav class="px-6 py-2 flex gap-4 border-b border-[var(--color-border)] text-sm">
      {#each ['overview','networks','devices','handshakes','timeline'] as t (t)}
        <button
          class={`pb-2 ${tab === t ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'}`}
          onclick={() => (tab = t as any)}
        >{t}</button>
      {/each}
    </nav>

    <div class="p-6">
      {#if tab === 'overview'}<Overview {data} />{/if}
      {#if tab === 'networks'}
        <Networks
          {data}
          scope={networkScope}
          onClearScope={() => (networkScope = null)}
          {gotoDevicesOfNetwork}
          {gotoDevice}
          {gotoTimelineForActor}
        />
      {/if}
      {#if tab === 'devices'}
        <Devices
          {data}
          scope={deviceScope}
          onClearScope={() => (deviceScope = null)}
          {gotoNetwork}
          {gotoTimelineForActor}
        />
      {/if}
      {#if tab === 'handshakes'}<Handshakes {data} {gotoNetwork} {gotoDevice} />{/if}
      {#if tab === 'timeline'}<Timeline {data} {scopedActor} {scopedRange} />{/if}
    </div>
  </main>
  <EventsSidebar events={data.events} onSelect={onEventSelect} />
</div>
