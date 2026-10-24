import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import BoardSpace from '@/client/components/BoardSpace.vue';
import {SpaceType} from '@/common/boards/SpaceType';
import {TileType} from '@/common/TileType';
import {clearPlacement, offerPlacement} from '@/client/utils/spaceSelection';

describe('BoardSpace', () => {
  it('has visible tile', async () => {
    const wrapper = mount(BoardSpace, {
      ...globalConfig,
      props: {
        space: {
          id: 'm01',
          bonus: [],
          x: 0,
          y: 0,
          spaceType: SpaceType.LAND,
        },
        tileView: 'show',
      },
    });

    expect(wrapper.find('[data-test="tile"]').classes()).to.not.contain('board-hidden-tile');
  });

  it('has hidden tile if hidden props is passed', async () => {
    const wrapper = mount(BoardSpace, {
      ...globalConfig,
      props: {
        space: {
          id: 'm01',
          bonus: [],
          x: 0,
          y: 0,
          spaceType: SpaceType.LAND,
        },
        tileView: 'hide',
      },
    });

    expect(wrapper.find('[data-test="tile"]').classes()).to.contain('board-hidden-tile');
  });

  describe('the tile about to be placed', () => {
    afterEach(() => clearPlacement());

    function render(id: 'm01' | 'm02' = 'm01') {
      return mount(BoardSpace, {
        ...globalConfig,
        props: {space: {id, bonus: [], x: 0, y: 0, spaceType: SpaceType.LAND}, tileView: 'show'},
      });
    }

    function offer(tileType: TileType | undefined) {
      offerPlacement({spaceId: 'm01', tileType, color: 'blue', confirm: () => {}, cancel: () => {}});
    }

    it('shows the tile, faded, with the player\'s cube on it', () => {
      offer(TileType.CITY);
      const wrapper = render();
      const ghost = wrapper.find('[data-test="ghost-tile"]');
      expect(ghost.classes()).to.include.members(['board-space-ghost', 'board-space-tile--city']);
      expect(wrapper.find('.board-cube--blue.board-space-ghost').exists()).is.true;
    });

    it('puts no cube on an ocean', () => {
      offer(TileType.OCEAN);
      const wrapper = render();
      expect(wrapper.find('[data-test="ghost-tile"]').classes()).to.contain('board-space-tile--ocean');
      expect(wrapper.find('.board-cube').exists()).is.false;
    });

    it('marks the space when the tile is not known', () => {
      offer(undefined);
      expect(render().find('[data-test="ghost-tile"]').classes()).to.contain('board-space-ghost--marker');
    });

    it('shows nothing on any other space', () => {
      offer(TileType.CITY);
      expect(render('m02').find('[data-test="ghost-tile"]').exists()).is.false;
    });
  });
});
