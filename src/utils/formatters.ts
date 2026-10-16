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
  const isSuffixSymbol = ['DH', 'MAD', 'AED', 'SAR', 'CHF'].includes(symbol);
  const minDigits = decimals !== undefined ? decimals : (amount % 1 !== 0 ? 2 : 0);
  const maxDigits = decimals !== undefined ? decimals : 2;
  const formattedNumber = (Number.isFinite(amount) ? amount : 0).toLocaleString('en-US', {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });
  return isSuffixSymbol ? `${formattedNumber} ${symbol}` : `${symbol}${formattedNumber}`;
}

export function formatExactCurrency(
  amount: number,
  symbol: string = '$'
): string {
  return formatCurrency(amount, symbol, 2);
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
    case 'AED':
      return 'AED';
    case 'SAR':
      return 'SAR';
    case 'CHF':
      return 'CHF';
    case 'INR':
      return '₹';
    default:
      return '$';
  }
}

export const AVAILABLE_CURRENCIES = [
  { code: 'USD', label: 'USD ($) — US Dollar', symbol: '$' },
  { code: 'EUR', label: 'EUR (€) — Euro', symbol: '€' },
  { code: 'GBP', label: 'GBP (£) — British Pound', symbol: '£' },
  { code: 'MAD', label: 'MAD (DH) — Moroccan Dirham', symbol: 'DH' },
  { code: 'CAD', label: 'CAD ($) — Canadian Dollar', symbol: '$' },
  { code: 'AUD', label: 'AUD ($) — Australian Dollar', symbol: '$' },
  { code: 'CHF', label: 'CHF (CHF) — Swiss Franc', symbol: 'CHF' },
  { code: 'AED', label: 'AED (AED) — UAE Dirham', symbol: 'AED' },
  { code: 'SAR', label: 'SAR (SAR) — Saudi Riyal', symbol: 'SAR' },
  { code: 'JPY', label: 'JPY (¥) — Japanese Yen', symbol: '¥' },
  { code: 'INR', label: 'INR (₹) — Indian Rupee', symbol: '₹' },
  { code: 'NZD', label: 'NZD ($) — New Zealand Dollar', symbol: '$' },
];

export const AVAILABLE_TIMEZONES = [
  { value: 'Africa/Casablanca', label: 'Africa/Casablanca (Morocco - WET/WEST)' },
  { value: 'Europe/London', label: 'Europe/London (London - GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (Paris, Berlin, Rome - CET)' },
  { value: 'America/New_York', label: 'America/New_York (Eastern Time - US)' },
  { value: 'America/Chicago', label: 'America/Chicago (Central Time - US)' },
  { value: 'America/Denver', label: 'America/Denver (Mountain Time - US)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (Pacific Time - US)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (Dubai, UAE - GST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (Tokyo - JST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (Singapore - SGT)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (Sydney - AEST)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

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

export function getCurrentTimeStr(): string {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

