import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileTurmoilPanel from '@/client/components/mobile/MobileTurmoilPanel.vue';
import {GlobalEventName} from '@/common/turmoil/globalEvents/GlobalEventName';
import {fakeTurmoil} from './menuFixtures';

describe('MobileTurmoilPanel', () => {
  function mount() {
    const turmoil = fakeTurmoil();
    turmoil.coming = GlobalEventName.SPONSORED_PROJECTS;
    return shallowMount(MobileTurmoilPanel, {
      ...globalConfig,
      props: {turmoil},
    });
  }

  it('says who rules and who chairs', () => {
    const wrapper = mount();
    expect(wrapper.find('[data-test="turmoil-ruling"]').text()).contains('Greens');
    expect(wrapper.find('[data-test="turmoil-chairman"]').classes()).contains('mobile-choice-standing-dot--unknown');
  });

  it('lists only the global events that are on their way', () => {
    const events = mount().findAll('[data-test="turmoil-event"]');
    expect(events).has.length(1);
    expect(events[0].text()).contains('Coming');
  });

  it('draws every party', () => {
    expect(mount().findAll('[data-test="turmoil-party"]')).has.length(3);
  });
});
