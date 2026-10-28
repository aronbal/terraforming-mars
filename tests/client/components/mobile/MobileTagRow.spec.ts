import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileTagRow from '@/client/components/mobile/MobileTagRow.vue';
import {emptyTags, fakePublicPlayerModel} from '../testHelpers';
import {Tag} from '@/common/cards/Tag';
import {SpecialTags} from '@/client/cards/SpecialTags';

describe('MobileTagRow', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(MobileTagRow, {
      ...globalConfig,
      props: {player: fakePublicPlayerModel()},
    });
    expect(wrapper.exists()).is.true;
  });

  it('draws nothing before the first tag', () => {
    const wrapper = shallowMount(MobileTagRow, {
      ...globalConfig,
      props: {player: fakePublicPlayerModel({tags: emptyTags()})},
    });
    expect(wrapper.find('[data-test="tag-row-list"]').exists()).is.false;
  });

  it('lists only the tags the player owns, in board order', () => {
    const tags = {...emptyTags(), [Tag.SCIENCE]: 2, [Tag.BUILDING]: 3};
    const wrapper = shallowMount(MobileTagRow, {
      ...globalConfig,
      props: {player: fakePublicPlayerModel({tags})},
    });
    expect(wrapper.vm.ownedTags).deep.eq([
      {name: Tag.BUILDING, count: 3},
      {name: Tag.SCIENCE, count: 2},
    ]);
  });

  it('counts corruption after the tags', () => {
    const tags = {...emptyTags(), [Tag.CRIME]: 1};
    const underworldData = {corruption: 2, excavations: [], tokens: []};
    const wrapper = shallowMount(MobileTagRow, {
      ...globalConfig,
      props: {player: fakePublicPlayerModel({tags, underworldData})},
    });
    expect(wrapper.vm.ownedTags).deep.eq([
      {name: Tag.CRIME, count: 1},
      {name: SpecialTags.CORRUPTION, count: 2},
    ]);
  });
});
