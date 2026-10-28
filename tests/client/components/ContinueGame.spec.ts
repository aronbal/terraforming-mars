import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import {FakeLocalStorage} from './FakeLocalStorage';
import ContinueGame from '@/client/components/ContinueGame.vue';
import {getRecentGames, rememberGame} from '@/client/utils/RecentGamesStorage';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {
  refreshMobileLayoutPreference,
  resetMobileLayoutForTest,
  startMobileLayoutTracking,
} from '@/client/utils/useMobileLayout';

describe('ContinueGame', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
  });

  it('mounts without errors', () => {
    const wrapper = mount(ContinueGame, {...globalConfig});
    expect(wrapper.exists()).to.be.true;
  });

  it('explains itself when nothing is remembered', () => {
    const wrapper = mount(ContinueGame, {...globalConfig});
    expect(wrapper.find('.continue-game-empty').exists()).to.be.true;
    expect(wrapper.find('.continue-game-list').exists()).to.be.false;
  });

  it('links to a remembered player', () => {
    rememberGame({id: 'p-player', kind: 'player', gameName: 'Ares', name: 'Aron', color: 'blue', generation: 3});

    const wrapper = mount(ContinueGame, {...globalConfig});

    const link = wrapper.find('.continue-game-link');
    expect(link.attributes('href')).eq('player?id=p-player');
    expect(link.text()).eq('Aron');
    expect(wrapper.text()).to.include('Ares');
  });

  it('links to a remembered spectator and game', () => {
    rememberGame({id: 's-spectator', kind: 'spectator', gameName: 'Ares'});
    rememberGame({id: 'g-game', kind: 'game', gameName: 'Deimos'});

    const wrapper = mount(ContinueGame, {...globalConfig});

    const hrefs = wrapper.findAll('.continue-game-link').map((link) => link.attributes('href'));
    expect(hrefs).deep.eq(['game?id=g-game', 'spectator?id=s-spectator']);
  });

  it('removing an entry updates storage and the list', async () => {
    rememberGame({id: 'p-first', kind: 'player', gameName: 'Ares'});
    rememberGame({id: 'p-second', kind: 'player', gameName: 'Deimos'});

    const wrapper = mount(ContinueGame, {...globalConfig});
    await wrapper.find('.continue-game-entry button').trigger('click');

    expect(getRecentGames().map((game) => game.id)).deep.eq(['p-first']);
    expect(wrapper.findAll('.continue-game-entry')).has.length(1);
  });

  it('rejects an id that is not a participant or game id', async () => {
    const wrapper = mount(ContinueGame, {...globalConfig});

    await wrapper.find('.continue-game-id').setValue('nonsense');
    await wrapper.find('.continue-game-manual button').trigger('click');

    expect(wrapper.find('.continue-game-error').exists()).to.be.true;
  });

  describe('on a phone', () => {
    beforeEach(() => {
      PreferencesManager.resetForTest();
      resetMobileLayoutForTest();
      startMobileLayoutTracking();
      PreferencesManager.INSTANCE.set('mobile_layout', 'on');
      refreshMobileLayoutPreference();
    });

    afterEach(() => {
      PreferencesManager.resetForTest();
      resetMobileLayoutForTest();
    });

    it('draws the games as the shell rows, each one a link', () => {
      rememberGame({id: 'p-player', kind: 'player', gameName: 'Ares', name: 'Aron', color: 'blue', generation: 3});
      rememberGame({id: 's-spectator', kind: 'spectator', gameName: 'Deimos'});

      const wrapper = mount(ContinueGame, {...globalConfig});

      expect(wrapper.find('.continue-game-container').exists()).is.false;
      const rows = wrapper.findAll('[data-test=continue-row]');
      expect(rows).has.length(2);
      expect(rows[0].find('a').attributes('href')).eq('spectator?id=s-spectator');
      expect(rows[0].find('.mobile-row-title').text()).eq('Spectator');
      expect(rows[1].find('a').attributes('href')).eq('player?id=p-player');
      expect(rows[1].find('.mobile-row-subtitle').text()).to.include('Ares');
    });

    it('removes a game from its row', async () => {
      rememberGame({id: 'p-first', kind: 'player', gameName: 'Ares'});
      rememberGame({id: 'p-second', kind: 'player', gameName: 'Deimos'});

      const wrapper = mount(ContinueGame, {...globalConfig});
      await wrapper.find('.mobile-continue-remove').trigger('click');

      expect(getRecentGames().map((game) => game.id)).deep.eq(['p-first']);
      expect(wrapper.findAll('[data-test=continue-row]')).has.length(1);
    });

    it('leads back to the main menu', () => {
      const wrapper = mount(ContinueGame, {...globalConfig});
      expect(wrapper.find('[data-test=continue-back]').attributes('href')).eq('/');
    });
  });
});
