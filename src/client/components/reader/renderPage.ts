import MarkdownIt from 'markdown-it';
import {ReaderPage, readerPage} from '@/client/components/reader/reader';

// The wiki lays some pages out in raw HTML -- a table that sets a list beside a
// picture -- so HTML is parsed, and `sanitize` then keeps only what reads safely.
const md = new MarkdownIt({html: true, linkify: true, breaks: false});

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

const ALLOWED_TAGS = new Set([
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'code', 'pre', 'kbd', 'sub', 'sup', 'br', 'hr',
  'p', 'div', 'span', 'section', 'blockquote', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'details', 'summary',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'img',
]);

// Gone with everything inside them, not just unwrapped.
const DROPPED_TAGS = new Set([
  'script', 'style', 'iframe', 'frame', 'object', 'embed', 'noscript', 'template', 'link', 'meta', 'base',
  'form', 'input', 'button', 'textarea', 'select', 'svg', 'math', 'audio', 'video', 'canvas',
]);

const ALLOWED_ATTRIBUTES: Record<string, ReadonlySet<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  td: new Set(['colspan', 'rowspan', 'align', 'valign']),
  th: new Set(['colspan', 'rowspan', 'align', 'valign']),
  ol: new Set(['start']),
};

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/* An absolute http(s) URL for a link or a picture, or undefined for anything else. */
function safeUrl(url: string, base: string): string | undefined {
  try {
    const resolved = new URL(url, base);
    return resolved.protocol === 'https:' || resolved.protocol === 'http:' ? resolved.href : undefined;
  } catch {
    return undefined;
  }
}

function clean(parent: Node, page: ReaderPage): void {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === TEXT_NODE) {
      continue;
    }
    if (child.nodeType !== ELEMENT_NODE) {
      parent.removeChild(child);
      continue;
    }
    const element = child as Element;
    const tag = element.tagName.toLowerCase();
    if (DROPPED_TAGS.has(tag)) {
      parent.removeChild(element);
      continue;
    }
    clean(element, page);
    if (!ALLOWED_TAGS.has(tag)) {
      // An unknown tag keeps its text.
      while (element.firstChild !== null) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      // The reader's own classes, which `renderPage` adds; nothing the page brings.
      if (name === 'class' && attribute.value.split(/\s+/).every((value) => value.startsWith('reader-'))) {
        continue;
      }
      if (ALLOWED_ATTRIBUTES[tag]?.has(name) !== true) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (name === 'href' || name === 'src') {
        const url = safeUrl(attribute.value, name === 'src' ? page.imageBase : page.linkBase);
        if (url === undefined) {
          element.removeAttribute(attribute.name);
        } else {
          element.setAttribute(attribute.name, url);
        }
      }
    }
  }
}

/** Rendered HTML with only the tags, attributes and http(s) URLs the reader allows. */
export function sanitize(html: string, page: ReaderPage): string {
  // A template's content is inert: nothing in it loads or runs while it is cleaned.
  const template = document.createElement('template');
  template.innerHTML = html;
  clean(template.content, page);
  return template.innerHTML;
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
 * list with "(Local copies: ...)", the same rulebooks again -- is left out. The
 * result is sanitized last, so the page's own HTML keeps only what `sanitize` allows.
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

  return sanitize(md.renderer.render(out, md.options, env), page);
}
