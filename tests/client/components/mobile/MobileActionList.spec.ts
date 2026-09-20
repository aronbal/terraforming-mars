import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileActionList from '@/client/components/mobile/MobileActionList.vue';
import {fakePlayerViewModel} from '../testHelpers';
import PlayerInputFactory from '@/client/components/PlayerInputFactory.vue';
import {CardName} from '@/common/cards/CardName';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {clearPickedCard, pickCard, resetPickedCardForTest} from '@/client/utils/cardSelection';
import {clearBoardPick, pickBoardThing, resetBoardPickForTest} from '@/client/utils/boardSelection';
import {resetPickFocusForTest, setPickFocus, setTabRouting} from '@/client/utils/mobileFocus';

function option(title: string, annotation?: string): PlayerInputModel {
  return {type: 'option', title, buttonLabel: 'Confirm', annotation};
}

function projectCard(...names: Array<CardName>): PlayerInputModel {
  return {
    type: 'projectCard',
    title: 'Play project card',
    buttonLabel: 'Play',
    annotation: 'projectCard',
    cards: names.map((name) => ({name, calculatedCost: 1})),
    paymentOptions: {},
    microbes: 0,
    floaters: 0,
    lunaArchivesScience: 0,
    seeds: 0,
    graphene: 0,
    kuiperAsteroids: 0,
    auroraiData: 0,
    spireScience: 0,
  };
}

function awards(...names: Array<string>): PlayerInputModel {
  return {
    type: 'or',
    title: 'Fund an award (8 M€)',
    buttonLabel: 'Confirm',
    annotation: 'award',
    options: names.map((name) => option(name)),
  };
}

function menu(...options: Array<PlayerInputModel>): OrOptionsModel {
  return {type: 'or', title: 'Take your first action', buttonLabel: 'Take action', options};
}

describe('MobileActionList', () => {
  function mount(playerinput: OrOptionsModel) {
    return shallowMount(MobileActionList, {
      ...globalConfig,
      global: {
        ...globalConfig.global,
        components: {PlayerInputFactory},
      },
      props: {playerView: fakePlayerViewModel(), playerinput, onsave: () => {}},
    });
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

  it('shows the whole turn as rows when nothing has been picked', () => {
    const wrapper = mount(menu(option('Pass for this generation', 'pass'), awards('Landlord')));
    expect(wrapper.find('[data-test="focused-body"]').exists()).is.false;
    // Pass opens here; funding an award is a link to the tile under the board.
    expect(wrapper.findAll('[data-test="action-row"]')).has.length(1);
    expect(wrapper.findAll('[data-test="action-elsewhere"]')).has.length(1);
  });

  /* The player tapped the card. Offering them the rest of the menu around it is
     offering a decision they have already made. */
  it('shows the picked card alone when the panel was raised for it', () => {
    pickCard(CardName.ANTS);
    setPickFocus('staged');
    const wrapper = mount(menu(option('Pass for this generation', 'pass'), projectCard(CardName.ANTS)));

    expect(wrapper.find('[data-test="focused-body"]').exists()).is.true;
    expect(wrapper.findAll('[data-test="action-row"]')).is.empty;
    expect(wrapper.vm.focused?.input.title).eq('Play project card');
  });

  it('does the same for a tile tapped under the board', () => {
    pickBoardThing('award', 'Landlord');
    setPickFocus('staged');
    const wrapper = mount(menu(option('Pass for this generation', 'pass'), awards('Landlord', 'Banker')));

    expect(wrapper.vm.focused?.input.title).eq('Fund an award (8 M€)');
  });

  /* On the Act tab the whole point is that the rest of the menu is in reach, so the
     pick only opens its entry. */
  it('keeps the whole menu when the player asked to finish in Act', () => {
    pickCard(CardName.ANTS);
    const wrapper = mount(menu(option('Pass for this generation', 'pass'), projectCard(CardName.ANTS)));

    expect(wrapper.vm.focused).is.undefined;
    expect(wrapper.vm.openIndex).eq(1);
  });

  /* "In Act" promises the whole turn can be taken from there, so no row may be a
     link to another tab. */
  it('unfolds the card entry in place when the player is not routed to tabs', () => {
    setTabRouting(false);
    const wrapper = mount(menu(option('Pass for this generation', 'pass'), projectCard(CardName.ANTS)));

    expect(wrapper.findAll('[data-test="action-elsewhere"]')).is.empty;
    expect(wrapper.findAll('[data-test="action-row"]')).has.length(2);
  });
});
