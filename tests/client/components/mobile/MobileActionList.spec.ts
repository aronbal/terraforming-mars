import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileActionList from '@/client/components/mobile/MobileActionList.vue';
import {fakePlayerViewModel} from '../testHelpers';
import PlayerInputFactory from '@/client/components/PlayerInputFactory.vue';
import {CardName} from '@/common/cards/CardName';
import {OrOptionsModel} from '@/common/models/PlayerInputModel';
import {clearPickedCard, pickCard, resetPickedCardForTest} from '@/client/utils/cardSelection';
import {clearBoardPick, pickBoardThing, resetBoardPickForTest} from '@/client/utils/boardSelection';
import {pickEntry, resetPickFocusForTest, setPickFocus} from '@/client/utils/mobileFocus';
import {menu, namedChoices, option, projectCard} from './menuFixtures';

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

  it('falls back to the whole turn as rows when nothing has been picked', () => {
    const wrapper = mount(menu(option('Pass for this generation', 'pass'), namedChoices('award', 'Fund an award (8 M€)', 'Landlord')));
    expect(wrapper.find('[data-test="focused-body"]').exists()).is.false;
    expect(wrapper.findAll('[data-test="action-row"]')).has.length(2);
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
    const wrapper = mount(menu(option('Pass for this generation', 'pass'), namedChoices('award', 'Fund an award (8 M€)', 'Landlord', 'Banker')));

    expect(wrapper.vm.focused?.input.title).eq('Fund an award (8 M€)');
  });

  it('and for a tile or a button on the turn page, by position', () => {
    pickEntry(0);
    setPickFocus('panel');
    const wrapper = mount(menu(option('Pass for this generation', 'pass'), projectCard(CardName.ANTS)));

    expect(wrapper.vm.focused?.index).eq(0);
    expect(wrapper.find('[data-test="focused-body"]').exists()).is.true;
  });

  /* A card held up over the board is not drawn twice; a list a tile opened -- the
     standard projects -- is the choice itself, so it stays. */
  it('leaves out what the stage repeats only when something is held up', () => {
    pickCard(CardName.ANTS);
    setPickFocus('staged');
    const staged = mount(menu(projectCard(CardName.ANTS)));
    expect(staged.find('[data-test="focused-body"]').classes()).contains('mobile-action-body--staged');

    resetPickFocusForTest();
    pickEntry(0);
    setPickFocus('panel');
    const panel = mount(menu(projectCard(CardName.ANTS)));
    expect(panel.find('[data-test="focused-body"]').classes()).does.not.contain('mobile-action-body--staged');
  });

  it('unfolds the picked entry even when the whole menu shows', () => {
    pickCard(CardName.ANTS);
    const wrapper = mount(menu(option('Pass for this generation', 'pass'), projectCard(CardName.ANTS)));

    expect(wrapper.vm.focused).is.undefined;
    expect(wrapper.vm.openIndex).eq(1);
  });
});
