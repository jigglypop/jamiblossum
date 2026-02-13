import './App.css'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { ChartRequest } from './worker/py.worker'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Star = { name: string; type: string; scope: string; brightness: string; mutagen: string | null }
type AdjectiveStar = { name: string; type: string; scope: string }
type Palace = {
  name: string; isBodyPalace: boolean; isOriginalPalace: boolean
  heavenlyStem: string; earthlyBranch: string
  majorStars: Star[]; minorStars: Star[]; adjectiveStars: AdjectiveStar[]
  changsheng12: string; boshi12: string; jiangqian12: string; suiqian12: string
  stage: { from: number; to: number } | null; ages: number[]
}
type SajuPillar = { cn: string; ko: string; stem: string; branch: string; stemKo: string; branchKo: string }
type Saju = { year: SajuPillar; month: SajuPillar; day: SajuPillar; hour: SajuPillar }
type HScope = { index: number; name: string; heavenlyStem: string; earthlyBranch: string; palaceNames: string[]; mutagen: string[] } | null
type Horoscope = { solarDate: string; lunarDate: string; age: HScope; decadal: HScope; yearly: HScope; monthly: HScope; daily: HScope; hourly: HScope } | null
type FlyRoute = { mutagen: string; mutagenKo: string; to: number | null; toPalace: string }
type Fly = { from: number; fromPalace: string; routes: FlyRoute[] }
type Chart = {
  solarDate: string; lunarDate: string; chineseDate: string
  time: string; timeRange: string; sign: string; zodiac: string
  earthlyBranchOfSoulPalace: string; earthlyBranchOfBodyPalace: string
  soul: string; body: string; fiveElementsClass: string
  palaces: Palace[]; saju: Saju
  surrounded: Array<{ self: number; trine: [number, number]; opposite: number }>
  horoscope: Horoscope; flies: Fly[]
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const DATE_RE = /^\d{4}-\d{1,2}-\d{1,2}$/
function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  return y >= 100 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31
}
function isValidTime(s: string): boolean { return /^\d{1,2}:\d{2}$/.test(s) }

const BRIGHTNESS_MAP: Record<string, string> = {
  '[+3]': '\uBB18', '[+2]': '\uC655', '[+1]': '\uB4DD',
  '[0]': '\uB9AC', '[-1]': '\uD3C9', '[-2]': '\uBD88', '[-3]': '\uD568',
}

function fmtBright(b: string): string {
  if (!b) return ''
  return BRIGHTNESS_MAP[b] ?? b
}

// 길성=cyan, 살성=rose, 도화=pink, 보조=emerald, 기타=zinc
function minorColor(type: string): string {
  switch (type) {
    case 'soft': return 'text-cyan-300'
    case 'tough': return 'text-rose-400'
    case 'lucun': return 'text-emerald-300'
    case 'helper': return 'text-emerald-400'
    case 'flower': return 'text-pink-400'
    default: return 'text-zinc-200'
  }
}
function adjColor(type: string): string {
  switch (type) {
    case 'flower': return 'text-pink-400'
    case 'helper': return 'text-emerald-400'
    case 'tough': return 'text-rose-400'
    case 'soft': return 'text-cyan-300'
    default: return 'text-zinc-300'
  }
}

function palaceNameColor(name: string): string {
  if (/명궁|命宮/.test(name)) return 'text-amber-300'
  if (/형제|兄弟/.test(name)) return 'text-teal-300'
  if (/부부|夫妻/.test(name)) return 'text-pink-300'
  if (/자녀|子女/.test(name)) return 'text-sky-300'
  if (/재백|財帛/.test(name)) return 'text-emerald-300'
  if (/질액|疾厄/.test(name)) return 'text-rose-300'
  if (/천이|遷移/.test(name)) return 'text-violet-300'
  if (/교우|交友|노복|奴僕/.test(name)) return 'text-teal-400'
  if (/관록|官祿/.test(name)) return 'text-blue-300'
  if (/전택|田宅/.test(name)) return 'text-lime-300'
  if (/복덕|福德/.test(name)) return 'text-cyan-300'
  if (/부모|父母/.test(name)) return 'text-orange-300'
  return 'text-zinc-100'
}

function mutagenColor(m: string): string {
  if (/기|忌/.test(m)) return 'text-red-400'
  return 'text-green-400'
}

