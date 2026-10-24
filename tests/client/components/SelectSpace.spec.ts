import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import SelectSpace from '@/client/components/SelectSpace.vue';
import {FakeLocalStorage} from './FakeLocalStorage';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {refreshMobileLayoutPreference, resetMobileLayoutForTest} from '@/client/utils/useMobileLayout';
import {pendingPlacement, resetSpaceSelectionForTest} from '@/client/utils/spaceSelection';
import {SelectSpaceResponse} from '@/common/inputs/InputResponse';

describe('SelectSpace', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
    PreferencesManager.resetForTest();
    resetMobileLayoutForTest();
    resetSpaceSelectionForTest();
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(SelectSpace, {
      ...globalConfig,
      props: {
        playerView: {} as PlayerViewModel,
        playerinput: {
          title: 'Select a space',
          buttonLabel: 'Save',
          type: 'space',
          spaces: [],
        },
        onsave: () => {},
        showsave: true,
        showtitle: true,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  /* On a phone the dialog would cover the board, so the shell's bar asks instead. */
  it('hands the confirmation to the mobile shell', () => {
    PreferencesManager.INSTANCE.set('mobile_layout', 'on');
    refreshMobileLayoutPreference();
    const saved: Array<SelectSpaceResponse> = [];
    const wrapper = shallowMount(SelectSpace, {
      ...globalConfig,
      props: {
        playerView: {} as PlayerViewModel,
        playerinput: {title: 'Select a space', buttonLabel: 'Save', type: 'space', spaces: ['05']},
        onsave: (out: SelectSpaceResponse) => saved.push(out),
        showsave: true,
        showtitle: true,
      },
    });
    const tile = document.createElement('div');
    tile.setAttribute('data_space_id', '05');

    wrapper.vm.onTileSelected(tile);
    expect(pendingPlacement.value).is.not.undefined;

    pendingPlacement.value?.confirm();
    expect(pendingPlacement.value).is.undefined;
    expect(saved).deep.eq([{type: 'space', spaceId: '05'}]);
  });
});
