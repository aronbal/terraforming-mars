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

  it('Play opens the card in the play sheet, with its payment', async () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.select(CardName.ANTS);
    wrapper.vm.confirmSelection();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.playing).deep.include({offer: 'play'});
    expect(wrapper.vm.playing?.card.name).eq(CardName.ANTS);
    expect(wrapper.vm.selected).is.undefined;
    expect(wrapper.findComponent({name: 'MobilePlaySheet'}).exists()).is.true;
    // The action sheet stays out of it: nothing is picked for it.
    expect(pickedCard.value).is.undefined;
    expect(pickFocus.value).eq('none');
  });

  it('closing the play sheet puts the card back', async () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.select(CardName.ANTS);
    wrapper.vm.confirmSelection();
    await wrapper.vm.$nextTick();

    wrapper.findComponent({name: 'MobilePlaySheet'}).vm.$emit('close');
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.playing).is.undefined;
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
  it('a tile under the board and an entry never stay picked at once', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.claimBoardThing('award', 'Landlord');
    expect(pickedBoardThing.value?.name).eq('Landlord');

    wrapper.vm.openEntry(0);
    expect(pickedBoardThing.value).is.undefined;
    expect(pickedEntry.value).eq(0);
  });

  it('putting the panel down abandons what it was raised for', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.claimBoardThing('milestone', 'Builder');
    wrapper.vm.setSnap('closed');

    expect(pickFocus.value).eq('none');
    expect(pickedBoardThing.value).is.undefined;
    // Nothing is left to show over the menu, so the sheet goes away entirely.
    expect(wrapper.vm.snap).eq('closed');
  });

  /* The tags sit where the views were, on every view, unless they are turned off. */
  it('shows the tags on every view unless they are turned off', () => {
    const wrapper = mount();
    expect(wrapper.vm.tagRowVisible).is.true;
    wrapper.vm.selectView('log');
    expect(wrapper.vm.tagRowVisible).is.true;

    PreferencesManager.INSTANCE.set('tag_row', 'never');
    wrapper.vm.refreshPreferences();
    expect(wrapper.vm.tagRowVisible).is.false;
  });

  it('counts the ready cards on the Cards tab', () => {
    expect(mount(actionMenu()).vm.tabBadges.cards).eq('1');
    expect(mount().vm.tabBadges.cards).is.undefined;
  });

  it('switches the view from the tab bar', () => {
    const wrapper = mount();
    wrapper.findComponent({name: 'MobileTabBar'}).vm.$emit('update:view', 'cards');
    expect(wrapper.vm.view).eq('cards');
  });

  it('raises a choice between cards all the way, so every card is on screen', () => {
    const draft = cardList('draft', [CardName.ANTS]);
    const wrapper = mount({...draft, annotation: undefined} as PlayerInputModel);
    wrapper.vm.raiseSheet();
    expect(wrapper.vm.snap).eq('full');

    const question = mount(option('Pay 3 M€?'));
    question.vm.raiseSheet();
    expect(question.vm.snap).eq('half');
  });

  it('knows a draft from the menu', () => {
    const draft = cardList('draft', [CardName.ANTS]);
    expect(mount({...draft, annotation: undefined} as PlayerInputModel).vm.choosingCards).is.true;
    expect(mount(actionMenu()).vm.choosingCards).is.false;
  });

  /* The sheet has no handle to leave behind, so with a question waiting the header's
     pill is the way back to it from any view. */
  it('a closed sheet with a question waiting is reopened from the header', () => {
    const wrapper = mount(option('Confirm', undefined));
    wrapper.vm.setSnap('closed');
    expect(wrapper.vm.snap).eq('closed');

    wrapper.findComponent({name: 'MobileHeader'}).vm.$emit('openSheet');
    expect(wrapper.vm.snap).eq('half');
  });

  it('says whose turn it is', () => {
    expect(mount(actionMenu()).vm.turnLabel).eq('Your turn');
    expect(mount().vm.turnLabel).eq('Waiting');
  });

  it('a tapped log line opens its cards large, and a tap puts them down', async () => {
    const wrapper = mount();
    wrapper.vm.logs = {
      1: [{message: '${0} played ${1}', data: [{type: 2, value: 'red'}, {type: 3, value: CardName.ANTS}], timestamp: 0}],
    } as never;
    const line = wrapper.vm.logGenerations[0].events[0];
    expect(wrapper.findComponent({name: 'MobileLogCards'}).exists()).is.false;
    wrapper.findComponent({name: 'MobileLogPane'}).vm.$emit('inspect', line);
    await wrapper.vm.$nextTick();
    const cards = wrapper.findComponent({name: 'MobileLogCards'});
    expect(cards.props('event').cards).deep.eq([CardName.ANTS]);
    cards.vm.$emit('close');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({name: 'MobileLogCards'}).exists()).is.false;
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
