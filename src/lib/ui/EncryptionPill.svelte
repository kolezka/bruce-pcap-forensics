<script lang="ts">
  let { encryption } = $props<{ encryption: string }>();
  const klass: Record<string, string> = {
    OPEN: 'bg-[color-mix(in_oklab,var(--color-enc-open),transparent_70%)] text-[var(--color-enc-open)]',
    WEP:  'bg-[color-mix(in_oklab,var(--color-enc-wep),transparent_70%)] text-[var(--color-enc-wep)]',
    WPA:  'bg-[color-mix(in_oklab,var(--color-enc-wpa),transparent_70%)] text-[var(--color-enc-wpa)]',
    WPA2: 'bg-[color-mix(in_oklab,var(--color-enc-wpa2),transparent_70%)] text-[var(--color-enc-wpa2)]',
    WPA3: 'bg-[color-mix(in_oklab,var(--color-enc-wpa3),transparent_70%)] text-[var(--color-enc-wpa3)]',
    'WPA2/WPA3': 'bg-[color-mix(in_oklab,var(--color-enc-wpa3),transparent_70%)] text-[var(--color-enc-wpa3)]'
  };
</script>
<span class={`inline-flex rounded-full px-2 py-0.5 text-xs ${klass[encryption] ?? klass.OPEN}`}>{encryption}</span>
