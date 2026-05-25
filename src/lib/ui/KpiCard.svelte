<script lang="ts">
  let { label, value, hint } = $props<{ label: string; value: string | number; hint?: string }>();
</script>
<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-4 py-3">
  <div class="text-xs text-[var(--color-fg-muted)] uppercase tracking-wide">{label}</div>
  <div class="text-2xl mono mt-1">{value}</div>
  {#if hint}<div class="text-xs text-[var(--color-fg-muted)] mt-1">{hint}</div>{/if}
</div>
