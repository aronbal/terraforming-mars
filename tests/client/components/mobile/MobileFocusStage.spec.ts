import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileFocusStage from '@/client/components/mobile/MobileFocusStage.vue';
import {fakePlayerViewModel} from '../testHelpers';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {clearPickedCard, pickCard, resetPickedCardForTest} from '@/client/utils/cardSelection';
import {clearBoardPick, pickBoardThing, resetBoardPickForTest} from '@/client/utils/boardSelection';
import {resetPickFocusForTest, setPickFocus} from '@/client/utils/mobileFocus';

describe('MobileFocusStage', () => {
  function mount(overrides?: Record<string, unknown>) {
    const playerView = fakePlayerViewModel({
      cardsInHand: [{name: CardName.ANTS, calculatedCost: 9}],
      ...overrides,
    } as never) as PlayerViewModel;
    return shallowMount(MobileFocusStage, {...globalConfig, props: {playerView}});
  }

  beforeEach(() => {
    resetPickedCardForTest();
    resetBoardPickForTest();
    resetPickFocusForTest();
  });

  afterEach(() => {
    clearPickedCard();
    clearBoardPick();
    resetPickFocusForTest();
  });

  it('shows nothing while the player is not acting on anything', () => {
    expect(mount().find('[data-test="focus-stage"]').exists()).is.false;
  });

  it('holds up the card being played', () => {
    pickCard(CardName.ANTS);
    setPickFocus('staged');
    const wrapper = mount();

    expect(wrapper.find('[data-test="focus-stage"]').exists()).is.true;
    expect(wrapper.vm.card?.name).eq(CardName.ANTS);
  });

  /* The Act tab draws its own menu, and a card held up over it would be a second
     copy of what is already open there. */
  it('stays dark when the player is finishing in Act', () => {
    pickCard(CardName.ANTS);
    const wrapper = mount();

    expect(wrapper.find('[data-test="focus-stage"]').exists()).is.false;
  });

  it('holds up a milestone tapped under the board', () => {
    pickBoardThing('milestone', 'Builder');
    setPickFocus('staged');
    const wrapper = mount({
      game: {...fakePlayerViewModel().game, milestones: [{name: 'Builder', playerName: undefined, color: undefined, scores: []}]},
    });

    expect(wrapper.vm.milestone?.name).eq('Builder');
    expect(wrapper.vm.card).is.undefined;
  });
});
