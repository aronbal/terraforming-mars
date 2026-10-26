import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileCardPicker from '@/client/components/mobile/MobileCardPicker.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';

describe('MobileCardPicker', () => {
  const cards = [CardName.ANTS, CardName.BIRDS, CardName.FISH].map((name) => ({name} as CardModel));

  function render(max: number) {
    return mount(MobileCardPicker, {...globalConfig, props: {cards, max}});
  }

  it('moves a single choice to the card tapped', async () => {
    const wrapper = render(1);
    const items = wrapper.findAll('[data-test="card-picker-card"]');
    await items[0].trigger('click');
    await items[1].trigger('click');
    expect(wrapper.emitted('cardschanged')?.at(-1)).deep.eq([[CardName.BIRDS]]);
    expect(wrapper.findAll('[data-test="card-picker-check"]')).has.length(1);
  });

  it('adds cards up to the most allowed, and puts one back with a second tap', async () => {
    const wrapper = render(2);
    const items = wrapper.findAll('[data-test="card-picker-card"]');
    await items[0].trigger('click');
    await items[1].trigger('click');
    await items[2].trigger('click');
    expect(wrapper.emitted('cardschanged')?.at(-1)).deep.eq([[CardName.ANTS, CardName.BIRDS]]);
    await items[0].trigger('click');
    expect(wrapper.emitted('cardschanged')?.at(-1)).deep.eq([[CardName.BIRDS]]);
  });
});
