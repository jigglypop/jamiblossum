export function minorColor(type: string): string {
  switch (type) {
    case 'soft':
      return 'text-brand-700 dark:text-brand-300';
    case 'tough':
      return 'text-rose-600 dark:text-rose-400';
    case 'lucun':
      return 'text-teal-700 dark:text-teal-300';
    case 'helper':
      return 'text-teal-700 dark:text-teal-300';
    case 'flower':
      return 'text-brand-700 dark:text-brand-300';
    default:
      return 'text-gray-700 dark:text-zinc-200';
  }
}

export function adjColor(type: string): string {
  switch (type) {
    case 'flower':
      return 'text-brand-700 dark:text-brand-300';
    case 'helper':
      return 'text-teal-700 dark:text-teal-300';
    case 'tough':
      return 'text-rose-600 dark:text-rose-400';
    case 'soft':
      return 'text-brand-700 dark:text-brand-300';
    default:
      return 'text-gray-600 dark:text-zinc-300';
  }
}

export function palaceNameColor(name: string): string {
  if (/명궁|命宮/.test(name)) return 'text-amber-700 dark:text-amber-300';
  if (/형제|兄弟/.test(name)) return 'text-teal-700 dark:text-teal-300';
  if (/부부|夫妻/.test(name)) return 'text-brand-700 dark:text-brand-300';
  if (/자녀|子女/.test(name)) return 'text-brand-700 dark:text-brand-300';
  if (/재백|財帛/.test(name)) return 'text-teal-700 dark:text-teal-300';
  if (/질액|疾厄/.test(name)) return 'text-rose-700 dark:text-rose-300';
  if (/천이|遷移/.test(name)) return 'text-brand-600 dark:text-brand-400';
  if (/교우|交友|노복|奴僕/.test(name)) return 'text-teal-600 dark:text-teal-400';
  if (/관록|官祿/.test(name)) return 'text-brand-700 dark:text-brand-300';
  if (/전택|田宅/.test(name)) return 'text-lime-700 dark:text-lime-300';
  if (/복덕|福德/.test(name)) return 'text-brand-700 dark:text-brand-300';
  if (/부모|父母/.test(name)) return 'text-amber-700 dark:text-amber-300';
  return 'text-gray-900 dark:text-zinc-100';
}

export function mutagenColor(m: string): string {
  if (/기|忌/.test(m)) return 'text-rose-700 dark:text-rose-300';
  return 'text-teal-700 dark:text-teal-300';
}

export function palaceCellClass(
  active: boolean,
  isTrine: boolean,
  isOpposite: boolean,
  ming: boolean,
): string {
  const base =
    'relative flex cursor-pointer flex-col overflow-y-auto rounded border lg:rounded-lg px-2 py-1.5 lg:px-3 lg:py-2 text-left transition-all';
  if (active) {
    return `${base} border-brand-500/60 bg-brand-50 dark:bg-brand-900/40 shadow-[0_0_16px_rgba(139,92,246,0.15)]`;
  }
  if (isTrine) {
    return `${base} border-brand-400/25 bg-brand-500/10 dark:bg-brand-500/10 hover:border-brand-400/25 dark:hover:bg-brand-500/10`;
  }
  if (isOpposite) {
    return `${base} border-amber-400/25 bg-amber-500/10 dark:bg-amber-500/10 hover:border-amber-400/25 dark:hover:bg-amber-500/10`;
  }
  if (ming) {
    return `${base} border-amber-500/30 bg-amber-50 dark:bg-amber-950/15 hover:border-amber-400/50 dark:hover:bg-amber-950/25`;
  }
  return `${base} border-gray-200 dark:border-zinc-700/30 bg-white dark:bg-zinc-900/30 hover:border-gray-300 dark:hover:border-zinc-600/50 hover:bg-gray-50 dark:hover:bg-zinc-800/40`;
}

export function chartConnectionPoint(pos: { row: number; col: number }): { x: number; y: number } {
  if (pos.row === 0 && pos.col === 0) return { x: 25, y: 25 };
  if (pos.row === 0 && pos.col === 3) return { x: 75, y: 25 };
  if (pos.row === 3 && pos.col === 3) return { x: 75, y: 75 };
  if (pos.row === 3 && pos.col === 0) return { x: 25, y: 75 };
  if (pos.row === 0) return { x: ((pos.col + 0.5) / 4) * 100, y: 25 };
  if (pos.row === 3) return { x: ((pos.col + 0.5) / 4) * 100, y: 75 };
  if (pos.col === 0) return { x: 25, y: ((pos.row + 0.5) / 4) * 100 };
  return { x: 75, y: ((pos.row + 0.5) / 4) * 100 };
}
