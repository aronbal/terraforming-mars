import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileCardsPane from '@/client/components/mobile/MobileCardsPane.vue';
import {fakePlayerViewModel} from '../testHelpers';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {CardName} from '@/common/cards/CardName';

describe('MobileCardsPane', () => {
  let localStorage: FakeLocalStorage;

  function mount(cardScale = 0.62) {
    return shallowMount(MobileCardsPane, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel({
          cardsInHand: [{name: CardName.ANTS, calculatedCost: 9}],
        }),
        cardScale,
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
    expect(wrapper.vm.hand).has.length(1);
  });

  it('hands the card scale to the stylesheet', () => {
    expect(mount(0.8).vm.scaleStyle).deep.eq({'--mobile-card-scale': '0.8'});
  });

  it('a tap magnifies the card', async () => {
    const wrapper = mount();
    expect(wrapper.find('[data-test="magnified-card"]').exists()).is.false;
    await wrapper.find('[data-test="hand-card"]').trigger('click');
    expect(wrapper.find('[data-test="magnified-card"]').exists()).is.true;
  });

  it('groups the tableau, dropping the groups that are empty', () => {
    expect(mount().vm.playedGroups).deep.eq([]);
  });
});
