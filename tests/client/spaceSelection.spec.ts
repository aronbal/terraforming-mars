import {expect} from 'chai';
import {
  beginSpaceSelection,
  endSpaceSelection,
  resetSpaceSelectionForTest,
  selectingSpace,
} from '@/client/utils/spaceSelection';

describe('spaceSelection', () => {
  afterEach(() => resetSpaceSelectionForTest());

  it('is off until an input asks for a space', () => {
    expect(selectingSpace.value).is.false;
    beginSpaceSelection();
    expect(selectingSpace.value).is.true;
    endSpaceSelection();
    expect(selectingSpace.value).is.false;
  });

  it('stays on while any nested input still wants one', () => {
    beginSpaceSelection();
    beginSpaceSelection();
    endSpaceSelection();
    expect(selectingSpace.value).is.true;
    endSpaceSelection();
    expect(selectingSpace.value).is.false;
  });

  it('never counts below zero', () => {
    endSpaceSelection();
    expect(selectingSpace.value).is.false;
    beginSpaceSelection();
    expect(selectingSpace.value).is.true;
  });
});
