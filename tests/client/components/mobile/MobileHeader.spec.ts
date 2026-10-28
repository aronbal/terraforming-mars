import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileHeader from '@/client/components/mobile/MobileHeader.vue';
import {fakeGameModel, fakeGameOptionsModel, fakePublicPlayerModel} from '../testHelpers';
import {CardName} from '@/common/cards/CardName';

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
        yourTurn: true,
        turnLabel: 'Your turn',
        showTagRow: true,
      },
    });
  }

  it('mounts without errors', () => {
    expect(mount(false).exists()).is.true;
  });

  it('counts each global parameter in the steps it moves by', () => {
    const parameters = mount(false).vm.globalParameters;
    expect(parameters.map((p: {key: string}) => p.key)).deep.eq(['temperature', 'oxygen', 'oceans']);
    // -30 to +8 in steps of two degrees: 19 steps, 7 of them taken at -16.
    expect(parameters[0]).deep.include({value: '-16°', goal: '+8°', passed: 7, total: 19});
    expect(parameters[1]).deep.include({value: '9', goal: '14%', passed: 9, total: 14});
    expect(parameters[2]).deep.include({value: '5', goal: '9', passed: 5, total: 9});
  });

  it('shows each parameter against its goal, and ticks off the ones that reached it', async () => {
    const wrapper = mount(false);
    expect(wrapper.find('[data-test="global-value-temperature"]').text()).eq('-16°/+8°');
    expect(wrapper.find('[data-test="global-value-oxygen"]').text()).eq('9/14%');
    expect(wrapper.find('[data-test="global-done"]').exists()).is.false;

    await wrapper.setProps({game: {...wrapper.vm.game, oceans: 9}});
    expect(wrapper.find('[data-test="global-oceans"]').classes()).contains('mobile-global--done');
    expect(wrapper.find('[data-test="global-oceans"] [data-test="global-done"]').exists()).is.true;
    expect(wrapper.find('[data-test="global-oxygen"]').classes()).does.not.contain('mobile-global--done');
  });

  it('shows Venus only when the expansion is on', () => {
    const venus = mount(true).vm.globalParameters.find((p: {key: string}) => p.key === 'venus');
    expect(venus).deep.include({value: '12', goal: '30%', passed: 6, total: 15});
    expect(mount(false).vm.globalParameters.map((p: {key: string}) => p.key)).does.not.contain('venus');
  });

  it('shows production alongside each resource', () => {
    const resources = mount(false).vm.resources;
    expect(resources).has.length(6);
    expect(resources[0].count).eq(12);
    expect(resources[0].production).eq(3);
  });

  /* Production rides on the icon as a badge, and only where there is some. */
  it('badges only the resources with production', () => {
    const wrapper = mount(false);
    expect(wrapper.find('[data-test="resource-megacredits"] [data-test="resource-production"]').text()).eq('+3');
    expect(wrapper.find('[data-test="resource-steel"] [data-test="resource-production"]').exists()).is.false;
  });

  it('shows what steel and titanium are worth, and marks a raised rate', async () => {
    const wrapper = mount(false);
    expect(wrapper.find('[data-test="resource-steel"] [data-test="resource-value"]').text()).eq('2');
    expect(wrapper.find('[data-test="resource-titanium"] [data-test="resource-value"]').text()).eq('3');
    expect(wrapper.find('[data-test="resource-plants"] [data-test="resource-value"]').exists()).is.false;
    expect(wrapper.find('[data-test="resource-heat"] [data-test="resource-value"]').exists()).is.false;
    expect(wrapper.find('.mobile-resource-value--raised').exists()).is.false;

    await wrapper.setProps({player: {...wrapper.vm.player, titaniumValue: 4}});
    const titanium = wrapper.find('[data-test="resource-titanium"] [data-test="resource-value"]');
    expect(titanium.text()).eq('4');
    expect(titanium.classes()).contains('mobile-resource-value--raised');
  });

  it('shows heat worth 1 M€ with Helion', async () => {
    const wrapper = mount(false);
    await wrapper.setProps({player: {...wrapper.vm.player, tableau: [{name: CardName.HELION}]}});
    expect(wrapper.find('[data-test="resource-heat"] [data-test="resource-value"]').text()).eq('1');
  });

  /* The views are in the tab bar at the bottom; the tags took their place. */
  it('shows the tags where the views used to be', () => {
    const wrapper = mount(false);
    expect(wrapper.findComponent({name: 'MobileTagRow'}).exists()).is.true;
    expect(wrapper.find('[data-test="view-log"]').exists()).is.false;
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
