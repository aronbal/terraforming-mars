import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileMilestonesAwards from '@/client/components/mobile/MobileMilestonesAwards.vue';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {FundedAwardModel} from '@/common/models/FundedAwardModel';

describe('MobileMilestonesAwards', () => {
  const milestones: Array<ClaimedMilestoneModel> = [
    {name: 'Terraformer', playerName: undefined, color: undefined, scores: [{color: 'red', score: 20, claimable: false}]},
    {name: 'Mayor', playerName: 'Green', color: 'green', scores: [{color: 'green', score: 3, claimable: true}]},
  ];
  const awards: Array<FundedAwardModel> = [
    {name: 'Landlord', playerName: undefined, color: undefined, scores: [{color: 'red', score: 1}, {color: 'green', score: 4}]},
  ];

  function render(claimable: Array<string> = [], fundable: Array<string> = []) {
    return mount(MobileMilestonesAwards, {
      ...globalConfig,
      props: {milestones, awards, claimable, fundable},
    });
  }

  it('says what is left and what the next one costs', () => {
    const wrapper = render();
    expect(wrapper.find('[data-test="mobile-ma-milestone"]').text()).contains('2 left · 8 M€');
    expect(wrapper.find('[data-test="mobile-ma-award"]').text()).contains('3 left · 8 M€');
  });

  it('names who claimed a milestone, and shows the scores of the rest, best first for an award', () => {
    const rows = render().findAll('[data-test="mobile-ma-row"]');
    expect(rows[0].find('[data-test="mobile-ma-scores"]').exists()).is.true;
    expect(rows[1].find('[data-test="mobile-ma-owner"]').text()).contains('Green');
    expect(rows[2].find('[data-test="mobile-ma-scores"]').text()).match(/^4.*1$/s);
  });

  it('only the ones on offer take a tap, which asks to claim them', async () => {
    const wrapper = render(['Terraformer'], ['Landlord']);
    const rows = wrapper.findAll('[data-test="mobile-ma-row"]');
    expect(rows[1].attributes('disabled')).is.not.undefined;
    await rows[0].trigger('click');
    await rows[2].trigger('click');
    expect(wrapper.emitted('claim')).deep.eq([['milestone', 'Terraformer'], ['award', 'Landlord']]);
  });
});
