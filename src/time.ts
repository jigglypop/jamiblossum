import type { Palace, TimeBranchOption } from './types.js';
import { Lunar, Solar } from 'lunar-javascript';

export const DATE_RE = /^\d{4}-\d{1,2}-\d{1,2}$/;
export const KOREA_TIME_CORRECTION_MINUTES = -30;

export const TIME_BRANCH_OPTIONS: TimeBranchOption[] = [
  { index: 0, label: '자시', note: '조자', range: '00:30~01:29', time: '00:30' },
  { index: 1, label: '축시', range: '01:30~03:29', time: '01:30' },
  { index: 2, label: '인시', range: '03:30~05:29', time: '03:30' },
  { index: 3, label: '묘시', range: '05:30~07:29', time: '05:30' },
  { index: 4, label: '진시', range: '07:30~09:29', time: '07:30' },
  { index: 5, label: '사시', range: '09:30~11:29', time: '09:30' },
  { index: 6, label: '오시', range: '11:30~13:29', time: '11:30' },
  { index: 7, label: '미시', range: '13:30~15:29', time: '13:30' },
  { index: 8, label: '신시', range: '15:30~17:29', time: '15:30' },
  { index: 9, label: '유시', range: '17:30~19:29', time: '17:30' },
  { index: 10, label: '술시', range: '19:30~21:29', time: '19:30' },
  { index: 11, label: '해시', range: '21:30~23:29', time: '21:30' },
  { index: 12, label: '자시', note: '야자', range: '23:30~00:29', time: '23:30' },
];

export function joinDateParts(y: string, mo: string, d: string): string {
  if (!y && !mo && !d) return '';
  return `${y}-${mo}-${d}`;
}

export function joinTimeParts(h: string, m: string): string {
  if (!h && !m) return '';
  return `${h}:${m}`;
}

export function digitsOnly(s: string, max: number): string {
  return s.replace(/\D/g, '').slice(0, max);
}

export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (y < 100 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isValidTime(s: string): boolean {
  if (!/^\d{1,2}:\d{2}$/.test(s)) return false;
  const [hour, minute] = s.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function shiftTime(value: string, minutes: number): { hour: number; minute: number } | null {
  if (!isValidTime(value)) return null;
  const [rawHour, rawMinute] = value.split(':').map(Number);
  if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) return null;
  const dayMinutes = 24 * 60;
  const total = ((rawHour * 60 + rawMinute + minutes) % dayMinutes + dayMinutes) % dayMinutes;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

export function timeToIndexFromTime(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const shifted = shiftTime(value, KOREA_TIME_CORRECTION_MINUTES);
  if (!shifted) return undefined;
  const hour = shifted.hour;
  if (hour === 0) return 0;
  if (hour === 23) return 12;
  return Math.floor((hour + 1) / 2);
}

export function seoulNowParts(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

export function solarYearOf(value: string): number | null {
  const match = value.match(/\d{4}/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
}

/** Ziwei nominal age at a solar date. Prefer the chart engine's age when using custom settings. */
export function nominalAgeFromSolarDate(value: string, targetDate?: string): number | null {
  return lunarNominalAgeFromSolarDate(value, targetDate);
}

function solarDate(value: string): ReturnType<typeof Solar.fromYmd> | null {
  if (!DATE_RE.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const checked = new Date(Date.UTC(year, month - 1, day));
  if (year < 100 || year > 2200 || checked.getUTCFullYear() !== year ||
      checked.getUTCMonth() !== month - 1 || checked.getUTCDate() !== day) return null;
  try { return Solar.fromYmd(year, month, day); } catch { return null; }
}

/** Lunar New Year age, matching iztro's default ageDivide='normal'. */
export function lunarNominalAgeFromSolarDate(
  birthDate: string,
  targetDate: string = seoulNowParts().date,
): number | null {
  const birth = solarDate(birthDate);
  const target = solarDate(targetDate);
  if (!birth || !target || birth.toYmd() > target.toYmd()) return null;
  return target.getLunar().getYear() - birth.getLunar().getYear() + 1;
}

export function palaceForAge(palaces: Palace[], age: number | null): Palace | null {
  if (age == null) return null;
  return (
    palaces.find((palace) => palace.stage && age >= palace.stage.from && age <= palace.stage.to) ??
    null
  );
}

/** Calendar-year labels only. Pass the LUNAR birth year for default Ziwei decades. */
export function decadalYearRange(
  stage: Palace['stage'],
  birthYear: number | null,
): { from: number; to: number } | null {
  if (!stage || !birthYear) return null;
  return {
    from: birthYear + stage.from - 1,
    to: birthYear + stage.to - 1,
  };
}

/** Exact civil dates for default lunar-year decades; endExclusive is the next decade's first day. */
export function decadalDateRangeFromSolarDate(
  stage: Palace['stage'],
  birthDate: string,
): { fromYear: number; toYear: number; startDate: string; endExclusive: string } | null {
  const birth = solarDate(birthDate);
  if (!birth || !stage || !Number.isInteger(stage.from) || !Number.isInteger(stage.to) ||
      stage.from < 1 || stage.to < stage.from) return null;
  const birthLunarYear = birth.getLunar().getYear();
  const fromYear = birthLunarYear + stage.from - 1;
  const toYear = birthLunarYear + stage.to - 1;
  return {
    fromYear, toYear,
    startDate: Lunar.fromYmd(fromYear, 1, 1).getSolar().toYmd(),
    endExclusive: Lunar.fromYmd(toYear + 1, 1, 1).getSolar().toYmd(),
  };
}
