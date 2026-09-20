import {expect} from 'chai';
import {fitText} from '@/client/utils/textFit';
import {FakeLocalStorage} from './components/FakeLocalStorage';

/*
 * jsdom has no layout engine, so each element is told what its box is and how wide
 * its text would be: a font size of N draws it `widthPerPx * N` wide. That is enough
 * to exercise the part that matters -- shrinking until it fits, and what a fitted
 * size may afterwards be reused for.
 */
function element(text: string, clientWidth: number, widthPerPx: number): HTMLElement {
  const el = document.createElement('div');
  el.dataset.fitted = '1';
  el.textContent = text;
  fake(el, 'clientWidth', () => clientWidth);
  fake(el, 'clientHeight', () => 100);
  fake(el, 'scrollHeight', () => 100);
  fake(el, 'scrollWidth', () => Math.ceil(widthPerPx * fontSize(el)));
  return el;
}

function fake(el: HTMLElement, property: string, get: () => number): void {
  Object.defineProperty(el, property, {get, configurable: true});
}

/** The size fitText has arrived at, or the 16px a stylesheet would have started it from. */
function fontSize(el: HTMLElement): number {
  const inline = parseFloat(el.style.fontSize);
  return Number.isFinite(inline) && inline > 0 ? inline : 16;
}

describe('textFit', () => {
  let localStorage: FakeLocalStorage;
  let realGetComputedStyle: typeof getComputedStyle;
  let unique = 0;

  /* The cache is keyed on the text, and lives for the whole run, so each case works
     on a phrase no other case has used. */
  function phrase(): string {
    unique++;
    return `Phrase number ${unique}`;
  }

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);

    /* jsdom computes no styles for an element that was never in a document, and
       fitText reads the stylesheet's size to start shrinking from. Stand in for the
       cascade: 16px, the size the card title sheet sets. */
    realGetComputedStyle = getComputedStyle;
    (global as unknown as {getComputedStyle: unknown}).getComputedStyle = (el: Element) => {
      if (el instanceof HTMLElement && el.dataset.fitted === '1') {
        return {fontSize: el.style.fontSize === '' ? '16px' : el.style.fontSize};
      }
      return realGetComputedStyle(el);
    };
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
    (global as unknown as {getComputedStyle: unknown}).getComputedStyle = realGetComputedStyle;
  });

  it('shrinks the text until it stops overflowing', () => {
    // 8px of text per px of font: 16px would draw 128 wide in a box of 100.
    const el = element(phrase(), 100, 8);

    fitText(el, 'card-title');

    expect(fontSize(el)).eq(12);
  });

  it('leaves text that already fits alone', () => {
    const el = element(phrase(), 400, 8);

    fitText(el, 'card-title');

    expect(fontSize(el)).eq(16);
  });

  it('never shrinks past the smallest legible size', () => {
    const el = element(phrase(), 10, 8);

    fitText(el, 'card-title');

    expect(fontSize(el)).eq(10);
  });

  it('does not measure an element that has no box', () => {
    const el = element(phrase(), 0, 8);

    fitText(el, 'card-title');

    expect(el.style.fontSize).eq('');
  });

  /*
   * The bug this guards: a size is the answer to "how big can this text be in a box
   * this wide", and the shell draws the same card at whatever scale the player chose.
   * Keyed on the text alone, the answer for the wide box was handed to the narrow one
   * -- and it was kept in localStorage for two days, so the overflow outlived whatever
   * had caused it.
   */
  it('does not reuse a size fitted in a box of another width', () => {
    const text = phrase();
    const wide = element(text, 400, 8);
    fitText(wide, 'card-title');
    expect(fontSize(wide)).eq(16);

    const narrow = element(text, 100, 8);
    fitText(narrow, 'card-title');

    expect(fontSize(narrow)).eq(12);
  });

  it('reuses a size fitted in a box of the same width', () => {
    const text = phrase();
    const first = element(text, 100, 8);
    fitText(first, 'card-title');

    // The second element claims the text is far wider; it must take the cached
    // answer rather than measure, which is what makes the cache worth having.
    const second = element(text, 100, 40);
    fitText(second, 'card-title');

    expect(fontSize(second)).eq(12);
  });

  it('keeps each context to its own answer', () => {
    const text = phrase();
    const title = element(text, 100, 8);
    fitText(title, 'card-title');

    const milestone = element(text, 100, 16);
    fitText(milestone, 'milestone');

    expect(fontSize(title)).eq(12);
    expect(fontSize(milestone)).eq(10);
  });
});
