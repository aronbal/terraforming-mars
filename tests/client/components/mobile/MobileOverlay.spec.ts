import {shallowMount} from '@vue/test-utils';
import {h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileOverlay from '@/client/components/mobile/MobileOverlay.vue';

describe('MobileOverlay', () => {
  function mount() {
    return shallowMount(MobileOverlay, {
      ...globalConfig,
      props: {title: 'Players'},
      slots: {default: () => h('p', {'data-test': 'content'}, 'Hello')},
    });
  }

  it('shows its title and what it holds', () => {
    const wrapper = mount();
    expect(wrapper.text()).contains('Players');
    expect(wrapper.find('[data-test="content"]').exists()).is.true;
  });

  it('closes from its button or from a tap beside it', async () => {
    const wrapper = mount();
    await wrapper.find('[data-test="overlay-close"]').trigger('click');
    await wrapper.find('[data-test="overlay-scrim"]').trigger('click');
    expect(wrapper.emitted('close')).has.length(2);
  });
});
