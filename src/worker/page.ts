// Rewrites the shipped index.html to name one link: the title tab apps show
// and the title, description and og: tags a chat app builds a link preview
// from. Cloudflare's HTMLRewriter would parse this properly, but it exists
// only in Cloudflare's runtime, not in the Node tests that check this rewrite
// against the real file — so this edits the HTML as text instead.

export interface PageTags {
  title: string;
  description: string;
  url: string;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// A function replacer, not a template string: a link's title can carry a
// search term with "$&" or "$1" in it, which `String.replace` would read as
// a backreference in a string replacement.
function replaceMetaContent(html: string, attr: string, name: string, content: string): string {
  const pattern = new RegExp(`(<meta\\s+${attr}="${name}"\\s+content=")[^"]*("\\s*/?>)`);
  return html.replace(pattern, (_, before, after) => `${before}${escapeAttr(content)}${after}`);
}

/** The page with its title, description and og: tags naming one link. */
export function rewritePage(html: string, tags: PageTags): string {
  let page = html.replace(
    /<title>[\s\S]*?<\/title>/,
    () => `<title>${escapeAttr(tags.title)}</title>`,
  );
  page = replaceMetaContent(page, 'name', 'description', tags.description);
  page = replaceMetaContent(page, 'property', 'og:title', tags.title);
  page = replaceMetaContent(page, 'property', 'og:description', tags.description);
  page = replaceMetaContent(page, 'property', 'og:url', tags.url);
  return page;
}
