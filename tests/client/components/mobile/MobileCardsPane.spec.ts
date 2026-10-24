import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileCardsPane from '@/client/components/mobile/MobileCardsPane.vue';
import {fakePlayerViewModel} from '../testHelpers';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {CardName} from '@/common/cards/CardName';
import {menu, projectCard} from './menuFixtures';

describe('MobileCardsPane', () => {
  let localStorage: FakeLocalStorage;

  function mount() {
    return shallowMount(MobileCardsPane, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel({
          cardsInHand: [{name: CardName.BIRDS, calculatedCost: 10}, {name: CardName.ANTS, calculatedCost: 9}],
          waitingFor: menu(projectCard(CardName.ANTS)),
        } as never),
      },
    });
  }

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
  });

  it('mounts without errors, showing the hand', () => {
    const wrapper = mount();
    expect(wrapper.exists()).is.true;
    expect(wrapper.vm.view).eq('hand');
  });

  it('puts the cards the turn can play first', () => {
    expect(mount().vm.hand.map((card) => card.name)).deep.eq([CardName.ANTS, CardName.BIRDS]);
  });

  it('a tap on a playable card selects it', async () => {
    const wrapper = mount();
    await wrapper.findAll('[data-test="hand-card"]')[0].trigger('click');
    expect(wrapper.emitted('select')).deep.eq([[CardName.ANTS]]);
  });

  it('dims a card that cannot be played, and does not let it be tapped', () => {
    const birds = mount().findAll('[data-test="hand-card"]')[1];
    expect(birds.classes()).contains('mobile-card-button--idle');
    expect(birds.attributes('disabled')).is.not.undefined;
  });

  it('passes a tap on a playable card up', async () => {
    const wrapper = mount();
    await wrapper.findAll('[data-test="hand-card"]')[0].trigger('click');
    expect(wrapper.emitted('select')).deep.eq([[CardName.ANTS]]);
  });

  it('groups the tableau, dropping the groups that are empty', () => {
    expect(mount().vm.playedGroups).deep.eq([]);
  });
});
