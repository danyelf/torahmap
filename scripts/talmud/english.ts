// The William Davidson English as the popup stores it, in apps/talmud/src/english.ts's markers.
// Neither marker occurs in the English, and a segment that has one fails rather than be misread.

import { BOLD, ITALIC } from '@torahmap/talmud/english.ts';

// <b> is the literal translation; <strong> the MISHNA and GEMARA labels; six spans in Berakhot
// mark translation as <b> does.
const MARKER_OF: Record<string, string> = {
  b: BOLD,
  strong: BOLD,
  'span class="gemarra-regular"': BOLD,
  i: ITALIC,
};

// Where the English needs mending. Berakhot 54a:1 opens its label with a second <strong> and
// closes both at its end; Pesachim 101a:7 leaves a <b> open that 101a:8 closes; Berakhot 52b:34
// ends on a stray ב.
const FIXES: [RegExp, string][] = [
  [/<strong>MISHNA:<strong>(.*) <\/strong><\/strong>$/s, '<strong>MISHNA:</strong>$1'],
  [/<b>dragging\. $/, '<b>dragging.</b>'],
  [/^As it was taught<\/b>/, '<b>As it was taught</b>'],
  [/<\/b>ב$/, '</b>'],
];

/** A segment's English HTML in markers. Throws on a tag it does not know or one left open. */
export function englishMarkers(html: string): string {
  for (const marker of [BOLD, ITALIC]) {
    if (html.includes(marker)) throw new Error(`The English uses the marker ${marker}: ${html}`);
  }
  const source = FIXES.reduce((s, [broken, fixed]) => s.replace(broken, fixed), html);
  const open: string[] = [];
  const inside = (marker: string) => open.some((tag) => MARKER_OF[tag] === marker);
  let out = '';

  let last = 0;
  for (const tag of source.matchAll(/<(\/?)([^>]*)>/g)) {
    out += source.slice(last, tag.index);
    last = tag.index + tag[0].length;
    const [, closing, name] = tag;
    if (/^br\s*\/?$/.test(name)) {
      out += '\n';
      continue;
    }
    const opening = closing ? open.at(-1) : name;
    if (closing && (opening === undefined || opening.split(' ')[0] !== name)) {
      throw new Error(`</${name}> closes ${opening ? `<${opening}>` : 'nothing'}: ${html}`);
    }
    const marker = MARKER_OF[opening!];
    if (!marker) throw new Error(`Unknown tag <${name}>: ${html}`);
    const before = inside(marker);
    if (closing) open.pop();
    else open.push(name);
    if (inside(marker) !== before) {
      // A style closed and opened again at once, as in </b><b>, is one stretch.
      out = out.endsWith(marker) ? out.slice(0, -1) : out + marker;
    }
  }
  if (open.length > 0) throw new Error(`<${open.at(-1)}> is never closed: ${html}`);
  out += source.slice(last);
  if (/[<>]/.test(out)) throw new Error(`A stray angle bracket: ${html}`);
  return out.trim();
}
