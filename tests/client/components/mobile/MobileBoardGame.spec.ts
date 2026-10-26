import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import {FakeLocalStorage} from '../FakeLocalStorage';
import MobileBoardGame from '@/client/components/mobile/MobileBoardGame.vue';
import {BoardZoom} from '@/client/components/mobile/BoardGame';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {FundedAwardModel} from '@/common/models/FundedAwardModel';

describe('MobileBoardGame', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    PreferencesManager.resetForTest();
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
    PreferencesManager.resetForTest();
  });

  const milestones: Array<ClaimedMilestoneModel> = [
    {name: 'Terraformer', playerName: undefined, color: undefined, scores: [{color: 'red', score: 20, claimable: false}, {color: 'green', score: 23, claimable: false}]},
    {name: 'Mayor', playerName: 'Green', color: 'green', scores: [{color: 'green', score: 3, claimable: true}]},
    {name: 'Builder', playerName: undefined, color: undefined, scores: []},
  ];
  const awards: Array<FundedAwardModel> = [
    {name: 'Landlord', playerName: 'Red', color: 'red', scores: [{color: 'red', score: 4}, {color: 'green', score: 1}]},
    {name: 'Banker', playerName: undefined, color: undefined, scores: [{color: 'red', score: 2}, {color: 'green', score: 5}]},
  ];

  function render(options: {part?: BoardZoom, claimable?: Array<string>, fundable?: Array<string>} = {}) {
    const red = fakePublicPlayerModel({color: 'red', name: 'Red', terraformRating: 23});
    const green = fakePublicPlayerModel({color: 'green', name: 'Green', terraformRating: 20});
    const blue = fakePublicPlayerModel({color: 'blue', name: 'Blue', terraformRating: 20});
    const playerView = fakePlayerViewModel({thisPlayer: red, players: [red, green, blue]} as never);
    playerView.game.milestones = milestones;
    playerView.game.awards = awards;
    return mount(MobileBoardGame, {
      ...globalConfig,
      props: {
        playerView,
        part: options.part ?? 'overview',
        claimable: options.claimable ?? [],
        fundable: options.fundable ?? [],
      },
    });
  }

  it('puts a marker for every player on their rating', () => {
    const markers = render().findAll('[data-test="track-marker"]');
    expect(markers.map((marker) => [marker.attributes('aria-label'), marker.attributes('data-step')])).deep.eq([
      ['Red · 23', '23'],
      ['Green · 20', '20'],
      ['Blue · 20', '20'],
    ]);
  });

  it('sets markers that share a step side by side, so both stay in view', () => {
    const [, green, blue] = render().findAll('[data-test="track-marker"]');
    // Step 20 is on the left edge, so the second marker sits further right.
    expect(green.attributes('style')).contains('+ 0px');
    expect(blue.attributes('style')).contains('+ 14px');
    expect(blue.attributes('style')).contains('z-index: 11');
  });

  it('prints the colour-blind symbol on a marker when asked for', () => {
    expect(render().find('[data-test="track-marker"]').text()).eq('');
    PreferencesManager.INSTANCE.set('symbol_overlay', true);
    expect(render().find('[data-test="track-marker"]').text()).eq('▲');
  });

  it('marks every fifth step of the track', () => {
    const steps = render().findAll('.mobile-bg-step');
    expect(steps).has.length(100);
    expect(steps.filter((step) => step.classes('mobile-bg-step--five')).map((step) => step.text())).has.length(20);
    expect(steps[25].classes()).contains('mobile-bg-step--five');
    expect(steps[26].classes()).not.contains('mobile-bg-step--five');
  });

  it('says who is where when the track or a marker is tapped', async () => {
    const wrapper = render();
    expect(wrapper.findComponent({name: 'MobileTrackSheet'}).exists()).is.false;
    await wrapper.find('[data-test="track-marker"]').trigger('click');
    const sheet = wrapper.findComponent({name: 'MobileTrackSheet'});
    expect(sheet.props('you')).eq('red');
    sheet.vm.$emit('close');
    await wrapper.vm.$nextTick();
    await wrapper.find('.mobile-bg-step').trigger('click');
    expect(wrapper.findComponent({name: 'MobileTrackSheet'}).exists()).is.true;
  });

  it('puts the cube of who claimed or funded it on the medal', () => {
    const wrapper = render();
    const cubes = (kind: string) => wrapper.find(`[data-test="board-game-${kind}"]`).findAll('[data-test="board-game-medal"]')
      .map((medal) => medal.find('[data-test="board-game-cube"]').exists() ? medal.find('[data-test="board-game-cube"]').classes().find((each: string) => each.startsWith('board-cube--')) : undefined);
    expect(cubes('milestone')).deep.eq([undefined, 'board-cube--green', undefined]);
    expect(cubes('award')).deep.eq(['board-cube--red', undefined]);
  });

  it('marks the prices already spent, and the next one', () => {
    const wrapper = render();
    const costs = (kind: string) => wrapper.find(`[data-test="board-game-${kind}"]`).findAll('[data-test="board-game-cost"]')
      .map((cost) => `${cost.text()}${cost.classes('mobile-bg-coin--used') ? ' used' : ''}${cost.classes('mobile-bg-coin--next') ? ' next' : ''}`);
    expect(costs('milestone')).deep.eq(['8 used', '8 next', '8']);
    expect(costs('award')).deep.eq(['8 used', '14 next', '20']);
  });

  it('zooms a panel in on a tap, and out with Back or a tap beside it', async () => {
    const wrapper = render();
    await wrapper.find('[data-test="board-game-award"]').trigger('click');
    expect(wrapper.emitted('zoomTo')).deep.eq([['awards']]);

    const zoomed = render({part: 'awards'});
    expect(zoomed.findAll('[data-test="board-game-row"]')).has.length(2);
    await zoomed.find('[data-test="board-game-back"]').trigger('click');
    await zoomed.find('[data-test="board-game-scrim"]').trigger('click');
    expect(zoomed.emitted('zoomTo')).deep.eq([['overview'], ['overview']]);
  });

  it('shows the scores best first in a zoomed panel, and which ones the turn offers', () => {
    const wrapper = render({part: 'awards', fundable: ['Banker']});
    const [landlord, banker] = wrapper.findAll('[data-test="board-game-row"]');
    expect(banker.text()).match(/5.*2/s);
    expect(banker.find('[data-test="board-game-offer"]').text()).eq('Fund');
    expect(landlord.find('[data-test="board-game-offer"]').exists()).is.false;
  });

  it('a medal tapped offers Claim only when the turn does, and hands it on to the claim sheet', async () => {
    const wrapper = render({part: 'milestones', claimable: ['Builder']});
    const rows = wrapper.findAll('[data-test="board-game-row"]');

    await rows[0].trigger('click');
    let sheet = wrapper.findComponent({name: 'MobileMedalSheet'});
    expect(sheet.props('name')).eq('Terraformer');
    expect(sheet.props('offered')).is.false;
    expect(sheet.find('[data-test="medal-sheet-claim"]').exists()).is.false;
    sheet.vm.$emit('close');
    await wrapper.vm.$nextTick();

    await rows[2].trigger('click');
    sheet = wrapper.findComponent({name: 'MobileMedalSheet'});
    expect(sheet.props('offered')).is.true;
    await sheet.find('[data-test="medal-sheet-claim"]').trigger('click');
    expect(wrapper.emitted('claim')).deep.eq([['milestone', 'Builder']]);
    expect(wrapper.findComponent({name: 'MobileMedalSheet'}).exists()).is.false;
  });
});
