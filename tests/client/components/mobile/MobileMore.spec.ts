import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileMore from '@/client/components/mobile/MobileMore.vue';
import {fakePlayerViewModel} from '../testHelpers';

describe('MobileMore', () => {
  function mount() {
    return shallowMount(MobileMore, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel()},
    });
  }

  it('mounts without errors, on its menu', () => {
    const wrapper = mount();
    expect(wrapper.exists()).is.true;
    expect(wrapper.vm.view).eq('menu');
  });

  it('opens the log, and comes back', async () => {
    const wrapper = mount();
    await wrapper.find('[data-test="more-log"]').trigger('click');
    expect(wrapper.vm.view).eq('log');

    await wrapper.find('[data-test="more-back"]').trigger('click');
    expect(wrapper.vm.view).eq('menu');
  });

  it('opens the settings, and comes back', async () => {
    const wrapper = mount();
    await wrapper.find('[data-test="more-settings"]').trigger('click');
    expect(wrapper.vm.view).eq('settings');

    await wrapper.find('[data-test="more-back"]').trigger('click');
    expect(wrapper.vm.view).eq('menu');
  });

  it('links to the other games by their real routes', () => {
    const paths = mount().vm.gameLinks.map((link) => link.path);
    expect(paths).deep.eq(['/new-game', '/continue-game', '/games-overview']);
  });
});
