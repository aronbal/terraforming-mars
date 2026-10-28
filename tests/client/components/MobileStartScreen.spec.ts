import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import MobileStartScreen from '@/client/components/MobileStartScreen.vue';

describe('MobileStartScreen', () => {
  it('mounts without errors', () => {
    const wrapper = mount(MobileStartScreen, {...globalConfig});
    expect(wrapper.exists()).to.be.true;
  });

  it('leads with the two ways into a game, in this tab', () => {
    const wrapper = mount(MobileStartScreen, {...globalConfig});

    const links = wrapper.findAll('a.mobile-row');
    expect(links[0].attributes('href')).eq('new-game');
    expect(links[1].attributes('href')).eq('continue-game');
    expect(links[0].attributes('target')).is.undefined;
    expect(links[1].attributes('target')).is.undefined;
    for (const link of links.slice(2)) {
      expect(link.attributes('target')).eq('_blank');
    }
  });

  it('picks the language from a list rather than a wall of flags', () => {
    const wrapper = mount(MobileStartScreen, {...globalConfig});

    expect(wrapper.find('.language-switcher').exists()).is.false;
    expect(wrapper.find('[data-test=start-language-name]').text()).eq('English');
    expect(wrapper.findAll('[data-test=start-language] option').length).greaterThan(1);
  });

  it('opens the game\'s settings and comes back', async () => {
    const wrapper = mount(MobileStartScreen, {...globalConfig});

    await wrapper.find('[data-test=start-settings]').trigger('click');
    expect(wrapper.find('[data-test=mobile-settings]').exists()).is.true;
    expect(wrapper.find('a.mobile-row').exists()).is.false;

    await wrapper.find('[data-test=start-back]').trigger('click');
    expect(wrapper.find('[data-test=mobile-settings]').exists()).is.false;
    expect(wrapper.find('a.mobile-row').exists()).is.true;
  });
});
