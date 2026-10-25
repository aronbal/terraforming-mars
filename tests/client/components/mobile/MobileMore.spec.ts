import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileMore from '@/client/components/mobile/MobileMore.vue';
import {fakePlayerViewModel} from '../testHelpers';

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

  it('links to the other games by their real routes', () => {
    const paths = mount().vm.gameLinks.map((link: {path: string}) => link.path);
    expect(paths).deep.eq(['/new-game', '/continue-game', '/games-overview']);
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
