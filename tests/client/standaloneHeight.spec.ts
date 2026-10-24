import {expect} from 'chai';
import {standaloneShellHeight} from '@/client/utils/standaloneHeight';

describe('standaloneHeight', () => {
  // An iPhone 11 on the home screen: 414x896, its viewport 48px short.
  const shortViewport = {standalone: true, innerWidth: 414, innerHeight: 848, screenWidth: 414, screenHeight: 896};

  it('fills the screen when the home-screen viewport stops short of it', () => {
    expect(standaloneShellHeight(shortViewport)).eq(896);
  });

  it('leaves a viewport that already fills the screen alone', () => {
    expect(standaloneShellHeight({...shortViewport, innerHeight: 896})).is.undefined;
  });

  it('leaves a browser tab alone, whose toolbars take real room', () => {
    expect(standaloneShellHeight({...shortViewport, standalone: false})).is.undefined;
  });

  it('reads the screen sideways in landscape', () => {
    expect(standaloneShellHeight({...shortViewport, innerWidth: 896, innerHeight: 380})).eq(414);
  });
});
