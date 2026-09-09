import { astro } from 'iztro'
import { Lunar, Solar } from 'lunar-javascript'
import { seoulNowParts } from './time.js'
import type { Chart, ChartRequest, ZiTimeMode, ZiweiCalendar as Calendar } from './types'

/* ------------------------------------------------------------------ */
/*  Input normalization (pure JS - no Pyodide)                         */
/* ------------------------------------------------------------------ */

const DATE_RE = /^\d{4}-\d{1,2}-\d{1,2}$/
const TIME_RE = /^\d{1,2}:\d{2}(:\d{2})?$/
const MDY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

function normDate(value: string | undefined): string {
  if (!value) return ''
  const t = value.trim()
  if (DATE_RE.test(t)) return t
  const m = MDY_RE.exec(t)
  if (m) return `${Number(m[3])}-${Number(m[1])}-${Number(m[2])}`
  return t
}

function normGender(value: string | undefined): 'male' | 'female' {
  if (!value) throw new Error('gender is required')
  const v = value.trim().toLowerCase()
  if (['m', 'male', 'man', '\ub0a8', '\ub0a8\uc790', '\ub0a8\uc131', '\u7537'].includes(v)) return 'male'
  if (['f', 'female', 'woman', '\uc5ec', '\uc5ec\uc790', '\uc5ec\uc131', '\u5973'].includes(v)) return 'female'
  throw new Error('gender must be male/female or \ub0a8/\uc5ec')
}

function parseTime(value: string | undefined): { h: number; m: number } {
  if (!value) throw new Error('time is required')
  let t = value.trim()
  let suffix = ''

  if (t.includes(' ')) {
    const parts = t.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      if (parts[0].includes(':') && !parts[parts.length - 1].includes(':')) {
        suffix = parts[parts.length - 1]
        t = parts[0]
      } else if (parts[parts.length - 1].includes(':') && !parts[0].includes(':')) {
        suffix = parts[0]
        t = parts[parts.length - 1]
      }
    }
  } else {
    const lower = t.toLowerCase()
    if (lower.endsWith('am') || lower.endsWith('pm')) {
      suffix = t.slice(-2)
      t = t.slice(0, -2).trim()
    }
  }

  if (!TIME_RE.test(t)) throw new Error('time must be HH:MM')
  const [hh, mm] = t.split(':').map(Number)
  let h = hh
  const m = mm

  const sfx = suffix.trim().toLowerCase()
  if ((sfx === 'pm' || sfx === '\uc624\ud6c4') && h < 12) h += 12
  if ((sfx === 'am' || sfx === '\uc624\uc804') && h === 12) h = 0

  if (h < 0 || h > 23) throw new Error('hour must be 0..23')
  if (m < 0 || m > 59) throw new Error('minute must be 0..59')
  return { h, m }
}

function timeToIndex(h: number): number {
  if (h === 0) return 0
  if (h === 23) return 12
  return Math.floor((h + 1) / 2)
}

const KOREA_TIME_CORRECTION_MINUTES = -30

function shiftDateTime(date: string, hour: number, minute: number, minutes: number): { date: string; hour: number; minute: number } {
  const [y, m, d] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d, hour, minute + minutes, 0))
  return {
    date: `${shifted.getUTCFullYear()}-${shifted.getUTCMonth() + 1}-${shifted.getUTCDate()}`,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  }
}

export type NormalizedPayload = {
  calendar: Calendar
  date: string
  gender: 'male' | 'female'
  timeIndex: number
  hour: number
  minute: number
  language: string
  isLeapMonth: boolean
  fixLeap: boolean
  flowDate: string
  flowTimeIndex: number
  flowHour: number
  flowMinute: number
  ziTimeMode: ZiTimeMode
}

export type CoreSurrounded = {
  selfIndex: number
  trine: [number, number]
  opposite: number
}

export type CalculateCoreHooks = {
  normalize(payload: ChartRequest): NormalizedPayload
  surrounded(palaceCount: number): CoreSurrounded[]
}

