import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobilePlayersOverview from '@/client/components/mobile/MobilePlayersOverview.vue';
import {fakeGameModel, fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';

describe('MobilePlayersOverview', () => {
  function mount(showOtherPlayersVP = false) {
    const you = fakePublicPlayerModel({name: 'You', color: 'red', victoryPointsBreakdown: {total: 20}});
    const green = fakePublicPlayerModel({
      name: 'Green',
      color: 'green',
      isActive: true,
      victoryPointsBreakdown: {total: 31},
      tableau: [{name: CardName.ECOLINE}, {name: CardName.BIRDS}],
    });
    const game = fakeGameModel();
    game.gameOptions.showOtherPlayersVP = showOtherPlayersVP;
    return shallowMount(MobilePlayersOverview, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel({thisPlayer: you, players: [green, you], game} as never),
      },
    });
  }

  it('shows one card per player, in turn order', () => {
    const names = mount().findAll('[data-test="mobile-player-name"]').map((name) => name.text());
    expect(names).deep.eq(['Green', 'You']);
  });

  it('labels the first player and the one acting', () => {
    const cards = mount().findAll('[data-test="mobile-player"]');
    expect(cards[0].find('[data-test="mobile-player-first"]').exists()).is.true;
    expect(cards[0].find('[data-test="mobile-player-status"]').text()).eq('Active');
    expect(cards[1].find('[data-test="mobile-player-first"]').exists()).is.false;
  });

  it('hides another player\'s points unless the game shows them', () => {
    const hidden = mount(false).findAll('[data-test="mobile-player-vp"]').map((stat) => stat.text());
    expect(hidden[0]).contains('?');
    expect(hidden[1]).contains('20');
    const shown = mount(true).findAll('[data-test="mobile-player-vp"]').map((stat) => stat.text());
    expect(shown[0]).contains('31');
  });

  it('opens a player\'s played cards, and goes back', async () => {
    const wrapper = mount();
    const buttons = wrapper.findAll('[data-test="mobile-player-played"]');
    expect(buttons[1].attributes('disabled')).is.not.undefined;
    await buttons[0].trigger('click');
    expect(wrapper.vm.shown).eq('green' as Color);
    expect(wrapper.findAll('[data-test="mobile-players-card"]')).has.length(2);
    await wrapper.find('[data-test="mobile-players-back"]').trigger('click');
    expect(wrapper.findAll('[data-test="mobile-player"]')).has.length(2);
  });
});
