import {expect} from 'chai';
import {FakeLocalStorage} from './components/FakeLocalStorage';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {
  MOBILE_BREAKPOINT,
  mobileLayout,
  refreshMobileLayoutPreference,
  resetMobileLayoutForTest,
  startMobileLayoutTracking,
} from '@/client/utils/useMobileLayout';

describe('useMobileLayout', () => {
  let localStorage: FakeLocalStorage;

  function setViewportWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', {value: width, configurable: true});
  }

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    PreferencesManager.resetForTest();
    resetMobileLayoutForTest();
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
    PreferencesManager.resetForTest();
    resetMobileLayoutForTest();
  });

  it('is off until tracking starts', () => {
    expect(mobileLayout.value).is.false;
  });

  it('auto follows the viewport width', () => {
    setViewportWidth(390);
    startMobileLayoutTracking();
    expect(mobileLayout.value).is.true;

    resetMobileLayoutForTest();
    setViewportWidth(MOBILE_BREAKPOINT + 1);
    startMobileLayoutTracking();
    expect(mobileLayout.value).is.false;
  });

  it('the preference overrides the viewport in both directions', () => {
    setViewportWidth(1400);
    startMobileLayoutTracking();

    PreferencesManager.INSTANCE.set('mobile_layout', 'on');
    refreshMobileLayoutPreference();
    expect(mobileLayout.value).is.true;

    setViewportWidth(390);
    PreferencesManager.INSTANCE.set('mobile_layout', 'off');
    refreshMobileLayoutPreference();
    expect(mobileLayout.value).is.false;
  });
});