function normalize(payload: ChartRequest): NormalizedPayload {
  const calendar = (payload.calendar === 'lunar' ? 'lunar' : 'solar') as Calendar
  const date = normDate(payload.date)
  if (!DATE_RE.test(date)) throw new Error('date must be YYYY-M-D')

  const gender = normGender(payload.gender)

  let hour = 12
  let minute = 0
  let ti = payload.timeIndex
  let calcDate = date
  if (ti == null && payload.time) {
    const parsed = parseTime(payload.time)
    const shifted = shiftDateTime(date, parsed.h, parsed.m, KOREA_TIME_CORRECTION_MINUTES)
    calcDate = shifted.date
    hour = shifted.hour
    minute = shifted.minute
    ti = timeToIndex(hour)
  } else if (ti != null) {
    // Derive hour from timeIndex for saju
    if (ti === 0) { hour = 0; minute = 0 }
    else if (ti === 12) { hour = 23; minute = 0 }
    else { hour = (ti - 1) * 2 + 1; minute = 0 }
  }
  if (ti == null) ti = 6
  if (ti < 0 || ti > 12) throw new Error('timeIndex must be 0..12')

  const language = (payload.language ?? 'ko-KR').trim()
  const isLeapMonth = Boolean(payload.isLeapMonth)
  const fixLeap = payload.fixLeap === undefined ? true : Boolean(payload.fixLeap)

  const flowDate = normDate(payload.flowDate)
  if (flowDate && !DATE_RE.test(flowDate)) throw new Error('flowDate must be YYYY-M-D')

  let flowHour = 0
  let flowMinute = 0
  let fti = payload.flowTimeIndex
  let calcFlowDate = flowDate
  if (fti == null && payload.flowTime) {
    const parsed = parseTime(payload.flowTime)
    const shifted = shiftDateTime(flowDate || date, parsed.h, parsed.m, KOREA_TIME_CORRECTION_MINUTES)
    calcFlowDate = shifted.date
    flowHour = shifted.hour
    flowMinute = shifted.minute
    fti = timeToIndex(flowHour)
  }
  if (fti == null) fti = 0
  if (fti < 0 || fti > 12) throw new Error('flowTimeIndex must be 0..12')

  const ziTimeMode = payload.ziTimeMode === 'fixed' ? 'fixed' : 'split'

  return {
    calendar, date: calcDate, gender, timeIndex: ti, hour, minute,
    language, isLeapMonth, fixLeap,
    flowDate: calcFlowDate, flowTimeIndex: fti, flowHour, flowMinute, ziTimeMode,
  }
}

/* ------------------------------------------------------------------ */
/*  Saju (Four Pillars) via lunar-javascript                           */
/* ------------------------------------------------------------------ */

const STEMS_KO = ['\uac11', '\uc744', '\ubcd1', '\uc815', '\ubb34', '\uae30', '\uacbd', '\uc2e0', '\uc784', '\uacc4']
const BRANCHES_KO = ['\uc790', '\ucd95', '\uc778', '\ubb18', '\uc9c4', '\uc0ac', '\uc624', '\ubbf8', '\uc2e0', '\uc720', '\uc220', '\ud574']
const STEMS_CN = ['\u7532', '\u4e59', '\u4e19', '\u4e01', '\u620a', '\u5df1', '\u5e9a', '\u8f9b', '\u58ec', '\u7678']
const BRANCHES_CN = ['\u5b50', '\u4e11', '\u5bc5', '\u536f', '\u8fb0', '\u5df3', '\u5348', '\u672a', '\u7533', '\u9149', '\u620c', '\u4ea5']

function cnToKo(cn: string): string {
  if (cn.length !== 2) return cn
  const si = STEMS_CN.indexOf(cn[0])
  const bi = BRANCHES_CN.indexOf(cn[1])
  if (si < 0 || bi < 0) return cn
  return STEMS_KO[si] + BRANCHES_KO[bi]
}

function stemToKo(ch: string): string {
  const i = STEMS_CN.indexOf(ch)
  return i >= 0 ? STEMS_KO[i] : ch
}

/* 오행: 木0 火1 土2 金3 水4 */
const STEM_WX: Record<string, number> = {
  '\u7532': 0, '\u4e59': 0, '\u4e19': 1, '\u4e01': 1, '\u620a': 2,
  '\u5df1': 2, '\u5e9a': 3, '\u8f9b': 3, '\u58ec': 4, '\u7678': 4,
}
/* 음양: 양0 음1 */
const STEM_YY: Record<string, number> = {
  '\u7532': 0, '\u4e59': 1, '\u4e19': 0, '\u4e01': 1, '\u620a': 0,
  '\u5df1': 1, '\u5e9a': 0, '\u8f9b': 1, '\u58ec': 0, '\u7678': 1,
}

