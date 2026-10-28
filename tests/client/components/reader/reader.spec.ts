import {expect} from 'chai';
import {closeReader, openReaderAt, readerBack, readerPage, readerStack, sectionOf, slugOf} from '@/client/components/reader/reader';

describe('reader', () => {
  afterEach(() => closeReader());

  it('reads a wiki page from the raw wiki', () => {
    const page = readerPage('https://github.com/terraforming-mars/terraforming-mars/wiki/Rulebooks');
    expect(page?.source).eq('https://raw.githubusercontent.com/wiki/terraforming-mars/terraforming-mars/Rulebooks.md');
    expect(page?.title).eq('Rulebooks');
    expect(page?.anchor).is.undefined;
  });

  it('keeps the anchor, and names the page without hyphens', () => {
    const page = readerPage('https://github.com/terraforming-mars/terraforming-mars/wiki/Variants#tr-boost');
    expect(page?.anchor).eq('tr-boost');
    expect(readerPage('https://github.com/terraforming-mars/terraforming-mars/wiki/The-Moon')?.title).eq('The Moon');
  });

  it('reads the README for the repository and its README anchor', () => {
    const page = readerPage('https://github.com/terraforming-mars/terraforming-mars#README');
    expect(page?.source).eq('https://raw.githubusercontent.com/terraforming-mars/terraforming-mars/main/README.md');
    expect(page?.anchor).is.undefined;
  });

  it('resolves a wiki page named relative to the wiki', () => {
    expect(readerPage('Variants#merger')?.source).eq('https://raw.githubusercontent.com/wiki/terraforming-mars/terraforming-mars/Variants.md');
  });

  it('leaves everything else to the browser', () => {
    expect(readerPage('https://boardgamegeek.com/boardgame/167791/terraforming-mars')).is.undefined;
    expect(readerPage('https://github.com/terraforming-mars/terraforming-mars/wiki/pdfs/base.pdf')).is.undefined;
    expect(readerPage('https://github.com/terraforming-mars/terraforming-mars/wiki')).is.undefined;
    expect(readerPage('https://github.com/terraforming-mars/terraforming-mars/discussions/7647')).is.undefined;
    expect(readerPage('https://github.com/someone/else/wiki/Page')).is.undefined;
  });

  it('slugs headings the way GitHub does', () => {
    expect(slugOf('TR Boost')).eq('tr-boost');
    expect(slugOf('Show Real-time VP')).eq('show-real-time-vp');
    expect(slugOf('Moon Standard Project Variant #2')).eq('moon-standard-project-variant-2');
  });

  it('cuts one section out of a page', () => {
    const markdown = [
      '# Variants',
      'Intro.',
      '## Custom Game Options',
      '### TR Boost',
      'Start with more TR.',
      '',
      '##### Detail',
      'Still TR Boost.',
      '### Allow Undo',
      'Take it back.',
    ].join('\n');

    expect(sectionOf(markdown, 'tr-boost')).deep.eq({title: 'TR Boost', markdown: 'Start with more TR.\n\n##### Detail\nStill TR Boost.'});
    expect(sectionOf(markdown, 'Allow-Undo')).deep.eq({title: 'Allow Undo', markdown: 'Take it back.'});
    expect(sectionOf(markdown, 'nothing')).is.undefined;
  });

  it('stacks the pages it opens', () => {
    expect(openReaderAt('https://github.com/terraforming-mars/terraforming-mars/wiki/Rulebooks')).is.true;
    expect(openReaderAt('https://github.com/terraforming-mars/terraforming-mars/wiki/Variants')).is.true;
    expect(openReaderAt('https://example.com/')).is.false;
    expect(readerStack.value.map((page) => page.title)).deep.eq(['Rulebooks', 'Variants']);

    readerBack();
    expect(readerStack.value.map((page) => page.title)).deep.eq(['Rulebooks']);
    closeReader();
    expect(readerStack.value).is.empty;
  });
});
