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

  it('stores when the tag row is shown', () => {
    mount().vm.setMode('tag_row', 'never');
    expect(getPreferences().tag_row).eq('never');
    expect(localStorage.getItem('tag_row')).eq('never');
  });

  it('stores the card scale as a fraction', () => {
    const wrapper = mount();
    wrapper.vm.setCardScale({target: {value: '80'}} as unknown as Event);
    expect(getPreferences().card_scale).eq(0.8);
    expect(wrapper.vm.cardScalePercent).eq(80);
  });

  it('marks the chosen mode in each segmented control', async () => {
    const wrapper = mount();
    wrapper.vm.setMode('mobile_layout', 'on');
    wrapper.vm.setMode('tag_row', 'never');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-test="mobile-layout-on"]').classes()).contains('mobile-segmented-option--on');
    expect(wrapper.find('[data-test="mobile-layout-auto"]').attributes('aria-checked')).eq('false');
    expect(wrapper.find('[data-test="tag-row-never"]').classes()).contains('mobile-segmented-option--on');
  });

  it('shows the language in one row, with the picker over it', () => {
    const wrapper = mount();
    expect(wrapper.find('[data-test="language-name"]').text()).eq('English');
    expect(wrapper.findAll('[data-test="language"] option').length).greaterThan(10);
  });

  it('a switch stores its setting', async () => {
    const wrapper = mount();
    await wrapper.find('[data-test="small_cards"]').setValue(true);
    expect(getPreferences().small_cards).is.true;
  });

  // The shell draws its own milestones and awards, which that switch never reached.
  it('offers no switch that changes nothing on a phone', () => {
    expect(mount().find('[data-test="hide_awards_and_milestones"]').exists()).is.false;
  });
});