/* 십성 계산 (일간 기준, 한글 반환) */
function computeShiShen(dayGan: string, targetGan: string): string {
  const me = STEM_WX[dayGan]
  const tgt = STEM_WX[targetGan]
  if (me == null || tgt == null) return ''
  const same = STEM_YY[dayGan] === STEM_YY[targetGan]
  const rel = (tgt - me + 5) % 5
  switch (rel) {
    case 0: return same ? '\ube44\uacac' : '\uac81\uc7ac'       // 비견 / 겁재
    case 1: return same ? '\uc2dd\uc2e0' : '\uc0c1\uad00'       // 식신 / 상관
    case 2: return same ? '\ud3b8\uc7ac' : '\uc815\uc7ac'       // 편재 / 정재
    case 3: return same ? '\ud3b8\uad00' : '\uc815\uad00'       // 편관 / 정관
    case 4: return same ? '\ud3b8\uc778' : '\uc815\uc778'       // 편인 / 정인
    default: return ''
  }
}

type SajuPillar = {
  cn: string
  ko: string
  stem: string
  branch: string
  stemKo: string
  branchKo: string
  wuxing: string
  nayin: string
  hideGan: string
  hideGanKo: string
  shiShenBranch: string
  shiShenGan: string
  shiShenZhi: string[]
  diShi: string
}

type DaYunItem = {
  ganZhi: string
  ganZhiKo: string
  startAge: number
  endAge: number
  startYear: number
  endYear: number
}

type LunarDaYun = {
  getGanZhi(): string
  getStartAge(): number
  getEndAge(): number
  getStartYear(): number
  getEndYear(): number
}

type SajuResult = {
  year: SajuPillar
  month: SajuPillar
  day: SajuPillar
  hour: SajuPillar
  taiYuan: string
  taiYuanNaYin: string
  taiXi: string
  taiXiNaYin: string
  mingGong: string
  mingGongNaYin: string
  shenGong: string
  shenGongNaYin: string
  dayXunKong: string
  yunStartDesc: string
  isForward: boolean
  daYun: DaYunItem[]
}

function parsePillar(cn: string): SajuPillar {
  const ko = cnToKo(cn)
  const si = STEMS_CN.indexOf(cn[0])
  const bi = BRANCHES_CN.indexOf(cn[1])
  return {
    cn,
    ko,
    stem: cn[0] ?? '',
    branch: cn[1] ?? '',
    stemKo: si >= 0 ? STEMS_KO[si] : '',
    branchKo: bi >= 0 ? BRANCHES_KO[bi] : '',
    wuxing: '', nayin: '', hideGan: '', hideGanKo: '', shiShenBranch: '', shiShenGan: '', shiShenZhi: [], diShi: '',
  }
}

function parsePillarFull(
  cn: string,
  wuxing: string,
  nayin: string,
  diShi: string,
): SajuPillar {
  const base = parsePillar(cn)
  return { ...base, wuxing, nayin, diShi }
}

