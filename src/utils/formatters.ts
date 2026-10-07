export function getSystemDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatCurrency(amount: number, symbol: string = '$'): string {
  const rounded = Math.round(amount * 100) / 100;
  return `${symbol}${rounded.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function getCurrencySymbol(code: string): string {
  switch (code) {
    case 'USD':
    case 'CAD':
    case 'AUD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'JPY':
      return '¥';
    case 'MAD':
      return 'DH';
    default:
      return '$';
  }
}

export function getWeekDaysForDate(
  dateStr: string,
  weekStartsOn: 'Monday' | 'Sunday' = 'Monday'
): Array<{ dateStr: string; dayNum: number; dayName: string; isToday: boolean }> {
  const [year, month, day] = dateStr.split('-').map(Number);
  const cur = new Date(year, month - 1, day);
  const currentDayOfWeek = cur.getDay(); // 0 = Sun, 1 = Mon ...

  const startDayOffset = weekStartsOn === 'Sunday' ? 0 : 1;
  let diff = cur.getDate() - currentDayOfWeek + startDayOffset;
  if (weekStartsOn === 'Monday' && currentDayOfWeek === 0) {
    diff -= 7;
  }

  const startDate = new Date(year, month - 1, diff);

  const list = [];
  const systemToday = getSystemDate();

  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayN = String(d.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${dayN}`;
    list.push({
      dateStr: iso,
      dayNum: d.getDate(),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday: iso === systemToday,
    });
  }

  return list;
}
