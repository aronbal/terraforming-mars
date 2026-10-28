import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileMore from '@/client/components/mobile/MobileMore.vue';
import {fakePlayerViewModel} from '../testHelpers';
import {SaveModel} from '@/common/models/SaveModel';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {CardName} from '@/common/cards/CardName';

describe('MobileMore', () => {
  function mount() {
    return shallowMount(MobileMore, globalConfig);
  }

  it('mounts without errors, on its menu', () => {
    const wrapper = mount();
    expect(wrapper.exists()).is.true;
    expect(wrapper.vm.view).eq('menu');
  });

  it('opens the settings, and comes back', async () => {
    const wrapper = mount();
    await wrapper.find('[data-test="more-settings"]').trigger('click');
    expect(wrapper.vm.view).eq('settings');

    await wrapper.find('[data-test="more-back"]').trigger('click');
    expect(wrapper.vm.view).eq('menu');
  });

  it('offers to reload the page', () => {
    expect(mount().find('[data-test="more-reload"]').exists()).is.true;
  });

  it('links to the other games by their real routes', () => {
    const paths = mount().vm.gameLinks.map((link: {path: string}) => link.path);
    expect(paths).deep.eq(['/new-game', '/continue-game', '/games-overview']);
  });

  describe('the link to this game', () => {
    let copied: Array<string>;
    let realClipboard: PropertyDescriptor | undefined;

    function stubClipboard(writeText: (text: string) => Promise<void>) {
      Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
    }

    beforeEach(() => {
      copied = [];
      realClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      stubClipboard(async (text) => {
        copied.push(text);
      });
    });

    afterEach(() => {
      if (realClipboard === undefined) {
        delete (navigator as {clipboard?: unknown}).clipboard;
      } else {
        Object.defineProperty(navigator, 'clipboard', realClipboard);
      }
    });

    function mountWithGame() {
      const playerView = fakePlayerViewModel();
      return {wrapper: shallowMount(MobileMore, {...globalConfig, props: {playerView}}), playerView};
    }

    it('shows the player\'s own link', () => {
      const {wrapper, playerView} = mountWithGame();
      expect(wrapper.find('[data-test="more-game-url"]').text()).eq(window.location.origin + '/player?id=' + playerView.id);
    });

    it('copies it', async () => {
      const {wrapper, playerView} = mountWithGame();
      await wrapper.find('[data-test="more-copy-link"]').trigger('click');
      await flushPromises();
      expect(copied).deep.eq([window.location.origin + '/player?id=' + playerView.id]);
      expect(wrapper.find('[data-test="more-copy-link"]').text()).eq('Copied');
    });

    it('selects it where the clipboard is refused', async () => {
      stubClipboard(() => Promise.reject(new Error('denied')));
      const playerView = fakePlayerViewModel();
      // Selection needs the element in the document.
      const wrapper = shallowMount(MobileMore, {...globalConfig, props: {playerView}, attachTo: document.body});
      await wrapper.find('[data-test="more-copy-link"]').trigger('click');
      await flushPromises();
      expect(wrapper.find('[data-test="more-copy-link"]').text()).eq('Copy');
      expect(window.getSelection()?.toString()).eq(wrapper.find('[data-test="more-game-url"]').text());
      wrapper.unmount();
    });

    it('is not offered without a game', () => {
      expect(mount().find('[data-test="more-game-link"]').exists()).is.false;
    });
  });

  describe('going back to an earlier save', () => {
    let requested: Array<{url: string, method: string | undefined}>;
    let realFetch: typeof global.fetch;
    let realConfirm: typeof window.confirm;
    let confirmed: boolean;
    let saves: Array<SaveModel>;

    function line(message: string, data: Array<LogMessageData>, timestamp: number): LogMessage {
      return {message, data, timestamp, type: LogMessageType.DEFAULT};
    }

    beforeEach(() => {
      requested = [];
      confirmed = true;
      const now = Date.now();
      saves = [
        {saveId: 7, generation: 3, activePlayer: 'red', log: [line('${0} played ${1}', [
          {type: LogMessageDataType.PLAYER, value: 'blue'},
          {type: LogMessageDataType.CARD, value: CardName.COMET}], now - 5 * 60000)]},
        {saveId: 6, generation: 3, activePlayer: 'blue', log: [line('Generation ${0}', [{type: LogMessageDataType.RAW_STRING, value: '3'}], now)]},
      ];
      realFetch = global.fetch;
      realConfirm = window.confirm;
      global.fetch = (async (url: string, options?: {method: string}) => {
        requested.push({url, method: options?.method});
        const body = url.startsWith('api/game/saves') ? saves : fakePlayerViewModel();
        return {ok: true, status: 200, json: async () => body};
      }) as unknown as typeof global.fetch;
      window.confirm = () => confirmed;
    });

    afterEach(() => {
      global.fetch = realFetch;
      window.confirm = realConfirm;
    });

    function mountAs(isGameMaster: boolean) {
      const playerView = {...fakePlayerViewModel(), isGameMaster};
      return {wrapper: shallowMount(MobileMore, {...globalConfig, props: {playerView}}), playerView};
    }

    async function openSaves(wrapper: ReturnType<typeof mountAs>['wrapper']) {
      await wrapper.find('[data-test="more-rollback"]').trigger('click');
      await flushPromises();
    }

    it('is offered to the game master only', () => {
      expect(mountAs(true).wrapper.find('[data-test="more-rollback"]').exists()).is.true;
      expect(mountAs(false).wrapper.find('[data-test="more-rollback"]').exists()).is.false;
    });

    it('lists the saves, each named by the move made just before it', async () => {
      const {wrapper, playerView} = mountAs(true);
      await openSaves(wrapper);
      expect(requested).deep.eq([{url: 'api/game/saves?id=' + playerView.id, method: undefined}]);
      const rows = wrapper.findAll('[data-test="more-save"]');
      expect(rows.map((row) => row.find('.mobile-row-title').text())).deep.eq(['Played Comet', 'Generation 3']);
      expect(rows[0].find('.mobile-row-subtitle').text()).eq('Generation 3 · ' + playerView.players.find((p) => p.color === 'blue')?.name + ' · 5 min');
    });

    it('asks first, then goes back to the save picked', async () => {
      const {wrapper, playerView} = mountAs(true);
      await openSaves(wrapper);
      await wrapper.findAll('[data-test="more-save"]')[1].trigger('click');
      await flushPromises();
      expect(requested.at(-1)).deep.eq({url: 'api/game/rollback?id=' + playerView.id + '&saveId=6', method: 'POST'});
    });

    it('does nothing when the player thinks better of it', async () => {
      confirmed = false;
      const {wrapper} = mountAs(true);
      await openSaves(wrapper);
      await wrapper.findAll('[data-test="more-save"]')[0].trigger('click');
      await flushPromises();
      expect(requested.map((request) => request.method)).deep.eq([undefined]);
    });

    it('says so when there is no earlier save', async () => {
      saves = [];
      const {wrapper} = mountAs(true);
      await openSaves(wrapper);
      expect(wrapper.find('[data-test="more-saves-empty"]').exists()).is.true;
    });
  });

  describe('undo, under Settings', () => {
    let requested: Array<{url: string, method: string}>;
    let realFetch: typeof global.fetch;

    beforeEach(() => {
      requested = [];
      realFetch = global.fetch;
      global.fetch = (async (url: string, options: {method: string}) => {
        requested.push({url, method: options.method});
        return {ok: true, status: 200, json: async () => fakePlayerViewModel()};
      }) as unknown as typeof global.fetch;
    });

    afterEach(() => {
      global.fetch = realFetch;
    });

    async function openSettings(undoOption: boolean) {
      const view = fakePlayerViewModel();
      const playerView = {...view, game: {...view.game, gameOptions: {...view.game.gameOptions, undoOption}}};
      const wrapper = shallowMount(MobileMore, {...globalConfig, props: {playerView}});
      await wrapper.find('[data-test="more-settings"]').trigger('click');
      return {wrapper, playerView};
    }

    it('shows the game\'s undo setting', async () => {
      const {wrapper} = await openSettings(true);
      const input = wrapper.find('[data-test="more-undo-switch"]').element as HTMLInputElement;
      expect(input.checked).is.true;
    });

    it('turns undo on through the server', async () => {
      const {wrapper, playerView} = await openSettings(false);
      const input = wrapper.find('[data-test="more-undo-switch"]');
      (input.element as HTMLInputElement).checked = true;
      await input.trigger('change');
      await flushPromises();
      expect(requested).deep.eq([{url: 'api/game/undo?id=' + playerView.id + '&undo=true', method: 'POST'}]);
    });

    it('is not offered without a game', async () => {
      const wrapper = mount();
      await wrapper.find('[data-test="more-settings"]').trigger('click');
      expect(wrapper.find('[data-test="more-undo"]').exists()).is.false;
    });
  });
});
