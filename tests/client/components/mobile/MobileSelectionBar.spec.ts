import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileSelectionBar from '@/client/components/mobile/MobileSelectionBar.vue';
import {CardName} from '@/common/cards/CardName';

describe('MobileSelectionBar', () => {
  function mount(name: CardName, offer: 'play' | 'action') {
    return shallowMount(MobileSelectionBar, {
      ...globalConfig,
      props: {card: {name, calculatedCost: 14}, offer, megacredits: 34},
    });
  }

  it('names the card and its price against what the player has', () => {
    const wrapper = mount(CardName.COMET, 'play');
    expect(wrapper.text()).contains('Comet');
    expect(wrapper.find('[data-test="selection-sub"]').text()).eq('14 M€ · 34 available');
    expect(wrapper.find('[data-test="selection-confirm"]').text()).eq('Play');
  });

  it('says what an action does, without the word Action', () => {
    const wrapper = mount(CardName.SPACE_ELEVATOR, 'action');
    expect(wrapper.find('[data-test="selection-sub"]').text()).eq('Spend 1 steel to gain 5 M€.');
    expect(wrapper.find('[data-test="selection-confirm"]').text()).eq('Use');
  });

  it('cancels, confirms, and opens the card to read', async () => {
    const wrapper = mount(CardName.COMET, 'play');
    await wrapper.find('[data-test="selection-cancel"]').trigger('click');
    await wrapper.find('[data-test="selection-confirm"]').trigger('click');
    await wrapper.find('[data-test="selection-inspect"]').trigger('click');
    expect(wrapper.emitted('cancel')).has.length(1);
    expect(wrapper.emitted('confirm')).has.length(1);
    expect(wrapper.emitted('inspect')).has.length(1);
  });
});
