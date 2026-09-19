import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileSettings from '@/client/components/mobile/MobileSettings.vue';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {PreferencesManager, getPreferences} from '@/client/utils/PreferencesManager';

describe('MobileSettings', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    PreferencesManager.resetForTest();
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
    PreferencesManager.resetForTest();
  });

  function mount() {
    return shallowMount(MobileSettings, globalConfig);
  }

  it('mounts without errors', () => {
    expect(mount().exists()).is.true;
  });

  it('stores the mobile layout choice', () => {
    mount().vm.setMode('mobile_layout', 'off');
    expect(getPreferences().mobile_layout).eq('off');
    expect(localStorage.getItem('mobile_layout')).eq('off');
  });

  it('stores where the player wants to finish an action', () => {
    mount().vm.setMode('play_from', 'actions');
    expect(getPreferences().play_from).eq('actions');
    expect(localStorage.getItem('play_from')).eq('actions');
  });

  it('stores the card scale as a fraction', () => {
    const wrapper = mount();
    wrapper.vm.setCardScale({target: {value: '80'}} as unknown as Event);
    expect(getPreferences().card_scale).eq(0.8);
    expect(wrapper.vm.cardScalePercent).eq(80);
  });
});
