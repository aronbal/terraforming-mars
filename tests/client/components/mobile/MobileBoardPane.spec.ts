import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileBoardPane from '@/client/components/mobile/MobileBoardPane.vue';
import {BoardFraming} from '@/client/components/mobile/BoardGame';
import {fakeGameModel} from '../testHelpers';
import {beginSpaceSelection, clearPlacement, offerPlacement, resetSpaceSelectionForTest} from '@/client/utils/spaceSelection';

describe('MobileBoardPane', () => {
  function mount(framing: BoardFraming = 'column') {
    return shallowMount(MobileBoardPane, {
      ...globalConfig,
      props: {
        game: fakeGameModel(),
        tileView: 'show',
        tapTargets: false,
        framing,
      },
    });
  }

  it('mounts without errors', () => {
    expect(mount().exists()).is.true;
  });

  it('scales the whole artwork as one unit', () => {
    const wrapper = mount();
    wrapper.vm.scale = 0.5;
    wrapper.vm.offsetX = 12;
    wrapper.vm.offsetY = 34;
    expect(wrapper.vm.stageStyle.transform).eq('translate(12px, 34px) scale(0.5)');
  });

  it('reports the tap-target size a hex actually has', () => {
    const wrapper = mount();
    wrapper.vm.scale = 0.62;
    expect(wrapper.vm.hexPixels).eq(29);
    expect(wrapper.vm.zoomPercent).eq(62);
  });

  it('draws the tap-target overlay only when asked', async () => {
    const wrapper = mount();
    expect(wrapper.find('.mobile-board-stage--tap-targets').exists()).is.false;
    await wrapper.setProps({tapTargets: true});
    expect(wrapper.find('.mobile-board-stage--tap-targets').exists()).is.true;
  });

  it('is a picture in the board-game frame: no controls, and a tap zooms in', async () => {
    const wrapper = mount('picture');
    expect(wrapper.find('[data-test="zoom-readout"]').exists()).is.false;
    expect(wrapper.find('.mobile-board-hud').exists()).is.false;
    expect(wrapper.find('[data-test="board-close"]').exists()).is.false;
    await wrapper.find('[data-test="board-open"]').trigger('click');
    expect(wrapper.emitted('open')).has.length(1);
  });

  it('zoomed in from the frame, pans and zooms with a way back out', async () => {
    const wrapper = mount('zoomed');
    expect(wrapper.find('.mobile-board-hud').exists()).is.true;
    expect(wrapper.find('[data-test="board-open"]').exists()).is.false;
    await wrapper.find('[data-test="board-close"]').trigger('click');
    expect(wrapper.emitted('close')).has.length(1);
  });

  it('keeps the map while a space is being chosen, so there is no way back to the picture', async () => {
    beginSpaceSelection();
    const wrapper = mount('zoomed');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-test="board-close"]').exists()).is.false;
    expect(wrapper.find('[data-test="placement-bar"]').exists()).is.true;
    resetSpaceSelectionForTest();
  });

  it('draws the modern column as it always has', () => {
    const wrapper = mount();
    expect(wrapper.find('[data-test="board-section-column"]').exists()).is.true;
    expect(wrapper.find('[data-test="board-open"]').exists()).is.false;
    expect(wrapper.find('[data-test="board-close"]').exists()).is.false;
  });

  /* On a phone the question is asked in the bar under the map, clear of the space. */
  describe('placement bar', () => {
    afterEach(() => {
      resetSpaceSelectionForTest();
    });

    it('asks to choose a space, with the way back to the actions', async () => {
      beginSpaceSelection();
      const wrapper = mount();
      await wrapper.vm.$nextTick();
      expect(wrapper.find('[data-test="placement-bar"]').exists()).is.true;
      expect(wrapper.find('[data-test="placement-confirm"]').exists()).is.false;
    });

    it('confirms or cancels a tapped space', async () => {
      beginSpaceSelection();
      let confirmed = 0;
      let cancelled = 0;
      offerPlacement({spaceId: '03', tileType: undefined, color: 'red', confirm: () => confirmed++, cancel: () => cancelled++});
      const wrapper = mount();
      await wrapper.vm.$nextTick();

      await wrapper.find('[data-test="placement-confirm"]').trigger('click');
      await wrapper.find('[data-test="placement-cancel"]').trigger('click');
      expect(confirmed).eq(1);
      expect(cancelled).eq(1);

      clearPlacement();
      await wrapper.vm.$nextTick();
      expect(wrapper.find('[data-test="placement-confirm"]').exists()).is.false;
    });
  });
});