function palaceCellClass(active: boolean, isTrine: boolean, isOpposite: boolean, ming: boolean): string {
  const base = 'relative flex cursor-pointer flex-col overflow-y-auto rounded-lg border px-3 py-2 text-left transition-all'
  if (active) return `${base} border-violet-500/60 bg-violet-950/40 shadow-[0_0_16px_rgba(139,92,246,0.15)]`
  if (isTrine) return `${base} border-sky-500/40 bg-sky-950/15 hover:border-sky-400/60 hover:bg-sky-950/25`
  if (isOpposite) return `${base} border-orange-500/40 bg-orange-950/12 hover:border-orange-400/60 hover:bg-orange-950/20`
  if (ming) return `${base} border-amber-500/30 bg-amber-950/15 hover:border-amber-400/50 hover:bg-amber-950/25`
  return `${base} border-zinc-700/30 bg-zinc-900/20 hover:border-zinc-600/50 hover:bg-zinc-800/25`
}

const INPUT_CLS = 'rounded-md border border-zinc-800/50 bg-zinc-950/40 px-2 py-1.5 text-xs text-zinc-200 outline-none transition-colors focus:border-violet-500/40'

function starStr(s: Star): string {
  const bright = fmtBright(s.brightness)
  const parts = [s.name]
  if (bright) parts[0] += `(${bright})`
  if (s.mutagen) parts.push(s.mutagen)
  return parts.join(' ')
}

