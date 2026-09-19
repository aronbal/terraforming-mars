import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileTagRow from '@/client/components/mobile/MobileTagRow.vue';
import {emptyTags, fakePublicPlayerModel} from '../testHelpers';
import {Tag} from '@/common/cards/Tag';

describe('MobileTagRow', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(MobileTagRow, {
      ...globalConfig,
      props: {player: fakePublicPlayerModel(), open: true},
    });
    expect(wrapper.exists()).is.true;
  });

  it('lists only the tags the player owns, in board order', () => {
    const tags = {...emptyTags(), [Tag.SCIENCE]: 2, [Tag.BUILDING]: 3};
    const wrapper = shallowMount(MobileTagRow, {
      ...globalConfig,
      props: {player: fakePublicPlayerModel({tags}), open: true},
    });
    expect(wrapper.vm.ownedTags).deep.eq([
      {name: Tag.BUILDING, count: 3},
      {name: Tag.SCIENCE, count: 2},
    ]);
  });
});
