import type { ChartRequest, ZiweiView } from './types';

export function buildShareUrl(
  req: ChartRequest,
  title?: string,
  currentView?: ZiweiView,
  base: Pick<Location, 'origin' | 'pathname'> = location,
): string {
  const p = new URLSearchParams();
  if (title) p.set('title', title);
  if (currentView && currentView !== 'chart') p.set('view', currentView);
  p.set('cal', req.calendar);
  p.set('date', req.date);
  if (req.time) p.set('time', req.time);
  p.set('gender', req.gender);
  if (req.language && req.language !== 'ko-KR') p.set('lang', req.language);
  if (req.isLeapMonth) p.set('leap', '1');
  if (req.fixLeap === false) p.set('fix', '0');
  if (req.timeIndex != null) p.set('ti', String(req.timeIndex));
  if (req.ziTimeMode && req.ziTimeMode !== 'split') p.set('zi', req.ziTimeMode);
  return `${base.origin}${base.pathname}?${p.toString()}`;
}

export function parseUrlParams(search = location.search): {
  req: Partial<ChartRequest>;
  title: string | null;
  view: ZiweiView;
} | null {
  const p = new URLSearchParams(search);
  if (!p.has('date')) return null;
  const r: Partial<ChartRequest> = {};
  if (p.has('cal') && (p.get('cal') === 'solar' || p.get('cal') === 'lunar')) {
    r.calendar = p.get('cal') as 'solar' | 'lunar';
  }
  if (p.has('date')) r.date = p.get('date')!;
  if (p.has('time')) r.time = p.get('time')!;
  if (p.has('gender')) r.gender = p.get('gender')!;
  if (p.has('lang')) r.language = p.get('lang')!;
  if (p.get('leap') === '1') r.isLeapMonth = true;
  if (p.get('fix') === '0') r.fixLeap = false;
  if (p.has('ti')) r.timeIndex = Number(p.get('ti'));
  if (p.get('zi') === 'fixed') r.ziTimeMode = 'fixed';
  const v = p.get('view');
  const view: ZiweiView = v === 'saju' ? 'saju' : v === 'interpret' ? 'interpret' : 'chart';
  return { req: r, title: p.get('title'), view };
}
