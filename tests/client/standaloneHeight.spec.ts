import {expect} from 'chai';
import {standaloneGap} from '@/client/utils/standaloneHeight';

describe('standaloneHeight', () => {
  // An iPhone 11 on the home screen: 414x896, its viewport 48px short.
  const shortViewport = {standalone: true, innerWidth: 414, innerHeight: 848, screenWidth: 414, screenHeight: 896};

  it('measures the band under a home-screen viewport that stops short of the screen', () => {
    expect(standaloneGap(shortViewport)).eq(48);
  });

  it('finds no band when the viewport already fills the screen', () => {
    expect(standaloneGap({...shortViewport, innerHeight: 896})).eq(0);
  });

  it('leaves a browser tab alone, whose toolbars take real room', () => {
    expect(standaloneGap({...shortViewport, standalone: false})).eq(0);
  });

  it('reads the screen sideways in landscape', () => {
    expect(standaloneGap({...shortViewport, innerWidth: 896, innerHeight: 380})).eq(34);
  });
});
