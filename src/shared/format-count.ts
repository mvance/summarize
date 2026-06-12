export function formatCompactCount(value: number): string {
  if (!Number.isFinite(value)) return "unknown";
  const abs = Math.abs(value);
  const format = (n: number, suffix: string) => {
    const decimals = n >= 10 ? 0 : 1;
    return `${n.toFixed(decimals)}${suffix}`;
  };
  if (abs >= 1_000_000_000) return format(value / 1_000_000_000, "B");
  if (abs >= 1_000_000) return format(value / 1_000_000, "M");
  if (abs >= 10_000) return format(value / 1_000, "k");
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.floor(value));
}
