import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobilePlayerHome from '@/client/components/mobile/MobilePlayerHome.vue';
import {fakePlayerViewModel} from '../testHelpers';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {beginSpaceSelection, resetSpaceSelectionForTest} from '@/client/utils/spaceSelection';
import {CardName} from '@/common/cards/CardName';
import {pickedCard, resetPickedCardForTest} from '@/client/utils/cardSelection';
import {pickedBoardThing, resetBoardPickForTest} from '@/client/utils/boardSelection';
import {pickFocus, pickedEntry, resetPickFocusForTest} from '@/client/utils/mobileFocus';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {cardList, menu, option, projectCard} from './menuFixtures';

describe('MobilePlayerHome', () => {
  let localStorage: FakeLocalStorage;

  /* The turn's menu: pass, a playable card, and the standard projects. */
  function actionMenu(): PlayerInputModel {
    return menu(
      option('Pass for this generation', 'pass'),
      projectCard(CardName.ANTS),
      cardList('standardProject', [CardName.AQUIFER_STANDARD_PROJECT]));
  }

  function mount(waitingFor?: PlayerInputModel) {
    return shallowMount(MobilePlayerHome, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel({waitingFor} as never)},
    });
  }

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    PreferencesManager.resetForTest();
    resetSpaceSelectionForTest();
    resetPickedCardForTest();
    resetBoardPickForTest();
    resetPickFocusForTest();
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
    PreferencesManager.resetForTest();
    resetSpaceSelectionForTest();
    resetPickedCardForTest();
    resetBoardPickForTest();
    resetPickFocusForTest();
    document.body.classList.remove('mobile-shell-active');
  });

  it('mounts without errors, on the turn view', () => {
    const wrapper = mount();
    expect(wrapper.exists()).is.true;
    expect(wrapper.vm.view).eq('turn');
  });

  it('gives the opening hand the turn view', () => {
    const wrapper = mount({
      type: 'initialCards',
      title: 'selectInitialCards',
      buttonLabel: 'save',
      options: [],
    } as unknown as PlayerInputModel);

    expect(wrapper.vm.view).eq('turn');
    expect(wrapper.vm.panelMode).eq('tab');
  });

  it('marks the body so the page behind the shell stops scrolling', () => {
    const wrapper = mount();
    expect(document.body.classList.contains('mobile-shell-active')).is.true;
    wrapper.unmount();
    expect(document.body.classList.contains('mobile-shell-active')).is.false;
  });

  /* The turn page is the menu, so a sheet over it would only repeat it. */
  it('keeps the sheet away while the turn page holds the menu', () => {
    const wrapper = mount(actionMenu());
    expect(wrapper.vm.sheetInUse).is.false;
    wrapper.vm.setSnap('half');
    expect(wrapper.vm.snap).eq('closed');
  });

  it('a question that is not the menu has the sheet', () => {
    const wrapper = mount(option('Pay 3 M€?'));
    expect(wrapper.vm.sheetInUse).is.true;
    wrapper.vm.setSnap('half');
    expect(wrapper.vm.snap).eq('half');
  });

  it('a space selection shows the board and closes the sheet', async () => {
    const wrapper = mount(option('Pay 3 M€?'));
    wrapper.vm.setSnap('half');

    beginSpaceSelection();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.view).eq('board');
    expect(wrapper.vm.snap).eq('closed');
  });

  it('a tap on a ready card selects it, and a second tap lets go', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.select(CardName.ANTS);
    expect(wrapper.vm.selection?.card.name).eq(CardName.ANTS);
    expect(wrapper.vm.selection?.offer).eq('play');

    wrapper.vm.select(CardName.ANTS);
    expect(wrapper.vm.selection).is.undefined;
  });

  it('shows the bottom bar only while a card is selected', async () => {
    const wrapper = mount(actionMenu());
    expect(wrapper.findComponent({name: 'MobileSelectionBar'}).exists()).is.false;

    wrapper.vm.select(CardName.ANTS);
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({name: 'MobileSelectionBar'}).exists()).is.true;
  });

  /* Play hands the card to the existing flow: held up over the board, with the
     price and the button in the sheet under it. */
  it('Play opens the card in the sheet with its price', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.select(CardName.ANTS);
    wrapper.vm.confirmSelection();

    expect(pickedCard.value).eq(CardName.ANTS);
    expect(pickFocus.value).eq('staged');
    expect(wrapper.vm.snap).eq('half');
    expect(wrapper.vm.selected).is.undefined;
  });

  it('a tile opens its entry, with room for a list to choose from', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.openEntry(2);

    expect(pickedEntry.value).eq(2);
    expect(pickFocus.value).eq('panel');
    expect(wrapper.vm.snap).eq('full');
  });

  it('a button opens a confirmation at half height', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.openEntry(0);
    expect(wrapper.vm.snap).eq('half');
  });

  it('Milestones & awards goes to the board, where they are claimed', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.openMilestones();
    expect(wrapper.vm.view).eq('board');
  });

  it('a tile tapped under the board is the same move as a card', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.claimBoardThing('milestone', 'Builder');

    expect(pickedBoardThing.value).deep.eq({kind: 'milestone', name: 'Builder'});
    expect(pickFocus.value).eq('staged');
  });

  /* Only one thing is being acted on at a time, and the menu entry that opens is
     chosen by what was picked last. */
  it('a card, a tile and an entry never stay picked at once', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.select(CardName.ANTS);
    wrapper.vm.confirmSelection();
    wrapper.vm.claimBoardThing('award', 'Landlord');

    expect(pickedCard.value).is.undefined;
    expect(pickedBoardThing.value?.name).eq('Landlord');

    wrapper.vm.openEntry(0);
    expect(pickedBoardThing.value).is.undefined;
    expect(pickedEntry.value).eq(0);
  });

  it('putting the panel down abandons what it was raised for', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.claimBoardThing('milestone', 'Builder');
    wrapper.vm.setSnap('peek');

    expect(pickFocus.value).eq('none');
    expect(pickedBoardThing.value).is.undefined;
    // Nothing is left to show over the menu, so the sheet goes away entirely.
    expect(wrapper.vm.snap).eq('closed');
  });

  it('the tag row opens itself on the cards view', () => {
    const wrapper = mount();
    expect(wrapper.vm.tagRowOpen).is.false;

    wrapper.vm.selectView('cards');
    expect(wrapper.vm.tagRowOpen).is.true;

    wrapper.vm.toggleTagRow();
    expect(wrapper.vm.tagRowOpen).is.false;

    // The manual override lasts only until the next view change.
    wrapper.vm.selectView('log');
    wrapper.vm.selectView('cards');
    expect(wrapper.vm.tagRowOpen).is.true;
  });

  it('says whose turn it is', () => {
    expect(mount(actionMenu()).vm.turnLabel).eq('Your turn');
    expect(mount().vm.turnLabel).eq('Waiting');
  });

  it('reads the log it has fetched into rows, newest generation first', () => {
    const wrapper = mount();
    wrapper.vm.logs = {
      1: [{message: '${0} played ${1}', data: [{type: 2, value: 'red'}, {type: 3, value: CardName.ANTS}], timestamp: 0}],
      2: [],
    } as never;
    expect(wrapper.vm.logGenerations.map((group) => group.generation)).deep.eq([2, 1]);
    expect(wrapper.vm.logGenerations[1].events[0].title).eq('Played Ants');
  });
});
