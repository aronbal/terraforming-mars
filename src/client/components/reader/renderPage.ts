import MarkdownIt from 'markdown-it';
import {ReaderPage, readerPage} from '@/client/components/reader/reader';

// No raw HTML from the page: what renders is only what Markdown can express.
const md = new MarkdownIt({html: false, linkify: true, breaks: false});

type Token = ReturnType<typeof md.parse>[number];

/** What a link leads to, which decides the mark at the end of its row. */
export function linkKind(href: string): 'page' | 'pdf' | 'video' | 'external' {
  if (readerPage(href) !== undefined) {
    return 'page';
  }
  if (/\.pdf($|[?#])/i.test(href)) {
    return 'pdf';
  }
  if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(href)) {
    return 'video';
  }
  return 'external';
}

function resolve(url: string, base: string): string {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

/* The link texts in an inline token, and whether it holds nothing but links. */
function linksIn(inline: Token): {texts: Array<string>, onlyLink: boolean} {
  const texts: Array<string> = [];
  let depth = 0;
  let current = '';
  let outside = '';
  for (const child of inline.children ?? []) {
    if (child.type === 'link_open') {
      depth++;
      current = '';
    } else if (child.type === 'link_close') {
      depth--;
      texts.push(current.trim());
    } else if (depth > 0) {
      current += child.content;
    } else {
      outside += child.content;
    }
  }
  return {texts, onlyLink: texts.length === 1 && outside.trim() === ''};
}

/**
 * A wiki page as the reader draws it.
 *
 * Relative links and images are made absolute against where the page lives. Two
 * things the wiki writes for a wide screen are redrawn for a phone: a list whose
 * every item is a single link becomes rows, each marked with where it leads; and a
 * paragraph that only repeats links already given -- the Rulebooks page follows its
 * list with "(Local copies: ...)", the same rulebooks again -- is left out.
 */
export function renderPage(markdown: string, page: ReaderPage): string {
  const env = {};
  const tokens = md.parse(markdown, env);

  for (const token of tokens) {
    for (const child of token.children ?? []) {
      if (child.type === 'link_open') {
        const href = child.attrGet('href');
        if (href !== null) {
          child.attrSet('href', resolve(href, page.linkBase));
        }
      } else if (child.type === 'image') {
        const src = child.attrGet('src');
        if (src !== null) {
          child.attrSet('src', resolve(src, page.imageBase));
        }
      }
    }
  }

  const seen = new Set<string>();
  const out: Array<Token> = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'bullet_list_open') {
      const close = tokens.findIndex((t, j) => j > i && t.type === 'bullet_list_close' && t.level === token.level);
      const inlines = tokens.slice(i, close).filter((t) => t.type === 'inline');
      const items = tokens.slice(i, close).filter((t) => t.type === 'list_item_open' && t.level === token.level + 1).length;
      if (items > 0 && inlines.length === items && inlines.every((inline) => linksIn(inline).onlyLink)) {
        token.attrJoin('class', 'reader-links');
        for (const inline of inlines) {
          const link = inline.children?.find((child) => child.type === 'link_open');
          link?.attrJoin('class', `reader-link reader-link--${linkKind(link.attrGet('href') ?? '')}`);
        }
      }
    }

    if (token.type === 'paragraph_open' && tokens[i + 1]?.type === 'inline') {
      const {texts} = linksIn(tokens[i + 1]);
      if (texts.length >= 2 && texts.every((text) => seen.has(text))) {
        i += 2;
        continue;
      }
    }

    if (token.type === 'inline') {
      linksIn(token).texts.forEach((text) => seen.add(text));
    }
    out.push(token);
  }

  return md.renderer.render(out, md.options, env);
}
