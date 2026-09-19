import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobilePlayerHome from '@/client/components/mobile/MobilePlayerHome.vue';
import {fakePlayerViewModel} from '../testHelpers';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {beginSpaceSelection, resetSpaceSelectionForTest} from '@/client/utils/spaceSelection';

describe('MobilePlayerHome', () => {
  let localStorage: FakeLocalStorage;

  function mount() {
    return shallowMount(MobilePlayerHome, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel()},
    });
  }

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    PreferencesManager.resetForTest();
    resetSpaceSelectionForTest();
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
    PreferencesManager.resetForTest();
    resetSpaceSelectionForTest();
    document.body.classList.remove('mobile-shell-active');
  });

  it('mounts without errors, on the board tab', () => {
    const wrapper = mount();
    expect(wrapper.exists()).is.true;
    expect(wrapper.vm.tab).eq('board');
  });

  it('marks the body so the page behind the shell stops scrolling', () => {
    const wrapper = mount();
    expect(document.body.classList.contains('mobile-shell-active')).is.true;
    wrapper.unmount();
    expect(document.body.classList.contains('mobile-shell-active')).is.false;
  });

  it('Act raises and lowers the sheet rather than switching pane', async () => {
    const wrapper = mount();
    wrapper.vm.selectTab('actions');
    expect(wrapper.vm.snap).eq('half');
    expect(wrapper.vm.tab).eq('board');

    wrapper.vm.selectTab('actions');
    expect(wrapper.vm.snap).eq('peek');
  });

  it('a space selection clears the board and closes the sheet', async () => {
    const wrapper = mount();
    wrapper.vm.selectTab('cards');
    wrapper.vm.selectTab('actions');

    beginSpaceSelection();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.tab).eq('board');
    expect(wrapper.vm.snap).eq('closed');
  });

  it('the tag row opens itself on the cards tab', () => {
    const wrapper = mount();
    expect(wrapper.vm.tagRowOpen).is.false;

    wrapper.vm.selectTab('cards');
    expect(wrapper.vm.tagRowOpen).is.true;

    wrapper.vm.toggleTagRow();
    expect(wrapper.vm.tagRowOpen).is.false;

    // The manual override lasts only until the next tab change.
    wrapper.vm.selectTab('log');
    wrapper.vm.selectTab('cards');
    expect(wrapper.vm.tagRowOpen).is.true;
  });
});
