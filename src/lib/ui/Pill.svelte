<script lang="ts">
  let { tone = 'default', children } = $props<{
    tone?: 'default' | 'info' | 'warn' | 'high' | 'success';
    children: any;
  }>();
  const klass: Record<string, string> = {
    default: 'bg-[var(--color-bg-elev)] text-[var(--color-fg-muted)]',
    info: 'bg-[color-mix(in_oklab,var(--color-sev-info),transparent_70%)] text-[var(--color-sev-info)]',
    warn: 'bg-[color-mix(in_oklab,var(--color-sev-warn),transparent_70%)] text-[var(--color-sev-warn)]',
    high: 'bg-[color-mix(in_oklab,var(--color-sev-high),transparent_60%)] text-[var(--color-sev-high)]',
    success: 'bg-[color-mix(in_oklab,var(--color-enc-wpa3),transparent_70%)] text-[var(--color-enc-wpa3)]'
  };
</script>
<span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${klass[tone]}`}>
  {@render children()}
</span>
