import {expect} from 'chai';
import {linkKind, renderPage, sanitize} from '@/client/components/reader/renderPage';
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

  it('draws the HTML the wiki lays pages out with', () => {
    const html = renderPage([
      '<table> <tr><td valign="top"> <ul> <li> ~90 new project cards </ul> </td>',
      '<td> <img src="https://user-images.githubusercontent.com/1/moon.png" width="225" height="300"> </td> </tr> </table>',
    ].join('\n'), RULEBOOKS);

    expect(html).to.include('<table>');
    expect(html).to.include('<td valign="top">');
    expect(html).to.include('<img src="https://user-images.githubusercontent.com/1/moon.png" width="225" height="300">');
    expect(html).not.to.include('&lt;table&gt;');
  });

  it('keeps nothing that could run', () => {
    const html = sanitize([
      '<p onclick="steal()">Text<script>steal()</script></p>',
      '<img src="x.png" onerror="steal()">',
      '<a href="javascript:steal()">bad</a>',
      '<a href="Variants" style="color: red" class="evil">good</a>',
      '<iframe src="https://example.com"></iframe>',
      '<marquee>kept text</marquee>',
    ].join(''), RULEBOOKS);

    expect(html).eq([
      '<p>Text</p>',
      '<img src="https://github.com/terraforming-mars/terraforming-mars/wiki/x.png">',
      '<a>bad</a>',
      '<a href="https://github.com/terraforming-mars/terraforming-mars/wiki/Variants">good</a>',
      'kept text',
    ].join(''));
  });
});
