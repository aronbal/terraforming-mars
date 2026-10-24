import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileLogCards from '@/client/components/mobile/MobileLogCards.vue';
import {LogEvent} from '@/client/components/mobile/MobileLog';
import {CardName} from '@/common/cards/CardName';

describe('MobileLogCards', () => {
  function mount(event: Partial<LogEvent> = {}) {
    return shallowMount(MobileLogCards, {
      ...globalConfig,
      props: {
        event: {
          key: 'k', generation: 5, title: 'Played Comet', color: 'red', icon: 'layers', timestamp: 0, private: false, effects: undefined,
          cards: [CardName.COMET], ...event,
        },
        players: [{color: 'red', name: 'Mette'}],
        now: 2 * 60_000,
      },
    });
  }

  it('shows the line with who did it and when', () => {
    const wrapper = mount();
    expect(wrapper.text()).contains('Played Comet');
    expect(wrapper.text()).contains('Mette · 2 min');
    expect(wrapper.find('[data-test="log-cards-glyph"]').classes()).contains('player_bg_color_red');
  });

  it('shows every card the line names', () => {
    const wrapper = mount({cards: [CardName.ANTS, CardName.COMET]});
    const cards = wrapper.findAllComponents({name: 'Card'});
    expect(cards.map((card) => card.props('card').name)).deep.eq([CardName.ANTS, CardName.COMET]);
  });

  it('closes on a tap anywhere', async () => {
    const wrapper = mount();
    await wrapper.find('[data-test="log-cards-card"]').trigger('click');
    expect(wrapper.emitted('close')).has.length(1);
  });
});
