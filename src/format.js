export function formatPrice(value) {
  if (value == null || isNaN(value)) return '—';
  return `$${value.toFixed(6)}`;
}

export function formatBalance(value) {
  if (value == null || isNaN(value)) return '—';
  return Math.round(value).toLocaleString('en-US');
}

export function formatPercent(value) {
  if (value == null || isNaN(value)) return '—';
  return `${(value * 100).toFixed(2)}%`;
}

export function formatSwapFee(value) {
  if (value == null || isNaN(value)) return '—';
  const pct = value * 100;
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  if (pct >= 0.001) return `${pct.toFixed(3)}%`;
  return `${pct.toFixed(4)}%`;
}

export function formatTvl(value) {
  if (value == null || isNaN(value)) return '—';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}
