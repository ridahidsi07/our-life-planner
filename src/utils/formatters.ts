export function getSystemDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatCurrency(
  amount: number,
  symbol: string = '$',
  decimals?: number
): string {
  if (decimals !== undefined) {
    return `${symbol}${amount.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
  const rounded = Math.round(amount * 100) / 100;
  return `${symbol}${rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function getCurrencySymbol(code: string): string {
  switch (code) {
    case 'USD':
    case 'CAD':
    case 'AUD':
    case 'NZD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'JPY':
      return '¥';
    case 'MAD':
      return 'DH';
    case 'CHF':
      return 'CHF';
    case 'INR':
      return '₹';
    default:
      return '$';
  }
}

export function getWeekStartDate(
  dateStr: string,
  weekStartsOn: 'Monday' | 'Sunday' = 'Monday'
): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const cur = new Date(year, month - 1, day);
  const currentDayOfWeek = cur.getDay(); // 0 = Sun, 1 = Mon ...
  let diff: number;
  if (weekStartsOn === 'Sunday') {
    diff = cur.getDate() - currentDayOfWeek;
  } else {
    diff = cur.getDate() - (currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1);
  }
  const startDate = new Date(year, month - 1, diff);
  const y = startDate.getFullYear();
  const m = String(startDate.getMonth() + 1).padStart(2, '0');
  const d = String(startDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekDaysForDate(
  dateStr: string,
  weekStartsOn: 'Monday' | 'Sunday' = 'Monday'
): Array<{
  dateStr: string;
  dayNum: number;
  dayName: string;
  monthName: string;
  isToday: boolean;
}> {
  const [year, month, day] = dateStr.split('-').map(Number);
  const cur = new Date(year, month - 1, day);
  const currentDayOfWeek = cur.getDay(); // 0 = Sun, 1 = Mon ...

  let diff: number;
  if (weekStartsOn === 'Sunday') {
    diff = cur.getDate() - currentDayOfWeek;
  } else {
    diff = cur.getDate() - (currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1);
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
      monthName: d.toLocaleDateString('en-US', { month: 'short' }),
      isToday: iso === systemToday,
    });
  }

  return list;
}
