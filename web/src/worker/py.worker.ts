/// <reference lib="webworker" />

import { astro } from 'iztro'
import { Solar, Lunar } from 'lunar-javascript'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Calendar = 'solar' | 'lunar'

export type ChartRequest = {
  calendar: Calendar
  date: string
  gender: string
  time?: string
  timeIndex?: number
  language?: string
  isLeapMonth?: boolean
  fixLeap?: boolean
  flowDate?: string
  flowTime?: string
  flowTimeIndex?: number
}

type WorkerRequest =
  | { type: 'init' }
  | { type: 'calc'; id: number; payload: ChartRequest }

type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; id: number; result: unknown }
  | { type: 'error'; id?: number; error: string }

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
  if (h === 23) return 0
  if (h === 0) return 12
  return Math.floor((h - 1) / 2) + 1
}

type NormalizedPayload = {
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
}

function normalize(payload: ChartRequest): NormalizedPayload {
  const calendar = (payload.calendar === 'lunar' ? 'lunar' : 'solar') as Calendar
  const date = normDate(payload.date)
  if (!DATE_RE.test(date)) throw new Error('date must be YYYY-M-D')

  const gender = normGender(payload.gender)

  let hour = 12
  let minute = 0
  let ti = payload.timeIndex
  if (ti == null && payload.time) {
    const parsed = parseTime(payload.time)
    hour = parsed.h
    minute = parsed.m
    ti = timeToIndex(hour)
  } else if (ti != null) {
    // Derive hour from timeIndex for saju
    if (ti === 0) { hour = 23; minute = 0 }
    else if (ti === 12) { hour = 0; minute = 0 }
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
  if (fti == null && payload.flowTime) {
    const parsed = parseTime(payload.flowTime)
    flowHour = parsed.h
    flowMinute = parsed.m
    fti = timeToIndex(flowHour)
  }
  if (fti == null) fti = 0
  if (fti < 0 || fti > 12) throw new Error('flowTimeIndex must be 0..12')

  return {
    calendar, date, gender, timeIndex: ti, hour, minute,
    language, isLeapMonth, fixLeap,
    flowDate, flowTimeIndex: fti, flowHour, flowMinute,
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

type SajuPillar = {
  cn: string
  ko: string
  stem: string
  branch: string
  stemKo: string
  branchKo: string
}

type SajuResult = {
  year: SajuPillar
  month: SajuPillar
  day: SajuPillar
  hour: SajuPillar
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
  }
}

function computeSaju(
  calendar: Calendar,
  dateStr: string,
  hour: number,
  minute: number,
  isLeapMonth: boolean,
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

  return {
    year: parsePillar(ec.getYear()),
    month: parsePillar(ec.getMonth()),
    day: parsePillar(ec.getDay()),
    hour: parsePillar(ec.getTime()),
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

function pickHScope(obj: unknown) {
  if (!isRecord(obj)) return null
  return {
    index: getNumber(obj, 'index'),
    name: getString(obj, 'name'),
    heavenlyStem: getString(obj, 'heavenlyStem'),
    earthlyBranch: getString(obj, 'earthlyBranch'),
    palaceNames: getArray(obj, 'palaceNames').filter((x) => typeof x === 'string') as string[],
    mutagen: getArray(obj, 'mutagen').filter((x) => typeof x === 'string') as string[],
  }
}

function pickHoroscope(input: unknown) {
  if (!isRecord(input)) return null
  return {
    solarDate: getString(input, 'solarDate'),
    lunarDate: getString(input, 'lunarDate'),
    age: pickHScope(input.age),
    decadal: pickHScope(input.decadal),
    yearly: pickHScope(input.yearly),
    monthly: pickHScope(input.monthly),
    daily: pickHScope(input.daily),
    hourly: pickHScope(input.hourly),
  }
}

/* ------------------------------------------------------------------ */
/*  Worker message handler                                             */
/* ------------------------------------------------------------------ */

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data

  if (msg.type === 'init') {
    // No Pyodide to load - instantly ready
    const resp: WorkerResponse = { type: 'ready' }
    self.postMessage(resp)
    return
  }

  if (msg.type === 'calc') {
    const { id, payload } = msg
    try {
      const params = normalize(payload)

      // 1) iztro chart
      const astrolabe =
        params.calendar === 'lunar'
          ? astro.astrolabeByLunarDate(params.date, params.timeIndex, params.gender, params.isLeapMonth, params.fixLeap, params.language)
          : astro.astrolabeBySolarDate(params.date, params.timeIndex, params.gender, params.fixLeap, params.language)

      const chart = pickChart(astrolabe)

      // 2) Correct saju via lunar-javascript (solar term based)
      const saju = computeSaju(params.calendar, params.date, params.hour, params.minute, params.isLeapMonth)

      // 3) 삼방사정
      const pals = chart.palaces
      const surrounded = pals.map((_, i) => ({
        self: i,
        trine: [(i + 4) % 12, (i + 8) % 12] as [number, number],
        opposite: (i + 6) % 12,
      }))

      // 4) Horoscope
      let horoscope: ReturnType<typeof pickHoroscope> = null
      try {
        const d = params.flowDate ? new Date(params.flowDate) : new Date()
        const rawH = astrolabe.horoscope(d, params.flowTimeIndex)
        horoscope = pickHoroscope(rawH)
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

      // ALWAYS JSON round-trip to guarantee cloneability (no functions, no proxies)
      const clean = JSON.parse(JSON.stringify(result)) as unknown
      const resp: WorkerResponse = { type: 'result', id, result: clean }
      self.postMessage(resp)
    } catch (e) {
      const resp: WorkerResponse = { type: 'error', id, error: String(e) }
      self.postMessage(resp)
    }
  }
}
