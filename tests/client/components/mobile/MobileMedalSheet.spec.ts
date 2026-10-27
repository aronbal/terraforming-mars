import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import MobileMedalSheet from '@/client/components/mobile/MobileMedalSheet.vue';

describe('MobileMedalSheet', () => {
  function render(kind: 'milestone' | 'award', name: string, offered = false) {
    const red = fakePublicPlayerModel({color: 'red', name: 'Red'});
    const green = fakePublicPlayerModel({color: 'green', name: 'Green'});
    const playerView = fakePlayerViewModel({thisPlayer: red, players: [red, green]} as never);
    playerView.game.milestones = [
      {name: 'Mayor', playerName: 'Green', color: 'green', scores: [{color: 'green', score: 3, claimable: true}]},
    ];
    playerView.game.awards = [
      {name: 'Banker', playerName: undefined, color: undefined, scores: [{color: 'red', score: 2}, {color: 'green', score: 5}]},
    ];
    return mount(MobileMedalSheet, {...globalConfig, props: {playerView, kind, name, offered}});
  }

  it('reads out the rule, what it pays, and everyone\'s score best first', () => {
    const wrapper = render('award', 'Banker');
    expect(wrapper.find('[data-test="medal-sheet-rule"]').text()).contains('Have the most M€ production');
    expect(wrapper.find('[data-test="medal-sheet-rule"]').text()).contains('1st 5 VP at the end');
    expect(wrapper.find('[data-test="medal-sheet-scores"]').text()).match(/Green\s*5.*Red\s*2/s);
    expect(wrapper.find('[data-test="medal-sheet-art"]').attributes('style')).contains('assets/ma/banker.png');
  });

  it('names who claimed it', () => {
    expect(render('milestone', 'Mayor').find('[data-test="medal-sheet-owner"]').text()).eq('Green');
  });

  it('offers Claim or Fund only when the turn does, and sends nothing itself', async () => {
    expect(render('award', 'Banker').find('[data-test="medal-sheet-claim"]').exists()).is.false;
    const wrapper = render('award', 'Banker', true);
    const button = wrapper.find('[data-test="medal-sheet-claim"]');
    expect(button.text()).eq('Fund');
    await button.trigger('click');
    expect(wrapper.emitted('claim')).has.length(1);
  });

  it('is put down from its scrim or its Close', async () => {
    const wrapper = render('milestone', 'Mayor');
    await wrapper.find('[data-test="medal-sheet-scrim"]').trigger('click');
    await wrapper.find('[data-test="medal-sheet-close"]').trigger('click');
    expect(wrapper.emitted('close')).has.length(2);
  });
});
