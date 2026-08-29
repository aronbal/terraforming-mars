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

  it('numbers the entries', () => {
    const wrapper = mount(StartScreen, {...globalConfig});

    const indexes = wrapper.findAll('.start-screen-link-index').map((el) => el.text());
    expect(indexes[0]).eq('01');
    expect(indexes[indexes.length - 1]).eq('08');
  });
});
