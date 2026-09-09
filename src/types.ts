export type ZiweiCalendar = 'solar' | 'lunar';
export type ZiTimeMode = 'split' | 'fixed';

export type ChartRequest = {
  calendar: ZiweiCalendar;
  date: string;
  gender: string;
  time?: string;
  timeIndex?: number;
  language?: string;
  isLeapMonth?: boolean;
  fixLeap?: boolean;
  flowDate?: string;
  flowTime?: string;
  flowTimeIndex?: number;
  ziTimeMode?: ZiTimeMode;
};

export type Star = {
  name: string;
  type: string;
  scope: string;
  brightness: string;
  mutagen: string | null;
};

export type AdjectiveStar = {
  name: string;
  type: string;
  scope: string;
};

/** A moving-star placement, grouped by natal palace index in a horoscope scope. */
export type HoroscopeStar = {
  name: string;
  type: string;
  scope: string;
};

export type HoroscopeScopeKind =
  | 'age'
  | 'childhood'
  | 'decadal'
  | 'yearly'
  | 'monthly'
  | 'daily'
  | 'hourly';

export type Palace = {
  name: string;
  isBodyPalace: boolean;
  isOriginalPalace: boolean;
  heavenlyStem: string;
  earthlyBranch: string;
  majorStars: Star[];
  minorStars: Star[];
  adjectiveStars: AdjectiveStar[];
  changsheng12: string;
  boshi12: string;
  jiangqian12: string;
  suiqian12: string;
  stage: { from: number; to: number } | null;
  ages: number[];
};

export type SajuPillar = {
  cn: string;
  ko: string;
  stem: string;
  branch: string;
  stemKo: string;
  branchKo: string;
  wuxing: string;
  nayin: string;
  hideGan: string;
  hideGanKo: string;
  shiShenBranch: string;
  shiShenGan: string;
  shiShenZhi: string[];
  diShi: string;
};

export type DaYunItem = {
  ganZhi: string;
  ganZhiKo: string;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
};

export type Saju = {
  year: SajuPillar;
  month: SajuPillar;
  day: SajuPillar;
  hour: SajuPillar;
  taiYuan: string;
  taiYuanNaYin: string;
  taiXi: string;
  taiXiNaYin: string;
  mingGong: string;
  mingGongNaYin: string;
  shenGong: string;
  shenGongNaYin: string;
  dayXunKong: string;
  yunStartDesc: string;
  isForward: boolean;
  daYun: DaYunItem[];
};

export type HoroscopeScope = {
  /** Identifies the time layer without relying on its localized display name. */
  kind?: HoroscopeScopeKind;
  index: number;
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  palaceNames: string[];
  mutagen: string[];
  /** Moving stars grouped by natal palace index. */
  stars?: HoroscopeStar[][];
  /** Present on the age scope; copied from the same engine that selects the decadal. */
  nominalAge?: number;
} | null;

export type Horoscope = {
  solarDate: string;
  lunarDate: string;
  ageDivide?: 'normal' | 'birthday';
  age: HoroscopeScope;
  /** Present only before the first decadal range begins. */
  childhood?: HoroscopeScope;
  decadal: HoroscopeScope;
  yearly: HoroscopeScope;
  monthly: HoroscopeScope;
  daily: HoroscopeScope;
  hourly: HoroscopeScope;
} | null;

export type FlyRoute = {
  mutagen: string;
  mutagenKo: string;
  to: number | null;
  toPalace: string;
};

export type Fly = {
  from: number;
  fromPalace: string;
  routes: FlyRoute[];
};

export type Chart = {
  solarDate: string;
  lunarDate: string;
  chineseDate: string;
  time: string;
  timeRange: string;
  sign: string;
  zodiac: string;
  earthlyBranchOfSoulPalace: string;
  earthlyBranchOfBodyPalace: string;
  soul: string;
  body: string;
  fiveElementsClass: string;
  palaces: Palace[];
  saju: Saju;
  surrounded: Array<{ self: number; trine: [number, number]; opposite: number }>;
  horoscope: Horoscope;
  flies: Fly[];
};

export type ZiweiView = 'chart' | 'saju' | 'interpret';

export type TimeBranchOption = {
  index: number;
  label: string;
  note?: string;
  range: string;
  time: string;
};
