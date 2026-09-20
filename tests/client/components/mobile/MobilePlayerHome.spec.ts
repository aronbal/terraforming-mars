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
import {resetPickFocusForTest} from '@/client/utils/mobileFocus';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

describe('MobilePlayerHome', () => {
  let localStorage: FakeLocalStorage;

  /* The turn's menu, which is what makes the action panel a tab rather than the
     sheet a follow-up question arrives in. */
  function actionMenu(): PlayerInputModel {
    return {
      type: 'or',
      title: 'Take your first action',
      buttonLabel: 'Take action',
      options: [{type: 'option', title: 'Pass for this generation', buttonLabel: 'Pass', annotation: 'pass'}],
    } as PlayerInputModel;
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

  it('mounts without errors, on the board tab', () => {
    const wrapper = mount();
    expect(wrapper.exists()).is.true;
    expect(wrapper.vm.tab).eq('board');
  });

  it('marks the body so the page behind the shell stops scrolling', () => {
    const wrapper = mount();
    expect(document.body.classList.contains('mobile-shell-active')).is.true;
    wrapper.unmount();
    expect(document.body.classList.contains('mobile-shell-active')).is.false;
  });

  it('Act raises and lowers the sheet rather than switching pane', async () => {
    const wrapper = mount();
    wrapper.vm.selectTab('actions');
    expect(wrapper.vm.snap).eq('half');
    expect(wrapper.vm.tab).eq('board');

    wrapper.vm.selectTab('actions');
    expect(wrapper.vm.snap).eq('peek');
  });

  it('a space selection clears the board and closes the sheet', async () => {
    const wrapper = mount();
    wrapper.vm.selectTab('cards');
    wrapper.vm.selectTab('actions');

    beginSpaceSelection();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.tab).eq('board');
    expect(wrapper.vm.snap).eq('closed');
  });

  it('finishes a card over the tab it was tapped on', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.selectTab('cards');
    wrapper.vm.playCard(CardName.ANTS);

    expect(wrapper.vm.tab).eq('cards');
    expect(wrapper.vm.overTab).is.true;
    // Half, so the card itself stays on screen above the price.
    expect(wrapper.vm.snap).eq('half');
    expect(pickedCard.value).eq(CardName.ANTS);
  });

  it('takes the player to Act instead when that is what they asked for', () => {
    PreferencesManager.INSTANCE.set('play_from', 'actions');
    const wrapper = mount(actionMenu());
    wrapper.vm.selectTab('cards');
    wrapper.vm.playCard(CardName.ANTS);

    expect(wrapper.vm.tab).eq('actions');
    expect(wrapper.vm.overTab).is.false;
  });

  it('a tile tapped under the board is the same move as a card', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.claimBoardThing('milestone', 'Builder');

    expect(wrapper.vm.tab).eq('board');
    expect(pickedBoardThing.value).deep.eq({kind: 'milestone', name: 'Builder'});
  });

  /* Only one thing is being acted on at a time, and the menu entry that opens is
     chosen by what was picked last. */
  it('a card and a tile never stay picked at once', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.playCard(CardName.ANTS);
    wrapper.vm.claimBoardThing('award', 'Landlord');

    expect(pickedCard.value).is.undefined;
    expect(pickedBoardThing.value?.name).eq('Landlord');
  });

  it('putting the panel down abandons what it was raised for', () => {
    const wrapper = mount(actionMenu());
    wrapper.vm.claimBoardThing('milestone', 'Builder');
    wrapper.vm.setSnap('peek');

    expect(wrapper.vm.overTab).is.false;
    expect(pickedBoardThing.value).is.undefined;
  });

  it('the tag row opens itself on the cards tab', () => {
    const wrapper = mount();
    expect(wrapper.vm.tagRowOpen).is.false;

    wrapper.vm.selectTab('cards');
    expect(wrapper.vm.tagRowOpen).is.true;

    wrapper.vm.toggleTagRow();
    expect(wrapper.vm.tagRowOpen).is.false;

    // The manual override lasts only until the next tab change.
    wrapper.vm.selectTab('more');
    wrapper.vm.selectTab('cards');
    expect(wrapper.vm.tagRowOpen).is.true;
  });
});
