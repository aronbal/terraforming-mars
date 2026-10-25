import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {ReadyCard} from '@/client/components/mobile/MobileActionMenu';
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
import {cardChoice, cardList, menu, namedChoices, option, projectCard, standardProjects, trade} from './menuFixtures';

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

  /* No bar to confirm on first: the play sheet is the confirmation. */
  it('a tap on a ready card opens it in the play sheet, with its payment', async () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.select(CardName.ANTS);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.playing).deep.include({offer: 'play'});
    expect(wrapper.vm.playing?.card.name).eq(CardName.ANTS);
    expect(wrapper.findComponent({name: 'MobilePlaySheet'}).exists()).is.true;
    // The action sheet stays out of it: nothing is picked for it.
    expect(pickedCard.value).is.undefined;
    expect(pickFocus.value).eq('none');
  });

  it('a swipe in the play sheet turns to the next ready card, round and round', () => {
    const wrapper = mount(menu(projectCard(CardName.ANTS, CardName.BIRDS)));
    wrapper.vm.select(CardName.BIRDS);
    wrapper.vm.turnCard(1);
    expect(wrapper.vm.playing?.card.name).eq(CardName.ANTS);
    wrapper.vm.turnCard(-1);
    expect(wrapper.vm.playing?.card.name).eq(CardName.BIRDS);
  });

  it('a tap on a card the turn has no move for does nothing', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.select(CardName.COMET);
    expect(wrapper.vm.playing).is.undefined;
  });

  it('closing the play sheet puts the card back', async () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.select(CardName.ANTS);
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

  /* The menu with a milestone to claim and two awards to fund. */
  function claimMenu(): PlayerInputModel {
    return menu(
      option('Pass for this generation', 'pass'),
      namedChoices('milestone', 'Claim a milestone', 'Builder'),
      namedChoices('award', 'Fund an award', 'Landlord', 'Banker'));
  }

  it('Milestones & awards opens the first one on offer, in the claim sheet', () => {
    const wrapper = mount(claimMenu());
    wrapper.vm.openMilestones();
    expect(wrapper.vm.claiming).deep.eq({kind: 'milestone', name: 'Builder'});
  });

  it('Milestones & awards shows the board when there is nothing to claim', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.openMilestones();
    expect(wrapper.vm.claiming).is.undefined;
    expect(wrapper.vm.view).eq('board');
  });

  it('a tile tapped under the board opens in the claim sheet, as a card does', () => {
    const wrapper = mount(claimMenu());
    wrapper.vm.claimBoardThing('award', 'Banker');
    expect(wrapper.vm.claiming).deep.eq({kind: 'award', name: 'Banker'});
    expect(pickFocus.value).eq('none');
  });

  it('a swipe in the claim sheet goes through milestones, then awards, round and round', () => {
    const wrapper = mount(claimMenu());
    wrapper.vm.claimBoardThing('award', 'Banker');
    wrapper.vm.turnClaim(1);
    expect(wrapper.vm.claiming).deep.eq({kind: 'milestone', name: 'Builder'});
    wrapper.vm.turnClaim(-1);
    expect(wrapper.vm.claiming).deep.eq({kind: 'award', name: 'Banker'});
  });

  /* The menu with three colonies to trade with. */
  function tradeMenu(): PlayerInputModel {
    return menu(option('Pass for this generation', 'pass'), trade(['Luna', 'Io', 'Europa']));
  }

  it('a colony tile tapped under the board opens in the trade sheet, with nothing picked for the panel', () => {
    const wrapper = mount(tradeMenu());
    wrapper.vm.claimBoardThing('colony', 'Io');
    expect(wrapper.vm.trading).eq('Io');
    expect(pickedBoardThing.value).is.undefined;
    expect(pickFocus.value).eq('none');
  });

  it('Trade opens the first colony on offer, and a swipe goes round them', () => {
    const wrapper = mount(tradeMenu());
    wrapper.vm.openTrade();
    expect(wrapper.vm.trading).eq('Luna');
    wrapper.vm.turnTrade(-1);
    expect(wrapper.vm.trading).eq('Europa');
    wrapper.vm.turnTrade(1);
    expect(wrapper.vm.trading).eq('Luna');
  });

  it('Standard projects opens the play sheet at the first one, all of them side by side', async () => {
    const wrapper = mount(menu(
      projectCard(CardName.ANTS),
      standardProjects(CardName.POWER_PLANT_STANDARD_PROJECT, CardName.ASTEROID_STANDARD_PROJECT)));
    wrapper.findComponent({name: 'MobileTurnPage'}).vm.$emit('openProjects');
    expect(wrapper.vm.playing?.card.name).eq(CardName.POWER_PLANT_STANDARD_PROJECT);
    wrapper.vm.turnCard(1);
    expect(wrapper.vm.playing?.card.name).eq(CardName.ASTEROID_STANDARD_PROJECT);
    wrapper.vm.turnCard(1);
    expect(wrapper.vm.playing?.card.name).eq(CardName.POWER_PLANT_STANDARD_PROJECT);

    await wrapper.vm.$nextTick();
    const sheet = wrapper.findComponent({name: 'MobilePlaySheet'});
    expect(sheet.props('choices')).deep.eq([CardName.POWER_PLANT_STANDARD_PROJECT, CardName.ASTEROID_STANDARD_PROJECT]);
    sheet.vm.$emit('choose', CardName.ASTEROID_STANDARD_PROJECT);
    expect(wrapper.vm.playing?.card.name).eq(CardName.ASTEROID_STANDARD_PROJECT);

    // A card tapped afterwards swipes among the ready cards again.
    wrapper.vm.select(CardName.ANTS);
    expect(wrapper.vm.playList.map((item: ReadyCard) => item.card.name)).deep.eq([CardName.ANTS]);
  });

  it('the turn page\'s heat tile opens the confirmation sheet', async () => {
    const wrapper = mount(menu(option('Convert 8 heat into temperature', 'convertHeat')));
    wrapper.findComponent({name: 'MobileTurnPage'}).vm.$emit('confirm', 'convertHeat');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({name: 'MobileConfirmSheet'}).props('annotation')).eq('convertHeat');
  });

  it('selling patents opens the card chooser for its entry', async () => {
    const wrapper = mount(menu(option('Pass for this generation', 'pass'), cardChoice([CardName.ANTS], {annotation: 'sellPatents'})));
    wrapper.findComponent({name: 'MobileTurnPage'}).vm.$emit('openChooser', 1);
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.choosing).deep.eq({entry: 1});
    expect(wrapper.findComponent({name: 'MobileCardChooser'}).props('entry')).eq(1);
  });

  it('a new question puts down every sheet opened for the last one', async () => {
    const wrapper = mount(tradeMenu());
    wrapper.vm.openTrade();
    wrapper.vm.confirming = 'convertHeat';
    wrapper.vm.choosing = {entry: 1};
    await wrapper.setProps({playerView: fakePlayerViewModel({waitingFor: actionMenu()} as never)});
    expect(wrapper.vm.trading).is.undefined;
    expect(wrapper.vm.confirming).is.undefined;
    expect(wrapper.vm.choosing).is.undefined;
  });

  it('putting the panel down abandons what it was raised for', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.openEntry(0);
    wrapper.vm.setSnap('closed');

    expect(pickFocus.value).eq('none');
    expect(pickedEntry.value).is.undefined;
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

  it('puts a plain pick among cards in the card chooser, not the sheet', () => {
    const wrapper = mount(cardChoice([CardName.ANTS, CardName.BIRDS]));
    wrapper.vm.choosing = undefined;
    wrapper.vm.raiseSheet();
    expect(wrapper.vm.choosing).deep.eq({entry: undefined});
    expect(wrapper.vm.snap).eq('closed');
  });

  it('puts a number to choose in the amount sheet, not the sheet', async () => {
    const wrapper = mount({type: 'amount', title: 'Select amount', buttonLabel: 'Decrease', min: 1, max: 10, maxByDefault: false} as PlayerInputModel);
    wrapper.vm.asking = undefined;
    wrapper.vm.raiseSheet();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.asking).eq('amount');
    expect(wrapper.vm.snap).eq('closed');
    expect(wrapper.findComponent({name: 'MobileAmountSheet'}).exists()).is.true;
  });

  it('puts a price to pay in the payment sheet, not the sheet', async () => {
    const wrapper = mount({type: 'payment', title: 'Select how to spend 3 M€', buttonLabel: 'Pay', amount: 3, paymentOptions: {heat: true}} as unknown as PlayerInputModel);
    wrapper.vm.asking = undefined;
    wrapper.vm.raiseSheet();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.asking).eq('payment');
    expect(wrapper.vm.snap).eq('closed');
    expect(wrapper.findComponent({name: 'MobilePaymentSheet'}).exists()).is.true;
  });

  it('heads each confirmed action with its own glyph', () => {
    const wrapper = mount();
    const glyphs = (['convertHeat', 'pass', 'endTurn', 'undo'] as const).map((annotation) => {
      wrapper.vm.confirming = annotation;
      return wrapper.vm.confirmGlyph.icon;
    });
    expect(glyphs).deep.eq(['thermometer', 'skip-forward', 'check-check', 'undo-2']);
  });

  it('puts a player to choose in the choice sheet, not the sheet', async () => {
    const wrapper = mount({type: 'player', title: 'Select player', buttonLabel: 'Decrease', players: ['green', 'yellow']} as PlayerInputModel);
    wrapper.vm.asking = undefined;
    wrapper.vm.raiseSheet();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.asking).eq('choice');
    expect(wrapper.findComponent({name: 'MobileChoiceSheet'}).exists()).is.true;
  });

  it('takes an option that is a question of its own on to the sheet that asks it', async () => {
    const amount = {type: 'amount', title: 'How many', buttonLabel: 'OK', min: 0, max: 3, maxByDefault: false} as PlayerInputModel;
    const wrapper = mount({type: 'or', title: 'Choose', buttonLabel: 'OK', options: [cardChoice([CardName.ANTS]), amount, option('Skip')]} as PlayerInputModel);
    wrapper.vm.openNested({kind: 'amount', index: 1});
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.asking).eq('amount');
    expect(wrapper.vm.askingEntry).eq(1);
    expect(wrapper.findComponent({name: 'MobileAmountSheet'}).props('entry')).eq(1);

    wrapper.vm.openNested({kind: 'card', index: 0});
    expect(wrapper.vm.asking).is.undefined;
    expect(wrapper.vm.askingEntry).is.undefined;
    expect(wrapper.vm.choosing).deep.eq({entry: 0});
  });

  it('puts a choice between plain options in the choice sheet, not the sheet', async () => {
    const choice = {type: 'or', title: 'Remove plants', buttonLabel: 'Confirm', options: [option('From Green'), option('From Yellow')]} as PlayerInputModel;
    const wrapper = mount(choice);
    wrapper.vm.asking = undefined;
    wrapper.vm.raiseSheet();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.asking).eq('choice');
    expect(wrapper.vm.snap).eq('closed');
    expect(wrapper.findComponent({name: 'MobileChoiceSheet'}).exists()).is.true;
  });

  it('raises a question with cards inside it all the way, so every card is on screen', () => {
    const space = {type: 'space', title: 'Where', buttonLabel: 'OK', spaces: []} as unknown as PlayerInputModel;
    const nested = {type: 'or', title: 'Choose', buttonLabel: 'OK', options: [cardChoice([CardName.ANTS]), space]} as PlayerInputModel;
    const wrapper = mount(nested);
    wrapper.vm.raiseSheet();
    expect(wrapper.vm.snap).eq('full');

    const question = mount(option('Pay 3 M€?'));
    question.vm.raiseSheet();
    expect(question.vm.snap).eq('half');
  });

  /* The shell is drawn afresh after every answer, so a draft pick or the cards to buy
     must be up from the start, not behind the turn page's row. */
  it('opens with a waiting question already up', () => {
    expect(mount(cardChoice([CardName.ANTS])).vm.choosing).deep.eq({entry: undefined});
    expect(mount(option('Pay 3 M€?')).vm.snap).eq('half');
    const idle = mount(actionMenu());
    expect(idle.vm.snap).eq('closed');
    expect(idle.vm.choosing).is.undefined;
  });

  it('a card chooser put down for a question that must be answered comes back from the header', async () => {
    const wrapper = mount(cardChoice([CardName.ANTS]));
    await wrapper.vm.$nextTick();
    wrapper.findComponent({name: 'MobileCardChooser'}).vm.$emit('close');
    expect(wrapper.vm.choosing).is.undefined;
    wrapper.findComponent({name: 'MobileHeader'}).vm.$emit('openSheet');
    expect(wrapper.vm.choosing).deep.eq({entry: undefined});
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
    expect(wrapper.vm.logGenerations.map((group: {generation: number}) => group.generation)).deep.eq([2, 1]);
    expect(wrapper.vm.logGenerations[1].events[0].title).eq('Played Ants');
  });
});
