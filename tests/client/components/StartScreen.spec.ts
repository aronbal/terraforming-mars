import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import StartScreen from '@/client/components/StartScreen.vue';

describe('StartScreen', () => {
  it('mounts without errors', () => {
    const wrapper = mount(StartScreen, {...globalConfig});
    expect(wrapper.exists()).to.be.true;
  });

  it('leads with the two ways into a game', () => {
    const wrapper = mount(StartScreen, {...globalConfig});

    const links = wrapper.findAll('.start-screen-link');
    expect(links[0].attributes('href')).eq('new-game');
    expect(links[1].attributes('href')).eq('continue-game');
    expect(links[0].classes()).to.include('start-screen-link--primary');
    expect(links[1].classes()).to.include('start-screen-link--primary');
  });

  it('opens only the reference links in a new tab', () => {
    const wrapper = mount(StartScreen, {...globalConfig});

    const links = wrapper.findAll('.start-screen-link');
    expect(links[0].attributes('target')).is.undefined;
    expect(links[1].attributes('target')).is.undefined;
    for (const link of links.slice(2)) {
      expect(link.attributes('target')).eq('_blank');
    }
  });

  it('draws the arrows instead of typing them', () => {
    const wrapper = mount(StartScreen, {...globalConfig});

    // iOS turns a typed ↗ into a blue emoji tile.
    for (const link of wrapper.findAll('.start-screen-link')) {
      const arrow = link.find('.start-screen-link-arrow');
      expect(arrow.element.tagName.toLowerCase()).eq('svg');
      expect(arrow.text()).eq('');
    }
  });

  it('leaves the language to the flag row', () => {
    const wrapper = mount(StartScreen, {...globalConfig});

    expect(wrapper.find('.language-switcher').exists()).is.true;
    expect(wrapper.find('.corner-language-icon').exists()).is.false;
  });

  it('numbers the entries', () => {
    const wrapper = mount(StartScreen, {...globalConfig});

    const indexes = wrapper.findAll('.start-screen-link-index').map((el) => el.text());
    expect(indexes[0]).eq('01');
    expect(indexes[indexes.length - 1]).eq('08');
  });
});
