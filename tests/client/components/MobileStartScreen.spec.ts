import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import MobileStartScreen from '@/client/components/MobileStartScreen.vue';

describe('MobileStartScreen', () => {
  it('mounts without errors', () => {
    const wrapper = mount(MobileStartScreen, {...globalConfig});
    expect(wrapper.exists()).to.be.true;
  });

  it('leads with the two ways into a game', () => {
    const wrapper = mount(MobileStartScreen, {...globalConfig});

    const links = wrapper.findAll('a.mobile-row');
    expect(links[0].attributes('href')).eq('new-game');
    expect(links[1].attributes('href')).eq('continue-game');
  });

  it('opens only other sites in a new tab', () => {
    const wrapper = mount(MobileStartScreen, {...globalConfig});

    // The wiki and the README open in the app's reader, the cards list in this tab.
    const tabbed = wrapper.findAll('a.mobile-row')
      .filter((link) => link.attributes('target') === '_blank')
      .map((link) => link.attributes('href'));
    expect(tabbed).has.length(2);
    expect(tabbed[0]).to.include('boardgamegeek.com');
    expect(wrapper.find('[data-test=start-book-open]').attributes('target')).is.undefined;
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
