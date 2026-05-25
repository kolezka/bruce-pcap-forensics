<script lang="ts">
  let { open = false, onClose, title, children } = $props<{
    open?: boolean; onClose?: () => void; title?: string; children: any;
  }>();
</script>
{#if open}
  <div class="fixed inset-0 z-50 flex">
    <button class="flex-1 bg-black/60" onclick={() => onClose?.()} aria-label="close"></button>
    <div class="w-[36rem] max-w-full bg-[var(--color-bg-elev)] border-l border-[var(--color-border)] p-6 overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">{title}</h2>
        <button class="text-sm hover:underline" onclick={() => onClose?.()}>close</button>
      </div>
      {@render children()}
    </div>
  </div>
{/if}
