<script lang="ts">
  import MacBadge from '$lib/ui/MacBadge.svelte';
  import Pill from '$lib/ui/Pill.svelte';
  import { onMount } from 'svelte';
  let { data, scopedActor, scopedRange } = $props<{
    data: any; scopedActor: string | null; scopedRange: { from: number; to: number } | null;
  }>();

  let page = $state(0);
  let typeFilter = $state<number | null>(null);
  let packets = $state<any[]>([]);
  let loading = $state(false);
  let expanded = $state<Set<number>>(new Set());

  async function load() {
    loading = true;
    const q = new URLSearchParams();
    q.set('limit', '200');
    q.set('offset', String(page * 200));
    if (typeFilter !== null) q.set('type', String(typeFilter));
    if (scopedActor) q.set('ta', scopedActor);
    if (scopedRange) { q.set('from', String(scopedRange.from)); q.set('to', String(scopedRange.to)); }
    const r = await fetch(`/api/captures/${data.capture.id}/packets?${q}`);
    packets = await r.json();
    loading = false;
  }
  onMount(load);
  $effect(() => { page; typeFilter; scopedActor; scopedRange; load(); });

  function toggle(id: number) {
    const s = new Set(expanded);
    s.has(id) ? s.delete(id) : s.add(id);
    expanded = s;
  }
</script>

<div class="mb-3 flex gap-2 items-center text-sm">
  <span class="text-[var(--color-fg-muted)]">type:</span>
  <button class={typeFilter === null ? 'underline' : ''} onclick={() => (typeFilter = null)}>all</button>
  <button class={typeFilter === 0 ? 'underline' : ''} onclick={() => (typeFilter = 0)}>mgmt</button>
  <button class={typeFilter === 1 ? 'underline' : ''} onclick={() => (typeFilter = 1)}>ctrl</button>
  <button class={typeFilter === 2 ? 'underline' : ''} onclick={() => (typeFilter = 2)}>data</button>
  {#if scopedActor}<Pill tone="info">scope: TA={scopedActor}</Pill>{/if}
  {#if scopedRange}<Pill tone="info">range: {scopedRange.from.toFixed(2)}s–{scopedRange.to.toFixed(2)}s</Pill>{/if}
  <div class="flex-1"></div>
  <button disabled={page === 0} onclick={() => (page = Math.max(0, page - 1))}>prev</button>
  <span class="mono">page {page + 1}</span>
  <button onclick={() => (page = page + 1)}>next</button>
</div>

<table class="w-full text-xs">
  <thead class="text-left text-[var(--color-fg-muted)] sticky top-0 bg-[var(--color-bg)]">
    <tr>
      <th class="py-1">#</th><th class="py-1">t</th><th class="py-1">type</th>
      <th class="py-1">ta</th><th class="py-1">ra</th><th class="py-1">bssid</th><th class="py-1">extra</th>
    </tr>
  </thead>
  <tbody>
    {#each packets as p (p.id)}
      <tr class="border-t border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg-elev)]" onclick={() => toggle(p.id)}>
        <td class="py-1 mono">{p.frame_no}</td>
        <td class="py-1 mono">{p.ts_rel.toFixed(3)}</td>
        <td class="py-1">{p.type_name}</td>
        <td class="py-1">{#if p.ta}<MacBadge mac={p.ta} />{/if}</td>
        <td class="py-1">{#if p.ra}<MacBadge mac={p.ra} />{/if}</td>
        <td class="py-1">{#if p.bssid}<MacBadge mac={p.bssid} />{/if}</td>
        <td class="py-1 mono">{p.ssid ?? ''}{p.reason_code != null ? ` r=${p.reason_code}` : ''}</td>
      </tr>
      {#if expanded.has(p.id)}
        <tr class="bg-[var(--color-bg-elev)]">
          <td colspan="7" class="p-3 mono whitespace-pre-wrap">{JSON.stringify(p, null, 2)}</td>
        </tr>
      {/if}
    {/each}
    {#if loading}<tr><td colspan="7" class="py-3 text-[var(--color-fg-muted)]">loading…</td></tr>{/if}
    {#if !loading && packets.length === 0}<tr><td colspan="7" class="py-3 text-[var(--color-fg-muted)]">no packets match.</td></tr>{/if}
  </tbody>
</table>
