import {ref} from 'vue';

/*
 * The in-app reader: the project's wiki pages and README, read inside the app
 * rather than in a new tab.
 *
 * GitHub serves the wiki's Markdown from raw.githubusercontent.com, which answers
 * any origin, so the reader fetches a page straight from there and renders it. A
 * link with an anchor -- the ⓘ beside an option points at one section of the
 * Variants page -- shows only that section, as an info box.
 */

const REPO = 'terraforming-mars/terraforming-mars';
const REPO_URL = `https://github.com/${REPO}`;
const WIKI_URL = `${REPO_URL}/wiki`;
const RAW_WIKI = `https://raw.githubusercontent.com/wiki/${REPO}`;
const RAW_MAIN = `https://raw.githubusercontent.com/${REPO}/main`;

export type ReaderPage = {
  /** Where the Markdown is fetched from. */
  source: string;
  /** The page on GitHub, for "Open in browser" and for resolving relative links. */
  pageUrl: string;
  /** Relative links and images in the page resolve against these. */
  linkBase: string;
  imageBase: string;
  title: string;
  /** A section to show on its own, as GitHub slugs its headings. */
  anchor?: string;
};

/** The page an href names, if the reader can show it. */
export function readerPage(href: string, base: string = WIKI_URL + '/'): ReaderPage | undefined {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return undefined;
  }
  if (url.hostname !== 'github.com') {
    return undefined;
  }
  const anchor = url.hash.length > 1 ? decodeURIComponent(url.hash.slice(1)) : undefined;
  const path = url.pathname.replace(/\/+$/, '');

  if ((path === '/' + REPO && anchor?.toLowerCase() === 'readme') || path === `/${REPO}/blob/main/README.md`) {
    return {
      source: `${RAW_MAIN}/README.md`,
      pageUrl: `${REPO_URL}#readme`,
      linkBase: `${REPO_URL}/blob/main/`,
      imageBase: `${RAW_MAIN}/`,
      title: 'About us',
    };
  }

  const prefix = `/${REPO}/wiki`;
  if (!path.startsWith(prefix)) {
    return undefined;
  }
  const name = decodeURIComponent(path.slice(prefix.length + 1));
  // The wiki's front page, its PDFs and its images are not pages to read.
  if (name === '' || name.includes('/') || name.includes('.')) {
    return undefined;
  }
  return {
    source: `${RAW_WIKI}/${encodeURIComponent(name)}.md`,
    pageUrl: `${WIKI_URL}/${encodeURIComponent(name)}`,
    linkBase: `${WIKI_URL}/`,
    imageBase: `${WIKI_URL}/`,
    title: name.replace(/-/g, ' '),
    anchor,
  };
}

/** The anchor GitHub gives a heading: lower case, punctuation dropped, spaces as hyphens. */
export function slugOf(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

export type Section = {
  title: string;
  markdown: string;
};

/**
 * The heading an anchor names and everything under it, up to the next heading of
 * the same or a higher level. Undefined when no heading has that anchor.
 */
export function sectionOf(markdown: string, anchor: string): Section | undefined {
  const lines = markdown.split('\n');
  const wanted = anchor.toLowerCase();
  let start = -1;
  let level = 0;
  let title = '';
  for (let i = 0; i < lines.length; i++) {
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(lines[i]);
    if (heading === null) {
      continue;
    }
    if (start === -1) {
      if (slugOf(heading[2]) === wanted) {
        start = i;
        level = heading[1].length;
        title = heading[2];
      }
    } else if (heading[1].length <= level) {
      return {title, markdown: lines.slice(start + 1, i).join('\n').trim()};
    }
  }
  return start === -1 ? undefined : {title, markdown: lines.slice(start + 1).join('\n').trim()};
}

/** The pages the reader has open, the one on top showing. */
export const readerStack = ref<ReadonlyArray<ReaderPage>>([]);

export function openReader(page: ReaderPage): void {
  readerStack.value = [...readerStack.value, page];
}

/** Opens the page an href names, and says whether it could. */
export function openReaderAt(href: string, base?: string): boolean {
  const page = readerPage(href, base);
  if (page === undefined) {
    return false;
  }
  openReader(page);
  return true;
}

export function readerBack(): void {
  readerStack.value = readerStack.value.slice(0, -1);
}

export function closeReader(): void {
  readerStack.value = [];
}

/** The pages the menus offer, under the names the menus give them. */
export const HELP_PAGES = {
  howToPlay: `${WIKI_URL}/Rulebooks`,
  variants: `${WIKI_URL}/Variants`,
  changelog: `${WIKI_URL}/Changelog`,
  about: `${REPO_URL}#README`,
} as const;
