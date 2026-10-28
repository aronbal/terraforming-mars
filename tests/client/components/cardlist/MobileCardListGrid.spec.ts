import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileCardListGrid from '@/client/components/cardlist/MobileCardListGrid.vue';
import {CardName} from '@/common/cards/CardName';

describe('MobileCardListGrid', () => {
  it('draws one button per card and reports the one tapped', async () => {
    const wrapper = mount(MobileCardListGrid, {
      ...globalConfig,
      props: {cards: [CardName.ANTS, CardName.BIRDS], tallCards: false},
    });

    const buttons = wrapper.findAll('[data-test=card-list-card]');
    expect(buttons).has.length(2);

    await buttons[1].trigger('click');
    expect(wrapper.emitted('open')).deep.eq([[CardName.BIRDS]]);
  });
});
