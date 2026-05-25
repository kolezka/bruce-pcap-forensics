<script lang="ts">
  import KpiCard from '$lib/ui/KpiCard.svelte';
  import { formatDuration } from '$lib/format';
  import { onMount } from 'svelte';
  let { data } = $props();

  let histogram = $state<{ ts_rel: number; type: number; subtype: number; count: number }[]>([]);
  onMount(async () => {
    const r = await fetch(`/api/captures/${data.capture.id}/packets?histogram=1`);
    histogram = await r.json();
  });

  const totals = $derived.by(() => {
    const t = { mgmt: 0, ctrl: 0, data: 0 } as Record<string, number>;
    for (const h of histogram) {
      const k = h.type === 0 ? 'mgmt' : h.type === 1 ? 'ctrl' : 'data';
      t[k] += h.count;
    }
    return t;
  });

  function binSeries() {
    const map = new Map<number, number>();
    for (const h of histogram) map.set(h.ts_rel, (map.get(h.ts_rel) ?? 0) + h.count);
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([ts, v]) => ({ ts, v }));
  }
  const maxBin = $derived(Math.max(1, ...binSeries().map((p) => p.v)));
</script>

<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
  <KpiCard label="Networks" value={data.networks.length} />
  <KpiCard label="Devices" value={data.devices.length} />
  <KpiCard label="Packets" value={data.capture.packet_count} />
  <KpiCard
    label="Duration"
    value={data.capture.first_ts_rel != null && data.capture.last_ts_rel != null
      ? formatDuration(data.capture.last_ts_rel - data.capture.first_ts_rel)
      : '—'}
  />
</div>

<div class="grid grid-cols-3 gap-3 mb-6">
  <KpiCard label="Mgmt" value={totals.mgmt} />
  <KpiCard label="Ctrl" value={totals.ctrl} />
  <KpiCard label="Data" value={totals.data} />
</div>

<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-4">
  <div class="text-xs text-[var(--color-fg-muted)] uppercase tracking-wide mb-3">Packets / time bin</div>
  <svg viewBox="0 0 800 160" class="w-full h-40">
    {#each binSeries() as p, i (i)}
      <rect
        x={i * (800 / Math.max(binSeries().length, 1))}
        y={160 - (p.v / maxBin) * 150}
        width={(800 / Math.max(binSeries().length, 1)) - 1}
        height={(p.v / maxBin) * 150}
        fill="var(--color-accent)"
        opacity="0.85"
      />
    {/each}
  </svg>
</div>