function computeSaju(
  calendar: Calendar,
  dateStr: string,
  hour: number,
  minute: number,
  isLeapMonth: boolean,
  gender: 'male' | 'female',
  ziTimeMode: ZiTimeMode,
): SajuResult {
  const [y, m, d] = dateStr.split('-').map(Number)

  let solarYear: number
  let solarMonth: number
  let solarDay: number

  if (calendar === 'lunar') {
    const lunar = isLeapMonth
      ? Lunar.fromYmd(y, -m, d)
      : Lunar.fromYmd(y, m, d)
    const solar = lunar.getSolar()
    solarYear = solar.getYear()
    solarMonth = solar.getMonth()
    solarDay = solar.getDay()
  } else {
    solarYear = y
    solarMonth = m
    solarDay = d
  }

  const solar = Solar.fromYmdHms(solarYear, solarMonth, solarDay, hour, minute, 0)
  const ec = solar.getLunar().getEightChar()
  ec.setSect(ziTimeMode === 'split' ? 1 : 2)

  const yearPillar = parsePillarFull(ec.getYear(), ec.getYearWuXing(), ec.getYearNaYin(), ec.getYearDiShi())
  const monthPillar = parsePillarFull(ec.getMonth(), ec.getMonthWuXing(), ec.getMonthNaYin(), ec.getMonthDiShi())
  const dayPillar = parsePillarFull(ec.getDay(), ec.getDayWuXing(), ec.getDayNaYin(), ec.getDayDiShi())
  const hourPillar = parsePillarFull(ec.getTime(), ec.getTimeWuXing(), ec.getTimeNaYin(), ec.getTimeDiShi())

  /* 일간 기준 십성과 lunar-javascript 원자료의 지장간 */
  const dayGan = dayPillar.stem
  const pillarsWithHideGan: Array<[SajuPillar, string[]]> = [
    [yearPillar, ec.getYearHideGan()],
    [monthPillar, ec.getMonthHideGan()],
    [dayPillar, ec.getDayHideGan()],
    [hourPillar, ec.getTimeHideGan()],
  ]
  for (const [p, hgList] of pillarsWithHideGan) {
    // 일주만 일원이다. 다른 기둥의 같은 천간은 비견이다.
    p.shiShenGan = p === dayPillar ? '\uc77c\uc6d0' : computeShiShen(dayGan, p.stem)
    // lunar-javascript가 제공한 순서를 그대로 보존한다.
    p.hideGan = hgList.join('')
    p.hideGanKo = hgList.map(ch => stemToKo(ch)).join('')
    // 지지 십성: 지지의 정기(지장간 마지막 글자) 기준
    const mainHideGan = hgList.length ? hgList[hgList.length - 1] : ''
    p.shiShenBranch = mainHideGan ? computeShiShen(dayGan, mainHideGan) : ''
    // 지장간 십성
    p.shiShenZhi = hgList.map(ch => computeShiShen(dayGan, ch))
  }

  // Special palaces
  const taiYuan = ec.getTaiYuan()
  const taiXi = ec.getTaiXi()
  const mingGong = ec.getMingGong()
  const shenGong = ec.getShenGong()

  // DaYun (대운)
  const genderNum = gender === 'male' ? 1 : 0
  const yun = ec.getYun(genderNum)
  const yunStartDesc = `${yun.getStartYear()}년 ${yun.getStartMonth()}개월 ${yun.getStartDay()}일`

  const daYunList = yun.getDaYun(10) as LunarDaYun[]
  const daYun: DaYunItem[] = daYunList.map((dy) => ({
    ganZhi: dy.getGanZhi(),
    ganZhiKo: cnToKo(dy.getGanZhi()),
    startAge: dy.getStartAge(),
    endAge: dy.getEndAge(),
    startYear: dy.getStartYear(),
    endYear: dy.getEndYear(),
  }))

  return {
    year: yearPillar,
    month: monthPillar,
    day: dayPillar,
    hour: hourPillar,
    taiYuan,
    taiYuanNaYin: ec.getTaiYuanNaYin(),
    taiXi,
    taiXiNaYin: ec.getTaiXiNaYin(),
    mingGong,
    mingGongNaYin: ec.getMingGongNaYin(),
    shenGong,
    shenGongNaYin: ec.getShenGongNaYin(),
    dayXunKong: ec.getDayXunKong(),
    yunStartDesc,
    isForward: yun.isForward(),
    daYun,
  }
}

