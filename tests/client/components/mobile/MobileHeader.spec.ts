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
          temperature: -16,
          oxygenLevel: 9,
          oceans: 5,
        }),
        player: fakePublicPlayerModel({megacredits: 12, megacreditProduction: 3}),
        showTagRow: false,
        tagRowOpen: false,
      },
    });
  }

  it('mounts without errors', () => {
    expect(mount(false).exists()).is.true;
  });

  it('shows each global parameter as current over maximum', () => {
    const parameters = mount(false).vm.globalParameters;
    expect(parameters.map((p) => p.key)).deep.eq(['temperature', 'oxygen', 'ocean']);
    expect(parameters[0].current).eq('-16°');
    expect(parameters[0].max).eq('+8°');
    expect(parameters[1].current).eq('9%');
    expect(parameters[2].current).eq('5');
    expect(parameters[2].max).eq('9');
  });

  it('shows Venus only when the expansion is on', () => {
    expect(mount(true).vm.globalParameters.map((p) => p.key)).contains('venus');
  });

  it('shows production alongside each resource', () => {
    const resources = mount(false).vm.resources;
    expect(resources).has.length(6);
    expect(resources[0].count).eq(12);
    expect(resources[0].production).eq(3);
  });
});
