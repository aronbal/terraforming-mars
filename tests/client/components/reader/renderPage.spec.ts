import {expect} from 'chai';
import {linkKind, renderPage} from '@/client/components/reader/renderPage';
import {readerPage} from '@/client/components/reader/reader';

const RULEBOOKS = readerPage('https://github.com/terraforming-mars/terraforming-mars/wiki/Rulebooks')!;

describe('renderPage', () => {
  it('tells where a link leads', () => {
    expect(linkKind('https://github.com/terraforming-mars/terraforming-mars/wiki/Variants')).eq('page');
    expect(linkKind('https://fryxgames.se/rules.pdf')).eq('pdf');
    expect(linkKind('https://www.youtube.com/watch?v=x')).eq('video');
    expect(linkKind('https://boardgamegeek.com/')).eq('external');
  });

  it('draws a list of links as rows, and leaves out a paragraph that repeats them', () => {
    const html = renderPage([
      '# Rulebooks',
      '* [Base game](https://example.com/base.pdf)',
      '* [Venus Next](https://example.com/venus.pdf)',
      '',
      '(Local copies: [Base game](pdfs/base.pdf) •',
      '[Venus Next](pdfs/venus.pdf)',
      ')',
    ].join('\n'), RULEBOOKS);

    expect(html).to.include('<ul class="reader-links">');
    expect(html).to.include('class="reader-link reader-link--pdf"');
    expect(html).not.to.include('Local copies');
  });

  it('keeps a list that is more than links, and a paragraph with new links', () => {
    const html = renderPage([
      '* [Base game](https://example.com/base.pdf), the core rules',
      '* Plain text',
      '',
      'See [Base game](https://example.com/base.pdf) and [Variants](Variants).',
    ].join('\n'), RULEBOOKS);

    expect(html).not.to.include('reader-links');
    expect(html).to.include('See ');
  });

  it('makes relative links absolute against the wiki', () => {
    const html = renderPage('[Variants](Variants#tr-boost)', RULEBOOKS);
    expect(html).to.include('href="https://github.com/terraforming-mars/terraforming-mars/wiki/Variants#tr-boost"');
  });
});
