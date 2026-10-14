import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileHeader from '@/client/components/mobile/MobileHeader.vue';
import {fakeGameModel, fakeGameOptionsModel, fakePublicPlayerModel} from '../testHelpers';

describe('MobileHeader', () => {
  function mount(venus: boolean) {
    return shallowMount(MobileHeader, {
      ...globalConfig,
      props: {
        game: fakeGameModel({
          gameOptions: fakeGameOptionsModel({expansions: {venus}}),
          generation: 5,
          temperature: -16,
          oxygenLevel: 9,
          oceans: 5,
          venusScaleLevel: 12,
        }),
        player: fakePublicPlayerModel({megacredits: 12, megacreditProduction: 3, terraformRating: 28}),
        view: 'turn',
        yourTurn: true,
        turnLabel: 'Your turn',
        showTagRow: false,
        tagRowOpen: false,
      },
    });
  }

  it('mounts without errors', () => {
    expect(mount(false).exists()).is.true;
  });

  it('counts each global parameter in the steps it moves by', () => {
    const parameters = mount(false).vm.globalParameters;
    expect(parameters.map((p) => p.key)).deep.eq(['temperature', 'oxygen', 'oceans']);
    // -30 to +8 in steps of two degrees: 19 steps, 7 of them taken at -16.
    expect(parameters[0]).deep.include({value: '-16°', passed: 7, total: 19});
    expect(parameters[1]).deep.include({value: '9%', passed: 9, total: 14});
    expect(parameters[2]).deep.include({value: '5/9', passed: 5, total: 9});
  });

  it('shows Venus only when the expansion is on', () => {
    const venus = mount(true).vm.globalParameters.find((p) => p.key === 'venus');
    expect(venus).deep.include({value: '12%', passed: 6, total: 15});
    expect(mount(false).vm.globalParameters.map((p) => p.key)).does.not.contain('venus');
  });

  it('shows production alongside each resource', () => {
    const resources = mount(false).vm.resources;
    expect(resources).has.length(6);
    expect(resources[0].count).eq(12);
    expect(resources[0].production).eq(3);
  });

  it('switches the view from the segmented control', async () => {
    const wrapper = mount(false);
    await wrapper.find('[data-test="view-log"]').trigger('click');
    expect(wrapper.emitted('update:view')).deep.eq([['log']]);
  });

  it('opens the players and the menu', async () => {
    const wrapper = mount(false);
    await wrapper.find('[data-test="open-players"]').trigger('click');
    await wrapper.find('[data-test="open-menu"]').trigger('click');
    expect(wrapper.emitted('openPlayers')).has.length(1);
    expect(wrapper.emitted('openMenu')).has.length(1);
  });

  it('shows the generation and whose turn it is', () => {
    const wrapper = mount(false);
    expect(wrapper.text()).contains('Generation 5');
    expect(wrapper.find('[data-test="turn-pill"]').classes()).contains('mobile-pill--accent');
  });
});
