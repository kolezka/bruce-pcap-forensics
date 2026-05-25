<script lang="ts">
  import Pill from './Pill.svelte';
  let { events, onSelect } = $props<{
    events: { id: number; kind: string; severity: string; count: number; ts_rel_start: number; ts_rel_end: number; details_json: string; actors_json: string }[];
    onSelect?: (ev: any) => void;
  }>();
</script>
<aside class="w-72 shrink-0 border-l border-[var(--color-border)] p-4 space-y-3 overflow-y-auto">
  <h2 class="text-sm font-semibold text-[var(--color-fg-muted)] uppercase tracking-wide">Events</h2>
  {#if events.length === 0}<p class="text-xs text-[var(--color-fg-muted)]">No findings.</p>{/if}
  {#each events as e (e.id)}
    <button
      class="block w-full text-left rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-2 hover:border-[var(--color-accent)]"
      onclick={() => onSelect?.(e)}
    >
      <div class="flex items-center justify-between text-xs">
        <Pill tone={e.severity === 'high' ? 'high' : e.severity === 'warn' ? 'warn' : 'info'}>{e.kind}</Pill>
        <span class="mono text-[var(--color-fg-muted)]">×{e.count}</span>
      </div>
      <div class="mt-1 text-xs text-[var(--color-fg-muted)] mono">
        {e.ts_rel_start.toFixed(2)}s → {e.ts_rel_end.toFixed(2)}s
      </div>
    </button>
  {/each}
</aside>