function buildPalaceText(p: Palace, palaces: Palace[], surrounded: Chart['surrounded'] | null, idx: number): string {
  const major = p.majorStars.length ? p.majorStars.map(starStr).join(', ') : '-'
  const minor = p.minorStars.length ? p.minorStars.map(starStr).join(', ') : '-'
  const misc = p.adjectiveStars.length ? p.adjectiveStars.map(s => s.name).join(', ') : '-'
  const su = surrounded?.[idx]
  const lines = [
    `[${p.name}] ${p.heavenlyStem}${p.earthlyBranch}${p.isBodyPalace ? ' (신궁)' : ''}`,
    `주성: ${major}`, `보성: ${minor}`, `잡성: ${misc}`,
    `장생12: ${p.changsheng12 || '-'} / 박사12: ${p.boshi12 || '-'}`,
    `장전12: ${p.jiangqian12 || '-'} / 태세12: ${p.suiqian12 || '-'}`,
    p.stage ? `대한: ${p.stage.from}~${p.stage.to}세` : '',
    p.ages?.length ? `소한: ${p.ages.join(', ')}세` : '',
    su ? `삼합: ${palaces[su.trine[0]]?.name ?? '-'}, ${palaces[su.trine[1]]?.name ?? '-'} / 대궁: ${palaces[su.opposite]?.name ?? '-'}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}

function buildFullText(chart: Chart, selectedIndex: number): string {
  const s = chart.saju
  const lines = [
    `=== 만세력 사주 (절기 기반) ===`,
    `년주: ${s.year.cn}(${s.year.ko})  월주: ${s.month.cn}(${s.month.ko})  일주: ${s.day.cn}(${s.day.ko})  시주: ${s.hour.cn}(${s.hour.ko})`,
    '', `양력: ${chart.solarDate}`, `음력: ${chart.lunarDate}`,
    `시각: ${chart.time} (${chart.timeRange})`,
    `명주: ${chart.soul} / 신주: ${chart.body}`, `오행국: ${chart.fiveElementsClass}`,
    '', `=== 12궁 ===`,
  ]
  for (let i = 0; i < chart.palaces.length; i++) {
    lines.push(buildPalaceText(chart.palaces[i], chart.palaces, chart.surrounded, i), '')
  }
  if (chart.flies?.length) {
    lines.push(`=== 비성사화 ===`)
    for (const f of chart.flies) {
      lines.push(`${f.fromPalace} -> ${f.routes.map(r => `${r.mutagenKo}:${r.toPalace || '-'}`).join(' ')}`)
    }
    lines.push('')
  }
  if (chart.horoscope) {
    lines.push(`=== 운한 ===`)
    for (const [label, data] of [['대한', chart.horoscope.decadal], ['유년', chart.horoscope.yearly], ['유월', chart.horoscope.monthly], ['유일', chart.horoscope.daily], ['유시', chart.horoscope.hourly]] as [string, HScope][]) {
      if (data) lines.push(`${label}: ${data.heavenlyStem}${data.earthlyBranch} ${data.name} (사화: ${data.mutagen.join(', ') || '-'})`)
    }
  }
  if (chart.palaces[selectedIndex]) {
    lines.push('', `=== 선택 궁 상세 ===`)
    lines.push(buildPalaceText(chart.palaces[selectedIndex], chart.palaces, chart.surrounded, selectedIndex))
  }
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/*  Saju Pillar component                                              */
/* ------------------------------------------------------------------ */

const STEM_COLOR: Record<string, string> = {
  '\u7532': '#4ade80', '\u4e59': '#4ade80',
  '\u4e19': '#f87171', '\u4e01': '#f87171',
  '\u620a': '#facc15', '\u5df1': '#facc15',
  '\u5e9a': '#d4d4d8', '\u8f9b': '#d4d4d8',
  '\u58ec': '#60a5fa', '\u7678': '#60a5fa',
}
const BRANCH_COLOR: Record<string, string> = {
  '\u5b50': '#60a5fa', '\u4e11': '#facc15', '\u5bc5': '#4ade80', '\u536f': '#4ade80',
  '\u8fb0': '#facc15', '\u5df3': '#f87171', '\u5348': '#f87171', '\u672a': '#facc15',
  '\u7533': '#d4d4d8', '\u9149': '#d4d4d8', '\u620c': '#facc15', '\u4ea5': '#60a5fa',
}

function PillarBox({ label, pillar }: { label: string; pillar: SajuPillar }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-700/60 bg-zinc-900/50 text-base font-bold" style={{ color: STEM_COLOR[pillar.stem] ?? '#e4e4e7' }}>{pillar.stem}</div>
      <div className="text-[9px] text-zinc-500">{pillar.stemKo}</div>
      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-700/60 bg-zinc-900/50 text-base font-bold" style={{ color: BRANCH_COLOR[pillar.branch] ?? '#e4e4e7' }}>{pillar.branch}</div>
      <div className="text-[9px] text-zinc-500">{pillar.branchKo}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

function App() {
  const workerRef = useRef<Worker | null>(null)
  const reqIdRef = useRef(0)
  const lastReqIdRef = useRef<number | null>(null)
  const debounceRef = useRef<number | null>(null)
  const [workerReady, setWorkerReady] = useState(false)
  const [workerError, setWorkerError] = useState<string | null>(null)

  const [request, setRequest] = useState<ChartRequest>(() => ({
    calendar: 'solar',
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    gender: '\ub0a8',
    language: 'ko-KR',
    isLeapMonth: false,
    fixLeap: true,
    flowDate: new Date().toISOString().slice(0, 10),
    flowTime: new Date().toTimeString().slice(0, 5),
  }))

  const [busy, setBusy] = useState(false)
  const [_calcError, setCalcError] = useState<string | null>(null)
  const [result, setResult] = useState<Chart | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'stars' | 'horoscope' | 'flies'>('stars')
  const chartRef = useRef<HTMLDivElement | null>(null)

  const palaces: Palace[] = result?.palaces ?? []
  const selectedPalace = palaces[selectedIndex] ?? null
  const surrounded = result?.surrounded ?? null
  const selectedSurrounded = surrounded?.[selectedIndex] ?? null

  // Clear error on any input change
  useEffect(() => { setCalcError(null) }, [request])

  /* ---------- Worker ---------- */
  useEffect(() => {
    const worker = new Worker(new URL('./worker/py.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (ev: MessageEvent<unknown>) => {
      const msg = ev.data as { type?: string; id?: number; result?: unknown; error?: string }
      if (msg?.type === 'ready') { setWorkerReady(true); setWorkerError(null); return }
      if (msg?.type === 'result') {
        if (typeof msg.id === 'number' && lastReqIdRef.current === msg.id) {
          setBusy(false); setCalcError(null); setResult(msg.result as Chart); setSelectedIndex(0)
        }
        return
      }
      if (msg?.type === 'error') {
        if (typeof msg.id === 'number' && lastReqIdRef.current !== msg.id) return
        setBusy(false)
        if (!workerReady) setWorkerError(typeof msg.error === 'string' ? msg.error : 'unknown')
        // Don't set calcError - suppress errors silently, keep last valid result
      }
    }
    worker.postMessage({ type: 'init' })
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); worker.terminate(); workerRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const postCalc = useCallback((payload: ChartRequest) => {
    const w = workerRef.current
    if (!w) return
    const id = ++reqIdRef.current
    lastReqIdRef.current = id
    setBusy(true)
    w.postMessage({ type: 'calc', id, payload })
  }, [])

  useEffect(() => {
    if (!workerReady) return
    if (!isValidDate(request.date)) return
    if (request.time && !isValidTime(request.time)) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => postCalc(request), 300)
  }, [request, workerReady, postCalc])

  /* ---------- Actions ---------- */
  async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text); setCopyStatus('\ubcf5\uc0ac\ub428'); window.setTimeout(() => setCopyStatus(null), 1200) }
    catch { setCopyStatus('\ubcf5\uc0ac \uc2e4\ud328'); window.setTimeout(() => setCopyStatus(null), 2000) }
  }
  async function downloadPng() {
    if (!chartRef.current || !result) return
    const d = await toPng(chartRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: '#0a0a12' })
    const a = document.createElement('a'); a.href = d; a.download = `ziwei-${result.solarDate || 'chart'}.png`; a.click()
  }
  async function downloadPdf() {
    if (!chartRef.current || !result) return
    const d = await toPng(chartRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: '#0a0a12' })
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight()
    const img = new Image(); img.src = d
    await new Promise<void>((r, e) => { img.onload = () => r(); img.onerror = () => e() })
    const sc = Math.min(pw / img.width, ph / img.height)
    pdf.addImage(d, 'PNG', (pw - img.width * sc) / 2, (ph - img.height * sc) / 2, img.width * sc, img.height * sc)
    pdf.save(`ziwei-${result.solarDate || 'chart'}.pdf`)
  }

  /* ---------- Grid: standard 자미두수 배치 ---------- */
  // iztro index: 0=寅 1=卯 2=辰 3=巳 4=午 5=未 6=申 7=酉 8=戌 9=亥 10=子 11=丑
  // Grid layout (counter-clockwise from bottom-left):
  //   巳(3)  午(4)  未(5)  申(6)
  //   辰(2)  [center]       酉(7)
  //   卯(1)  [center]       戌(8)
  //   寅(0)  丑(11) 子(10) 亥(9)
  const GRID_POS = useMemo(() => [
    { row: 3, col: 0 },  // 0: 寅
    { row: 2, col: 0 },  // 1: 卯
    { row: 1, col: 0 },  // 2: 辰
    { row: 0, col: 0 },  // 3: 巳
    { row: 0, col: 1 },  // 4: 午
    { row: 0, col: 2 },  // 5: 未
    { row: 0, col: 3 },  // 6: 申
    { row: 1, col: 3 },  // 7: 酉
    { row: 2, col: 3 },  // 8: 戌
    { row: 3, col: 3 },  // 9: 亥
    { row: 3, col: 2 },  // 10: 子
    { row: 3, col: 1 },  // 11: 丑
  ], [])

  const isMingGong = (p: Palace) => p.name === '\uba85\uad81' || p.name === '\u547d\u5bab'

  /* ---------- Render ---------- */
  return (
    <div className="flex h-dvh overflow-hidden text-zinc-100" style={{ background: 'linear-gradient(135deg, #080818 0%, #0a0a14 50%, #060612 100%)' }}>

      {/* ========== LEFT: Chart ========== */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex flex-shrink-0 items-center justify-between border-b border-zinc-800/30 px-5 py-2">
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-bold tracking-tight">자미두수 명반</h1>
            {busy && <span className="text-[10px] text-zinc-500">계산 중...</span>}
            {copyStatus && <span className="text-[10px] text-emerald-400">{copyStatus}</span>}
          </div>
          <div className="flex gap-1.5">
            {(['텍스트 복사', '이미지 저장', 'PDF 저장'] as const).map((label) => (
              <button
                key={label}
                type="button"
                className="cursor-pointer rounded-md border border-zinc-800/50 bg-zinc-900/30 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800/40 hover:text-zinc-200 disabled:cursor-default disabled:opacity-30"
                disabled={!result}
                onClick={() => {
                  if (label === '텍스트 복사' && result) copyText(buildFullText(result, selectedIndex))
                  if (label === '이미지 저장') downloadPng()
                  if (label === 'PDF 저장') downloadPdf()
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {workerError && (
          <div className="mx-5 mt-3 rounded-lg border border-red-900/30 bg-red-950/15 px-3 py-2 text-xs text-red-400">
            초기화 실패. 새로고침해 주세요.
          </div>
        )}

        {/* 4x4 Grid */}
        <div ref={chartRef} className="min-h-0 flex-1 px-4 py-4">
          <div className="grid h-full grid-cols-4 grid-rows-4 gap-1.5">
            {GRID_POS.map((pos, idx) => {
              const palace = palaces[idx]
              if (!palace) return <div key={idx} style={{ gridColumn: pos.col + 1, gridRow: pos.row + 1 }} />
              const active = idx === selectedIndex
              const ming = isMingGong(palace)
              // 삼방사정 highlight
              const selSu = surrounded?.[selectedIndex]
              const isTrine = selSu?.trine.includes(idx) ?? false
              const isOpposite = selSu?.opposite === idx
              return (
                <button
                  key={idx}
                  type="button"
                  className={palaceCellClass(active, isTrine, isOpposite, ming)}
                  style={{ gridColumn: pos.col + 1, gridRow: pos.row + 1 }}
                  onClick={() => setSelectedIndex(idx)}
                >
                  {/* Header: name + badges | 간지 right */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className={`text-base font-bold ${palaceNameColor(palace.name)}`}>
                        {palace.name}
                      </span>
                      {palace.isBodyPalace && <span className="rounded bg-sky-500/25 px-1 py-px text-[11px] font-bold text-sky-300">신</span>}
                      {isTrine && !active && <span className="rounded bg-sky-500/20 px-1 py-px text-[11px] font-bold text-sky-400">삼</span>}
                      {isOpposite && !active && <span className="rounded bg-orange-500/20 px-1 py-px text-[11px] font-bold text-orange-400">대</span>}
                    </div>
                    <span className="text-xs text-zinc-400">{palace.heavenlyStem}{palace.earthlyBranch}</span>
                  </div>

                  {/* Major stars */}
                  <div className="mt-1.5 space-y-0.5">
                    {palace.majorStars.map((s, si) => (
                      <div key={si} className="flex items-baseline gap-1">
                        <span className="text-base font-bold text-white">{s.name}</span>
                        {fmtBright(s.brightness) && <span className="text-xs text-zinc-300">{fmtBright(s.brightness)}</span>}
                        {s.mutagen && <span className={`text-sm font-bold ${mutagenColor(s.mutagen)}`}>{s.mutagen}</span>}
                      </div>
                    ))}
                  </div>

                  {/* Minor stars - colored by type */}
                  {palace.minorStars.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-0.5">
                      {palace.minorStars.map((s, si) => (
                        <span key={si} className={`text-xs ${minorColor(s.type)}`}>
                          {s.name}{fmtBright(s.brightness) ? `(${fmtBright(s.brightness)})` : ''}
                          {s.mutagen ? <span className={`font-bold ${mutagenColor(s.mutagen)}`}> {s.mutagen}</span> : null}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Adjective stars (잡성) */}
                  {palace.adjectiveStars.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-0.5">
                      {palace.adjectiveStars.map((s, si) => (
                        <span key={si} className={`text-xs font-medium ${adjColor(s.type)}`}>{s.name}</span>
                      ))}
                    </div>
                  )}

                  {/* 12신 */}
                  {(palace.changsheng12 || palace.boshi12) && (
                    <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-zinc-300">
                      {palace.changsheng12 && <span><span className="text-zinc-500">장</span>{palace.changsheng12}</span>}
                      {palace.boshi12 && <span><span className="text-zinc-500">박</span>{palace.boshi12}</span>}
                      {palace.jiangqian12 && <span><span className="text-zinc-500">전</span>{palace.jiangqian12}</span>}
                      {palace.suiqian12 && <span><span className="text-zinc-500">세</span>{palace.suiqian12}</span>}
                    </div>
                  )}

                  {/* Stage */}
                  {palace.stage && (
                    <div className="mt-auto pt-0.5 text-right text-xs text-zinc-400">
                      {palace.stage.from}-{palace.stage.to}세
                    </div>
                  )}
                </button>
              )
            })}

            {/* Center 2x2 - Chart info */}
            <div className="col-start-2 col-end-4 row-start-2 row-end-4 flex flex-col items-center justify-center gap-3 rounded-lg border border-zinc-800/15 bg-zinc-950/25 p-4">
              {result ? (
                <>
                  <div className="text-center">
                    <div className="text-lg font-bold text-zinc-100">자미두수 명반</div>
                    <div className="mt-1 text-sm text-zinc-400">{result.solarDate} ({result.lunarDate})</div>
                    <div className="text-sm text-zinc-400">{result.time} ({result.timeRange})</div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    <div><span className="text-zinc-400">명주</span> <span className="font-bold text-violet-300">{result.soul}</span></div>
                    <div><span className="text-zinc-400">신주</span> <span className="font-bold text-sky-300">{result.body}</span></div>
                    <div className="col-span-2 text-center"><span className="text-zinc-400">오행국</span> <span className="font-bold text-amber-300">{result.fiveElementsClass}</span></div>
                  </div>
                  {result.saju && (
                    <div className="flex gap-3">
                      <PillarBox label="시주" pillar={result.saju.hour} />
                      <PillarBox label="일주" pillar={result.saju.day} />
                      <PillarBox label="월주" pillar={result.saju.month} />
                      <PillarBox label="년주" pillar={result.saju.year} />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-zinc-700">명반을 생성하세요</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========== RIGHT: Sidebar ========== */}
      <aside className="flex w-[360px] flex-shrink-0 flex-col overflow-y-auto border-l border-zinc-800/30 bg-zinc-950/40">

        {/* Input section */}
        <div className="space-y-2.5 border-b border-zinc-800/30 p-4">
          <div className="text-xs font-bold text-zinc-300">입력</div>

          <div className="grid grid-cols-2 gap-1.5">
            {(['solar', 'lunar'] as const).map((c) => (
              <button key={c} type="button"
                className={`cursor-pointer rounded-md border px-2 py-1.5 text-xs transition-colors ${request.calendar === c ? 'border-violet-500/40 bg-violet-500/10 text-zinc-100' : 'border-zinc-800/50 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'}`}
                onClick={() => setRequest(r => ({ ...r, calendar: c }))}
              >{c === 'solar' ? '양력' : '음력'}</button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <label className="grid gap-0.5">
              <span className="text-[10px] text-zinc-500">날짜</span>
              <input className={INPUT_CLS} value={request.date} placeholder="2000-8-16" onChange={e => setRequest(r => ({ ...r, date: e.target.value }))} />
            </label>
            <label className="grid gap-0.5">
              <span className="text-[10px] text-zinc-500">시간</span>
              <input className={INPUT_CLS} value={request.time ?? '12:00'} placeholder="13:05" onChange={e => setRequest(r => ({ ...r, time: e.target.value, timeIndex: undefined }))} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <label className="grid gap-0.5">
              <span className="text-[10px] text-zinc-500">성별</span>
              <select className={`${INPUT_CLS} hover:border-zinc-700`} value={request.gender} onChange={e => setRequest(r => ({ ...r, gender: e.target.value }))}>
                <option value="남">남</option><option value="여">여</option>
              </select>
            </label>
            <label className="grid gap-0.5">
              <span className="text-[10px] text-zinc-500">언어</span>
              <select className={`${INPUT_CLS} hover:border-zinc-700`} value={request.language ?? 'ko-KR'} onChange={e => setRequest(r => ({ ...r, language: e.target.value }))}>
                <option value="ko-KR">한국어</option><option value="zh-CN">简中</option><option value="zh-TW">繁中</option><option value="en-US">EN</option><option value="ja-JP">JP</option>
              </select>
            </label>
          </div>

          {/* Advanced */}
          <button type="button" className="cursor-pointer text-[11px] text-zinc-600 transition-colors hover:text-zinc-400" onClick={() => setShowAdvanced(v => !v)}>
            {showAdvanced ? '고급 설정 접기' : '고급 설정'}
          </button>
          {showAdvanced && (
            <div className="space-y-2 rounded-md border border-zinc-800/30 bg-zinc-950/20 p-2.5">
              <label className="grid gap-0.5"><span className="text-[10px] text-zinc-500">시간 인덱스 (0~12)</span>
                <input className={INPUT_CLS} inputMode="numeric" value={request.timeIndex ?? ''} placeholder="자동" onChange={e => { const v = e.target.value.trim(); setRequest(r => ({ ...r, timeIndex: v === '' ? undefined : Number(v) })) }} />
              </label>
              <label className="flex items-center justify-between"><span className="text-[10px] text-zinc-500">윤달 보정</span><input type="checkbox" checked={request.fixLeap ?? true} onChange={e => setRequest(r => ({ ...r, fixLeap: e.target.checked }))} /></label>
              {request.calendar === 'lunar' && <label className="flex items-center justify-between"><span className="text-[10px] text-zinc-500">윤달 여부</span><input type="checkbox" checked={request.isLeapMonth ?? false} onChange={e => setRequest(r => ({ ...r, isLeapMonth: e.target.checked }))} /></label>}
              <div className="grid grid-cols-2 gap-1.5">
                <label className="grid gap-0.5"><span className="text-[10px] text-zinc-500">운한 날짜</span>
                  <input className={INPUT_CLS} value={request.flowDate ?? ''} placeholder="2026-2-13" onChange={e => setRequest(r => ({ ...r, flowDate: e.target.value }))} />
                </label>
                <label className="grid gap-0.5"><span className="text-[10px] text-zinc-500">운한 시간</span>
                  <input className={INPUT_CLS} value={request.flowTime ?? '00:00'} placeholder="09:30" onChange={e => setRequest(r => ({ ...r, flowTime: e.target.value, flowTimeIndex: undefined }))} />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* 만세력 사주 */}
        {result?.saju && (
          <div className="border-b border-zinc-800/30 p-4">
            <div className="mb-2 text-xs font-bold text-zinc-300">만세력 사주 <span className="font-normal text-zinc-600">(절기 기반)</span></div>
            <div className="flex justify-center gap-4">
              <PillarBox label="시주" pillar={result.saju.hour} />
              <PillarBox label="일주" pillar={result.saju.day} />
              <PillarBox label="월주" pillar={result.saju.month} />
              <PillarBox label="년주" pillar={result.saju.year} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              <div><span className="text-zinc-600">양력</span> <span className="text-zinc-300">{result.solarDate}</span></div>
              <div><span className="text-zinc-600">음력</span> <span className="text-zinc-300">{result.lunarDate}</span></div>
              <div><span className="text-zinc-600">명주</span> <span className="text-zinc-300">{result.soul}</span></div>
              <div><span className="text-zinc-600">신주</span> <span className="text-zinc-300">{result.body}</span></div>
              <div className="col-span-2"><span className="text-zinc-600">오행국</span> <span className="text-zinc-300">{result.fiveElementsClass}</span></div>
            </div>
          </div>
        )}

        {/* Detail tabs */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex gap-1">
            {([['stars', '궁 상세'], ['horoscope', '운한'], ['flies', '비성사화']] as const).map(([k, l]) => (
              <button key={k} type="button"
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs transition-colors ${detailTab === k ? 'bg-violet-500/15 text-violet-300' : 'text-zinc-600 hover:bg-zinc-800/30 hover:text-zinc-400'}`}
                onClick={() => setDetailTab(k)}>{l}</button>
            ))}
          </div>

          {/* Stars */}
          {detailTab === 'stars' && selectedPalace && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${palaceNameColor(selectedPalace.name)}`}>{selectedPalace.name}</span>
                  {selectedPalace.isBodyPalace && <span className="rounded bg-sky-500/25 px-1.5 py-0.5 text-xs font-bold text-sky-300">신궁</span>}
                </div>
                <span className="text-sm text-zinc-400">{selectedPalace.heavenlyStem}{selectedPalace.earthlyBranch}</span>
              </div>

              {/* 주성 */}
              <div>
                <div className="mb-1 text-sm font-semibold text-zinc-300">주성</div>
                {selectedPalace.majorStars.length ? selectedPalace.majorStars.map((s, i) => (
                  <div key={i} className="flex items-baseline gap-1.5 py-0.5">
                    <span className="text-base font-bold text-white">{s.name}</span>
                    {fmtBright(s.brightness) && <span className="text-sm text-zinc-300">({fmtBright(s.brightness)})</span>}
                    {s.mutagen && <span className={`text-sm font-bold ${mutagenColor(s.mutagen)}`}>{s.mutagen}</span>}
                  </div>
                )) : <span className="text-sm text-zinc-600">-</span>}
              </div>

              {/* 보성/살성 - 색상 구분 */}
              <div>
                <div className="mb-1 text-sm font-semibold text-zinc-300">
                  <span className="text-cyan-400">길성</span> / <span className="text-rose-400">살성</span>
                </div>
                <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                  {selectedPalace.minorStars.length ? selectedPalace.minorStars.map((s, i) => (
                    <span key={i} className={`text-sm ${minorColor(s.type)}`}>
                      {s.name}{fmtBright(s.brightness) ? `(${fmtBright(s.brightness)})` : ''}
                      {s.mutagen ? <span className={`font-bold ${mutagenColor(s.mutagen)}`}> {s.mutagen}</span> : null}
                    </span>
                  )) : <span className="text-sm text-zinc-600">-</span>}
                </div>
              </div>

              {/* 잡성 - type 별 색 */}
              <div>
                <div className="mb-1 text-sm font-semibold text-zinc-300">잡성</div>
                <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                  {selectedPalace.adjectiveStars.length ? selectedPalace.adjectiveStars.map((s, i) => (
                    <span key={i} className={`text-sm font-medium ${adjColor(s.type)}`}>{s.name}</span>
                  )) : <span className="text-sm text-zinc-600">-</span>}
                </div>
              </div>

              {/* 12신 / 대한 */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div><span className="text-zinc-400">장생12</span> <span className="text-zinc-200">{selectedPalace.changsheng12 || '-'}</span></div>
                <div><span className="text-zinc-400">박사12</span> <span className="text-zinc-200">{selectedPalace.boshi12 || '-'}</span></div>
                <div><span className="text-zinc-400">장전12</span> <span className="text-zinc-200">{selectedPalace.jiangqian12 || '-'}</span></div>
                <div><span className="text-zinc-400">태세12</span> <span className="text-zinc-200">{selectedPalace.suiqian12 || '-'}</span></div>
                <div><span className="text-zinc-400">대한</span> <span className="text-zinc-100">{selectedPalace.stage ? `${selectedPalace.stage.from}~${selectedPalace.stage.to}세` : '-'}</span></div>
                <div><span className="text-zinc-400">소한</span> <span className="text-zinc-100">{selectedPalace.ages?.length ? selectedPalace.ages.join(', ') + '세' : '-'}</span></div>
              </div>

              {/* 삼방사정 */}
              {selectedSurrounded && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-zinc-400">삼방사정</div>
                  <div className="text-xs text-zinc-200">
                    삼합: {palaces[selectedSurrounded.trine[0]]?.name ?? '-'}, {palaces[selectedSurrounded.trine[1]]?.name ?? '-'}
                    <span className="ml-3 text-zinc-500">대궁: {palaces[selectedSurrounded.opposite]?.name ?? '-'}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-1.5 pt-2">
                <button type="button" className="cursor-pointer rounded-md border border-zinc-700/50 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200" onClick={() => copyText(buildPalaceText(selectedPalace, palaces, surrounded, selectedIndex))}>이 궁 복사</button>
                <button type="button" className="cursor-pointer rounded-md border border-zinc-700/50 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200" onClick={() => result && copyText(buildFullText(result, selectedIndex))} disabled={!result}>전체 복사</button>
              </div>
            </div>
          )}
          {detailTab === 'stars' && !selectedPalace && <div className="text-sm text-zinc-600">궁을 선택하세요</div>}

          {/* Horoscope */}
          {detailTab === 'horoscope' && (
            <div className="space-y-2">
              {result?.horoscope ? ([
                ['\ub300\ud55c', result.horoscope.decadal],
                ['\uc720\ub144', result.horoscope.yearly],
                ['\uc720\uc6d4', result.horoscope.monthly],
                ['\uc720\uc77c', result.horoscope.daily],
                ['\uc720\uc2dc', result.horoscope.hourly],
              ] as [string, HScope][]).map(([label, scope]) => scope && (
                <div key={label} className="rounded-lg border border-zinc-800/30 bg-zinc-950/20 p-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-zinc-100">{label}</span>
                    <span className="text-sm text-zinc-300">{scope.heavenlyStem}{scope.earthlyBranch}</span>
                    <span className="text-sm text-zinc-400">{scope.name}</span>
                  </div>
                  {scope.mutagen.length > 0 && <div className="mt-1 text-sm text-amber-400">사화: {scope.mutagen.join(', ')}</div>}
                  {scope.palaceNames.length > 0 && <div className="mt-1 text-sm text-zinc-400">궁: {scope.palaceNames.join(', ')}</div>}
                </div>
              )) : <div className="text-sm text-zinc-600">운한 데이터 없음</div>}
            </div>
          )}

          {/* Flies */}
          {detailTab === 'flies' && (
            result?.flies?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr><th className="pb-2 text-left font-semibold text-zinc-300">궁</th><th className="pb-2 text-center font-bold text-green-400">록</th><th className="pb-2 text-center font-bold text-green-400">권</th><th className="pb-2 text-center font-bold text-green-400">과</th><th className="pb-2 text-center font-bold text-red-400">기</th></tr></thead>
                  <tbody>
                    {result.flies.map((f, i) => (
                      <tr key={i} className={`border-t border-zinc-800/20 transition-colors hover:bg-zinc-800/15 ${i === selectedIndex ? 'bg-violet-500/8' : ''}`}>
                        <td className={`py-1.5 font-medium ${palaceNameColor(f.fromPalace)}`}>{f.fromPalace}</td>
                        {f.routes.map((r, ri) => <td key={ri} className={`py-1.5 text-center font-medium ${r.to != null ? (ri < 3 ? 'text-green-300' : 'text-red-300') : 'text-zinc-800'}`}>{r.toPalace || '-'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="text-sm text-zinc-600">비성사화 데이터 없음</div>
          )}
        </div>
      </aside>
    </div>
  )
}

export default App
