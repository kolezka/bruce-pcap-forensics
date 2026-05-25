<script lang="ts">
  import { lookupVendor, isLocallyAdministered } from '$lib/oui';
  let { mac } = $props<{ mac: string }>();
  const vendor = $derived(lookupVendor(mac));
  const lk = $derived(isLocallyAdministered(mac));
</script>
<span class="mono text-sm">{mac}</span>
{#if lk}<span class="ml-1 text-[var(--color-sev-warn)] text-xs">[random]</span>{/if}
{#if vendor}<span class="ml-2 text-xs text-[var(--color-fg-muted)]">{vendor}</span>{/if}
