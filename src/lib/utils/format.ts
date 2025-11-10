export function formatNumberShort(n: number): string {
  if (n == null) return '0';
  if (Math.abs(n) < 1000) return String(n);
  if (Math.abs(n) < 1_000_000) return (n / 1000).toFixed(1) + 'K';
  return (n / 1_000_000).toFixed(1) + 'M';
}

export function formatPercent(n: number, digits: number = 1): string {
  if (!isFinite(n)) return '0%';
  return `${n.toFixed(digits)}%`;
}

export function deltaPercent(today: number, yesterday: number): { display: string; positive: boolean } {
  if (!yesterday) return { display: '新增', positive: true };
  const p = ((today - yesterday) / yesterday) * 100;
  const positive = p >= 0;
  return { display: `${positive ? '+' : '-'}${Math.abs(p).toFixed(1)}%`, positive };
}

