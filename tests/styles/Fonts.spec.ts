import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * The card boxes are fixed pixel sizes drawn for one set of font metrics, and the
 * card titles are fitted by measuring them. Both assume the font the stylesheet
 * names is the font the browser actually uses, so anything that can leave a browser
 * without it -- a CDN that is slow, blocked, or simply not there for an installed
 * PWA -- shows up as text that overflows its card.
 *
 * These are the two ways that can come back: a face fetched from somewhere else, and
 * a face whose file is not where the stylesheet says it is.
 */
describe('Fonts', () => {
  const STYLES_DIR = path.resolve('./src/styles');
  const REPO_ROOT = path.resolve('.');

  function styleSheets(): Array<string> {
    return fs.readdirSync(STYLES_DIR)
      .filter((name) => name.endsWith('.less'))
      .map((name) => path.join(STYLES_DIR, name));
  }

  function fontFaceSources(): Array<{file: string, url: string}> {
    const sources: Array<{file: string, url: string}> = [];
    for (const file of styleSheets()) {
      const css = fs.readFileSync(file, 'utf8');
      for (const block of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
        for (const match of block.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
          sources.push({file: path.basename(file), url: match[1]});
        }
      }
    }
    return sources;
  }

  it('declares some faces at all, so the checks below are not vacuous', () => {
    expect(fontFaceSources()).is.not.empty;
  });

  it('serves every face from this origin', () => {
    for (const {file, url} of fontFaceSources()) {
      expect(url, `${file} fetches a font from somewhere else`).does.not.match(/^(https?:)?\/\//);
    }
  });

  it('points every face at a file that is really there', () => {
    for (const {file, url} of fontFaceSources()) {
      // The stylesheets are compiled to build/styles.css, one directory below the
      // repository root, so their `./assets/...` is the repository's own assets.
      const resolved = path.resolve(REPO_ROOT, url.replace(/^\.\//, ''));
      expect(fs.existsSync(resolved), `${file} names ${url}, which does not exist`).is.true;

      // wOF2, so a stray HTML error page saved over a font is caught too.
      const magic = fs.readFileSync(resolved).subarray(0, 4).toString('latin1');
      expect(magic, `${url} is not a font`).is.oneOf(['wOF2', 'wOFF', '\u0000\u0001\u0000\u0000', 'true', 'OTTO']);
    }
  });

  it('asks the page for no stylesheet but its own', () => {
    const html = fs.readFileSync(path.resolve('./assets/index.html'), 'utf8');
    for (const match of html.matchAll(/<link\b[^>]*>/g)) {
      const tag = match[0];
      if (!/rel\s*=\s*['"]?stylesheet/.test(tag)) {
        continue;
      }
      expect(tag, 'index.html loads a stylesheet from somewhere else').does.not.match(/href\s*=\s*['"]?(https?:)?\/\//);
    }
  });

  it('declares the body font itself', () => {
    const common = fs.readFileSync(path.join(STYLES_DIR, 'common.less'), 'utf8');
    const faces = common.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    const ubuntu = faces.filter((face) => /font-family:\s*['"]?Ubuntu/i.test(face));
    // Regular and bold: a card title asks for bold, and without a bold face the
    // browser smears the regular one wider than the box it was fitted to.
    expect(ubuntu.some((face) => /font-weight:\s*400/.test(face)), 'no regular Ubuntu face').is.true;
    expect(ubuntu.some((face) => /font-weight:\s*700/.test(face)), 'no bold Ubuntu face').is.true;
  });

  it('never lets the engine pick its own text size', () => {
    const common = fs.readFileSync(path.join(STYLES_DIR, 'common.less'), 'utf8');
    expect(common, 'text autosizing is not turned off').to.match(/-webkit-text-size-adjust:\s*none/);

    /*
     * iOS boosts small text without touching the line height or the box around it,
     * which inside the mobile shell -- where a whole card is scaled down -- is every
     * word on the card. Only `none` turns that off; a percentage scales an
     * adjustment that is applied anyway.
     */
    for (const file of styleSheets()) {
      const css = fs.readFileSync(file, 'utf8');
      for (const match of css.matchAll(/text-size-adjust:\s*([^;]+);/g)) {
        expect(match[1].trim(), `${path.basename(file)} asks for text-size-adjust: ${match[1].trim()}`).eq('none');
      }
    }
  });
});
