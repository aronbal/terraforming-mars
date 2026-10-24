import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import MobileGameEnd from '@/client/components/mobile/MobileGameEnd.vue';
import {categories, chartPoints, chartStep, standings, winners} from '@/client/components/mobile/GameEnd';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

function player(name: string, color: Color, total: number, megacredits: number, fields: Record<string, number> = {}): PublicPlayerModel {
  return fakePublicPlayerModel({
    name,
    color,
    megacredits,
    victoryPointsByGeneration: [20, total],
    victoryPointsBreakdown: {
      terraformRating: 40, milestones: 0, awards: 0, greenery: 0, city: 0, victoryPoints: 0,
      escapeVelocity: 0, moonHabitats: 0, moonMines: 0, moonRoads: 0, planetaryTracks: 0,
      total, detailsCards: [], detailsMilestones: [], detailsAwards: [], detailsPlanetaryTracks: [], negativeVP: 0,
      ...fields,
    },
  });
}

describe('MobileGameEnd', () => {
  const green = player('Green', 'green', 80, 93, {milestones: 15, awards: 5, victoryPoints: 17});
  const aron = player('Aron', 'red', 78, 40, {awards: 10, city: 5});

  function render(players: Array<PublicPlayerModel>, myColor: Color | undefined = 'red') {
    const view = fakePlayerViewModel();
    return mount(MobileGameEnd, {
      ...globalConfig,
      props: {viewModel: {...view, game: {...view.game, generation: 2}, players}, myColor},
    });
  }

  it('ranks by points, then by M€, and shares first place on a full tie', () => {
    const tied = player('Tied', 'blue', 80, 93);
    expect(standings([aron, green]).map((p) => p.name)).deep.eq(['Green', 'Aron']);
    expect(standings([player('A', 'blue', 50, 1), player('B', 'pink', 50, 9)]).map((p) => p.name)).deep.eq(['B', 'A']);
    expect(winners([aron, green, tied]).map((p) => p.name)).deep.eq(['Green', 'Tied']);
  });

  it('compares every category someone scored in, with its leader and margin', () => {
    const byCategory = categories([green, aron]);
    expect(byCategory.map((c) => c.key)).deep.eq(['tr', 'milestones', 'awards', 'city', 'cards']);
    expect(byCategory[1]).deep.include({leader: 'green', margin: 15});
    expect(byCategory[2]).deep.include({leader: 'red', margin: 5});
    expect(byCategory[2].scores).deep.eq([{color: 'green', points: 5, leading: false}, {color: 'red', points: 10, leading: true}]);
    // Both on 40 TR: no one leads it.
    expect(byCategory[0]).deep.include({leader: undefined, margin: 0});
  });

  it('scales the chart to round steps', () => {
    expect(chartStep(18)).eq(5);
    expect(chartStep(80)).eq(20);
    expect(chartPoints([0, 10], 2, 10)).eq('28.0,138.0 292.0,10.0');
  });

  it('names the winner, or says the player won', () => {
    expect(render([aron, green]).find('[data-test="end-headline"]').text()).eq('Green won!');
    expect(render([aron, green], 'green').find('[data-test="end-headline"]').text()).eq('You won!');
  });

  it('shows each player\'s total, best first, and a tile per category', () => {
    const wrapper = render([aron, green]);
    const totals = wrapper.findAll('[data-test="end-total"]').map((t) => t.text());
    expect(totals).deep.eq(['80 VP', '78 VP']);
    const milestones = wrapper.find('[data-test="end-category-milestones"]');
    expect(milestones.find('[data-test="end-category-lead"]').text()).eq('+15');
    expect(milestones.find('[data-test="end-category-lead"]').classes()).contains('mobile-end-ink--green');
    expect(wrapper.find('[data-test="end-category-tr"] [data-test="end-category-lead"]').text()).eq('=');
    expect(wrapper.find('[data-test="end-chart"]').exists()).is.true;
  });

  it('links on to a new game and to the final board', () => {
    const wrapper = render([aron, green]);
    expect(wrapper.find('[data-test="end-new-game"]').attributes('href')).eq('new-game');
    expect(wrapper.find('[data-test="end-board"]').attributes('href')).contains('&noredirect');
  });
});