/* ------------------------------------------------------------------ */
/*  iztro chart data extraction                                        */
/* ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

function getString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key]
  return typeof v === 'string' ? v : ''
}

function getBool(obj: Record<string, unknown>, key: string): boolean {
  return Boolean(obj[key])
}

function getArray(obj: Record<string, unknown>, key: string): unknown[] {
  const v = obj[key]
  return Array.isArray(v) ? v : []
}

function getNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key]
  return typeof v === 'number' ? v : 0
}

function pickStar(s: unknown) {
  if (!isRecord(s)) return null
  const mutagen = s.mutagen
  return {
    name: getString(s, 'name'),
    type: getString(s, 'type'),
    scope: getString(s, 'scope'),
    brightness: getString(s, 'brightness'),
    mutagen: typeof mutagen === 'string' ? mutagen : null,
  }
}

function pickPalace(p: unknown) {
  if (!isRecord(p)) {
    return {
      name: '', isBodyPalace: false, isOriginalPalace: false,
      heavenlyStem: '', earthlyBranch: '',
      majorStars: [], minorStars: [], adjectiveStars: [],
      changsheng12: '', boshi12: '', jiangqian12: '', suiqian12: '',
      stage: null, ages: [],
    }
  }

  const adjectiveStars = getArray(p, 'adjectiveStars')
    .map((s) => {
      if (!isRecord(s)) return null
      return { name: getString(s, 'name'), type: getString(s, 'type'), scope: getString(s, 'scope') }
    })
    .filter(Boolean)

  const ages = getArray(p, 'ages').filter((n) => typeof n === 'number') as number[]

  let stage: { from: number; to: number } | null = null
  const rawStage = p.stage
  if (isRecord(rawStage)) {
    stage = {
      from: typeof rawStage.from === 'number' ? rawStage.from : 0,
      to: typeof rawStage.to === 'number' ? rawStage.to : 0,
    }
  }
  const rawDecadal = p.decadal
  const rawDecadalRange = isRecord(rawDecadal) ? rawDecadal.range : null
  if (!stage && Array.isArray(rawDecadalRange)) {
    const [from, to] = rawDecadalRange
    if (typeof from === 'number' && typeof to === 'number') {
      stage = { from, to }
    }
  }

  return {
    name: getString(p, 'name'),
    isBodyPalace: getBool(p, 'isBodyPalace'),
    isOriginalPalace: getBool(p, 'isOriginalPalace'),
    heavenlyStem: getString(p, 'heavenlyStem'),
    earthlyBranch: getString(p, 'earthlyBranch'),
    majorStars: getArray(p, 'majorStars').map(pickStar).filter(Boolean),
    minorStars: getArray(p, 'minorStars').map(pickStar).filter(Boolean),
    adjectiveStars,
    changsheng12: getString(p, 'changsheng12'),
    boshi12: getString(p, 'boshi12'),
    jiangqian12: getString(p, 'jiangqian12'),
    suiqian12: getString(p, 'suiqian12'),
    stage,
    ages,
  }
}

function pickChart(input: unknown) {
  if (!isRecord(input)) {
    return {
      solarDate: '', lunarDate: '', chineseDate: '',
      time: '', timeRange: '', sign: '', zodiac: '',
      earthlyBranchOfSoulPalace: '', earthlyBranchOfBodyPalace: '',
      soul: '', body: '', fiveElementsClass: '',
      palaces: [],
    }
  }

  return {
    solarDate: getString(input, 'solarDate'),
    lunarDate: getString(input, 'lunarDate'),
    chineseDate: getString(input, 'chineseDate'),
    time: getString(input, 'time'),
    timeRange: getString(input, 'timeRange'),
    sign: getString(input, 'sign'),
    zodiac: getString(input, 'zodiac'),
    earthlyBranchOfSoulPalace: getString(input, 'earthlyBranchOfSoulPalace'),
    earthlyBranchOfBodyPalace: getString(input, 'earthlyBranchOfBodyPalace'),
    soul: getString(input, 'soul'),
    body: getString(input, 'body'),
    fiveElementsClass: getString(input, 'fiveElementsClass'),
    palaces: getArray(input, 'palaces').map(pickPalace),
  }
}

function pickHoroscopeStars(obj: Record<string, unknown>) {
  const rawStars = obj.stars
  if (!Array.isArray(rawStars)) return undefined
  return rawStars.map((palaceStars) => getArray({ stars: palaceStars }, 'stars')
    .map((star) => {
      if (!isRecord(star)) return null
      return {
        name: getString(star, 'name'),
        type: getString(star, 'type'),
        scope: getString(star, 'scope'),
      }
    })
    .filter(Boolean) as Array<{ name: string; type: string; scope: string }>)
}

function pickHScope(obj: unknown, kind: 'age' | 'childhood' | 'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly') {
  if (!isRecord(obj)) return null
  const stars = pickHoroscopeStars(obj)
  return {
    kind,
    index: getNumber(obj, 'index'),
    name: getString(obj, 'name'),
    heavenlyStem: getString(obj, 'heavenlyStem'),
    earthlyBranch: getString(obj, 'earthlyBranch'),
    palaceNames: getArray(obj, 'palaceNames').filter((x) => typeof x === 'string') as string[],
    mutagen: getArray(obj, 'mutagen').filter((x) => typeof x === 'string') as string[],
    ...(stars ? { stars } : {}),
    ...(typeof obj.nominalAge === 'number' ? { nominalAge: obj.nominalAge } : {}),
  }
}

function pickHoroscope(input: unknown, palaces: ReturnType<typeof pickChart>['palaces']) {
  if (!isRecord(input)) return null
  const age = pickHScope(input.age, 'age')
  const selectedLongTerm = pickHScope(input.decadal, 'decadal')
  const nominalAge = age?.nominalAge
  const stage = selectedLongTerm ? palaces[selectedLongTerm.index]?.stage : null
  const isDecadal = Boolean(stage && typeof nominalAge === 'number' &&
    nominalAge >= stage.from && nominalAge <= stage.to)
  const childhood = selectedLongTerm && !isDecadal
    ? { ...selectedLongTerm, kind: 'childhood' as const }
    : null
  return {
    solarDate: getString(input, 'solarDate'),
    lunarDate: getString(input, 'lunarDate'),
    ageDivide: astro.getConfig().ageDivide,
    age,
    childhood,
    decadal: isDecadal ? selectedLongTerm : null,
    yearly: pickHScope(input.yearly, 'yearly'),
    monthly: pickHScope(input.monthly, 'monthly'),
    daily: pickHScope(input.daily, 'daily'),
    hourly: pickHScope(input.hourly, 'hourly'),
  }
}


export function calculateZiweiChart(payload: ChartRequest): Chart {
  return calculateZiweiChartFromNormalized(payload, normalize(payload), defaultSurrounded)
}

export function calculateZiweiChartWithCore(payload: ChartRequest, core: CalculateCoreHooks): Chart {
  return calculateZiweiChartFromNormalized(payload, core.normalize(payload), core.surrounded)
}

function calculateZiweiChartFromNormalized(
  _payload: ChartRequest,
  params: NormalizedPayload,
  surroundedProvider: (palaceCount: number) => CoreSurrounded[],
): Chart {

  // 1) iztro chart
  const astrolabe =
    params.calendar === 'lunar'
      ? astro.astrolabeByLunarDate(params.date, params.timeIndex, params.gender, params.isLeapMonth, params.fixLeap, params.language)
      : astro.astrolabeBySolarDate(params.date, params.timeIndex, params.gender, params.fixLeap, params.language)

  const chart = pickChart(astrolabe)

  // 2) Correct saju via lunar-javascript (solar term based)
  const saju = computeSaju(params.calendar, params.date, params.hour, params.minute, params.isLeapMonth, params.gender, params.ziTimeMode)

  // 3) 삼방사정
  const pals = chart.palaces
  const surrounded = surroundedProvider(pals.length).map((item) => ({
    self: item.selfIndex,
    trine: item.trine,
    opposite: item.opposite,
  }))

  // 4) Horoscope
  let horoscope: ReturnType<typeof pickHoroscope> = null
  try {
    // A date-only string must not become a UTC instant and shift a day on hosts west of UTC.
    const d = params.flowDate || seoulNowParts().date
    const rawH = astrolabe.horoscope(d, params.flowTimeIndex)
    horoscope = pickHoroscope(rawH, chart.palaces)
  } catch {
    horoscope = null
  }

  // 5) Flies (비성사화)
  const mutagenNames = ['\u7984', '\u6743', '\u79d1', '\u5fcc'] as const
  const mutagenKo = ['\ub85d', '\uad8c', '\uacfc', '\uae30'] as const
  const flies = pals.map((_, i) => {
    const p = astrolabe.palace(i)
    const routes: Array<{ mutagen: string; mutagenKo: string; to: number | null; toPalace: string }> = []
    for (let mi = 0; mi < mutagenNames.length; mi++) {
      let to: number | null = null
      let toPalace = ''
      if (p) {
        for (let j = 0; j < 12; j++) {
          if (p.fliesTo(j, [mutagenNames[mi]])) {
            to = j
            toPalace = pals[j]?.name ?? ''
            break
          }
        }
      }
      routes.push({ mutagen: mutagenNames[mi], mutagenKo: mutagenKo[mi], to, toPalace })
    }
    return { from: i, fromPalace: pals[i]?.name ?? '', routes }
  })

  const result = {
    ...chart,
    saju,
    surrounded,
    horoscope,
    flies,
  }

  return JSON.parse(JSON.stringify(result)) as Chart
}

function defaultSurrounded(palaceCount: number): CoreSurrounded[] {
  if (palaceCount === 0) return []
  return Array.from({ length: palaceCount }, (_, i) => ({
    selfIndex: i,
    trine: [(i + 4) % palaceCount, (i + 8) % palaceCount] as [number, number],
    opposite: (i + 6) % palaceCount,
  }))
}
