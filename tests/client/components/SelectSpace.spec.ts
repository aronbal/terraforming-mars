import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import SelectSpace from '@/client/components/SelectSpace.vue';
import {FakeLocalStorage} from './FakeLocalStorage';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {refreshMobileLayoutPreference, resetMobileLayoutForTest} from '@/client/utils/useMobileLayout';
import {TileType} from '@/common/TileType';
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

  /* A question given up leaves no space that still answers it. */
  it('unwires the spaces it wired when it goes', () => {
    const board = document.createElement('div');
    board.id = 'main_board';
    const tile = document.createElement('div');
    tile.className = 'board-space-selectable';
    tile.setAttribute('data_space_id', '05');
    board.appendChild(tile);
    document.body.appendChild(board);
    try {
      const wrapper = shallowMount(SelectSpace, {
        ...globalConfig,
        props: {
          playerView: {} as PlayerViewModel,
          playerinput: {title: 'Select a space', buttonLabel: 'Save', type: 'space', spaces: ['05']},
          onsave: () => {},
          showsave: true,
          showtitle: true,
        },
      });
      expect(tile.onclick).is.not.null;
      expect(tile.classList.contains('board-space--available')).is.true;

      wrapper.unmount();

      expect(tile.onclick).is.null;
      expect(tile.classList.contains('board-space--available')).is.false;
    } finally {
      board.remove();
    }
  });

  /* On a phone the dialog would cover the board, so the shell's bar asks instead. */
  it('hands the confirmation to the mobile shell', () => {
    PreferencesManager.INSTANCE.set('mobile_layout', 'on');
    refreshMobileLayoutPreference();
    const saved: Array<SelectSpaceResponse> = [];
    const wrapper = shallowMount(SelectSpace, {
      ...globalConfig,
      props: {
        playerView: {thisPlayer: {color: 'red'}} as PlayerViewModel,
        playerinput: {title: 'Select a space', buttonLabel: 'Save', type: 'space', spaces: ['05'], tileType: TileType.CITY},
        onsave: (out: SelectSpaceResponse) => saved.push(out),
        showsave: true,
        showtitle: true,
      },
    });
    const tile = document.createElement('div');
    tile.setAttribute('data_space_id', '05');

    wrapper.vm.onTileSelected(tile);
    // What the board needs to show the tile there before it is placed.
    expect(pendingPlacement.value).deep.include({spaceId: '05', tileType: TileType.CITY, color: 'red'});

    pendingPlacement.value?.confirm();
    expect(pendingPlacement.value).is.undefined;
    expect(saved).deep.eq([{type: 'space', spaceId: '05'}]);
  });
});
