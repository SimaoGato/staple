const NS = 'http://www.w3.org/2000/svg';

/** Inline decorative SVG (lucide-style 24x24 strokes), hidden from assistive tech. */
function svg(paths: string[]): SVGSVGElement {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  for (const d of paths) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    s.append(p);
  }
  return s;
}

const ICONS = {
  staple: ['M4 9h16', 'M4 9v6', 'M20 9v6', 'M4 15h16'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M9 12l2 2 4-4'],
  chevron: ['M9 6l6 6-6 6'],
  compress: ['M4 14h6v6', 'M20 10h-6V4', 'M14 10l7-7', 'M3 21l7-7'],
  merge: ['M6 3v6a6 6 0 0 0 6 6h6', 'M18 3v6', 'M15 12l3 3-3 3'],
  split: ['M12 3v6', 'M12 9l-6 6v6', 'M12 9l6 6v6'],
  convert: ['M17 3l4 4-4 4', 'M3 7h18', 'M7 21l-4-4 4-4', 'M21 17H3'],
  resize: ['M15 3h6v6', 'M9 21H3v-6', 'M21 3l-7 7', 'M3 21l7-7'],
} as const;

export type IconName = keyof typeof ICONS;

export const icon = (name: IconName) => svg([...ICONS[name]]);
