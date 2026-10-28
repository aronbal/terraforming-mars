import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import CardList from '@/client/components/cardlist/CardList.vue';
import {CardName} from '@/common/cards/CardName';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {
  refreshMobileLayoutPreference,
  resetMobileLayoutForTest,
  startMobileLayoutTracking,
} from '@/client/utils/useMobileLayout';

describe('CardList', () => {
  let mounted: {unmount(): void} | undefined;

  // The list is built from the hash, so each test narrows it to a few cards.
  function mountWith(hash: string) {
    window.location.hash = hash;
    const wrapper = mount(CardList, {...globalConfig});
    mounted = wrapper;
    return wrapper;
  }

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
    window.location.hash = '';
  });

  it('mounts on the desktop', () => {
    const wrapper = mountWith('#psyche');
    expect(wrapper.find('.card-list-container').exists()).is.true;
    expect(wrapper.find('[data-test=mobile-card-list]').exists()).is.false;
  });

  describe('on a phone', () => {
    beforeEach(() => {
      PreferencesManager.resetForTest();
      resetMobileLayoutForTest();
      startMobileLayoutTracking();
      PreferencesManager.INSTANCE.set('mobile_layout', 'on');
      refreshMobileLayoutPreference();
    });

    afterEach(() => {
      PreferencesManager.resetForTest();
      resetMobileLayoutForTest();
    });

    it('draws the shell page instead of the desktop list', () => {
      const wrapper = mountWith('#psyche');
      expect(wrapper.find('[data-test=mobile-card-list]').exists()).is.true;
      expect(wrapper.find('.card-list-container').exists()).is.false;
      expect(wrapper.find('[data-test=card-list-back]').attributes('href')).eq('/');
    });

    it('lists the cards the search matches', async () => {
      const wrapper = mountWith('#psyche');
      expect(wrapper.findAll('[data-test=card-list-card]')).has.length(1);

      await wrapper.find('[data-test=card-list-filter]').setValue('zzzz-no-such-card');
      expect(wrapper.findAll('[data-test=card-list-card]')).is.empty;
      expect(wrapper.find('[data-test=card-list-empty]').exists()).is.true;
    });

    it('opens a card large and puts it back', async () => {
      const wrapper = mountWith('#psyche');
      await wrapper.find('[data-test=card-list-card]').trigger('click');
      expect(wrapper.vm.magnified).eq(CardName.PSYCHE);
      expect(wrapper.find('[data-test=card-list-magnified]').exists()).is.true;

      await wrapper.find('[data-test=card-list-magnified]').trigger('click');
      expect(wrapper.find('[data-test=card-list-magnified]').exists()).is.false;
    });

    it('filters by expansion from the sheet, and resets', async () => {
      const wrapper = mountWith('#psyche');
      expect(wrapper.find('.mobile-card-list-filters--on').exists()).is.false;

      await wrapper.find('[data-test=card-list-open-filters]').trigger('click');
      expect(wrapper.find('[data-test=card-list-filters]').exists()).is.true;
      // 16 Psyche is a promo.
      await wrapper.find('[data-test=filter-module-promo]').trigger('click');

      expect(wrapper.vm.expansions.promo).is.false;
      expect(wrapper.findAll('[data-test=card-list-card]')).is.empty;
      expect(wrapper.find('.mobile-card-list-filters--on').exists()).is.true;

      await wrapper.find('[data-test=card-list-reset]').trigger('click');
      expect(wrapper.vm.expansions.promo).is.true;
      expect(wrapper.findAll('[data-test=card-list-card]')).has.length(1);
    });

    it('turns a whole group off and on', () => {
      const wrapper = mountWith('#psyche');
      const vm = wrapper.vm;

      vm.setAllTags();
      expect(vm.allTagsOn).is.false;
      expect(vm.types.event).is.false;

      vm.setAllTags();
      expect(vm.allTagsOn).is.true;
      expect(vm.types.event).is.true;
    });

    it('cycles the victory point filter from its chip', async () => {
      const wrapper = mountWith('#psyche');
      const chip = wrapper.find('[data-test=card-list-vps]');
      expect(chip.text()).eq('all');
      await chip.trigger('click');
      expect(chip.text()).eq('+VPs');
      await chip.trigger('click');
      expect(chip.text()).eq('-VPs');
    });
  });
});
