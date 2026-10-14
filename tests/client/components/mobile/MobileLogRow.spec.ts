import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileLogRow from '@/client/components/mobile/MobileLogRow.vue';
import {LogEvent} from '@/client/components/mobile/MobileLog';

describe('MobileLogRow', () => {
  function mount(event: Partial<LogEvent> = {}) {
    return shallowMount(MobileLogRow, {
      ...globalConfig,
      props: {
        event: {key: 'k', generation: 5, title: 'Played Comet', color: 'red', icon: 'layers', timestamp: 0, private: false, effects: undefined, ...event},
        players: [{color: 'red', name: 'Mette'}],
        now: 2 * 60_000,
      },
    });
  }

  it('says what happened, who did it and when', () => {
    const wrapper = mount();
    expect(wrapper.text()).contains('Played Comet');
    expect(wrapper.text()).contains('Mette · 2 min');
  });

  it('paints the glyph in the acting player\'s colour', () => {
    expect(mount().find('[data-test="log-glyph"]').classes()).contains('player_bg_color_red');
    expect(mount({color: undefined}).find('[data-test="log-glyph"]').classes()).contains('mobile-glyph--neutral');
  });

  it('shows what the line changed when it is known', () => {
    expect(mount().find('[data-test="log-trailing"]').exists()).is.false;
    expect(mount({effects: '+1 temp · ocean'}).find('[data-test="log-trailing"]').text()).eq('+1 temp · ocean');
  });
});
