import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * The shell scales whole units -- a card, a Turmoil board, the tile held up for
 * reading -- down to phone width. There are two ways to do that, and only one of them
 * is safe.
 *
 * `zoom` multiplies the computed font sizes. A card's smallest type is 11px, so at
 * the default card scale it asks for a 6.8px font, and iOS will not draw one: it
 * substitutes a floor of its own, and only for the glyphs -- not for the 12px line
 * height, and not for the box around them. The text then grows past both while the
 * artwork stays exactly where it belongs. Nothing in the page can talk that floor
 * down; `-webkit-text-size-adjust` does not reach it.
 *
 * `transform: scale()` is a picture operation. The block is laid out at its full size,
 * with its type at the sizes the stylesheet names, and the finished result is scaled.
 * What it does not do is give back the room it saves, so each place that uses it
 * reserves the scaled size itself.
 *
 * So: scaling something down is `transform`, never `zoom`. Scaling up with `zoom` is
 * fine -- it can only take type further away from the floor.
 */
describe('Text scaling', () => {
  function sources(): Array<string> {
    const files: Array<string> = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(less|vue|ts)$/.test(entry.name)) {
          files.push(full);
        }
      }
    };
    walk(path.resolve('./src/styles'));
    walk(path.resolve('./src/client'));
    return files;
  }

  /** Every `zoom:` declaration in the client, with enough context to name it. */
  function zoomDeclarations(): Array<{file: string, line: number, value: string}> {
    const found: Array<{file: string, line: number, value: string}> = [];
    for (const file of sources()) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((text, index) => {
        const match = text.match(/(^|[^-\w])zoom\s*:\s*([^;}\n]+)/);
        if (match !== null) {
          found.push({
            file: path.relative(path.resolve('.'), file),
            line: index + 1,
            value: match[2].trim().replace(/,$/, ''),
          });
        }
      });
    }
    return found;
  }

  it('never scales anything down with zoom', () => {
    for (const {file, line, value} of zoomDeclarations()) {
      const factor = Number(value);
      const where = `${file}:${line} uses \`zoom: ${value}\``;

      // A value that is not a plain number -- a custom property, a template string --
      // cannot be shown to be an enlargement, so it is not allowed either.
      expect(Number.isFinite(factor), `${where}; scaling down is transform's job`).is.true;
      expect(factor, `${where}, which shrinks the type below what iOS will draw`).is.at.least(1);
    }
  });

  it('still finds the enlargement it is meant to allow, so it is not vacuous', () => {
    const enlargements = zoomDeclarations().filter(({value}) => Number(value) > 1);
    expect(enlargements, 'no zoom declarations found at all; has the scan broken?').is.not.empty;
  });
});
