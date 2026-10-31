import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import MobileGameEnd from '@/client/components/mobile/MobileGameEnd.vue';
import {categories, chartPoints, chartStep, standings, winners} from '@/client/components/mobile/GameEnd';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';

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

  it('opens a card from its line of points, and puts it down with a tap', async () => {
    const scorer = player('Scorer', 'blue', 90, 10, {victoryPoints: 3});
    const withCards = {
      ...scorer,
      tableau: [{name: CardName.BIRDS, resources: 4}],
      victoryPointsBreakdown: {
        ...scorer.victoryPointsBreakdown,
        detailsCards: [
          {cardName: CardName.BIRDS, victoryPoint: 4},
          {cardName: 'Colony VP', victoryPoint: 2},
        ],
      },
    };
    const wrapper = render([withCards, aron]);

    // Only the card has a card to show; Colony VP is a line of points, nothing more.
    const lines = wrapper.findAll('[data-test="end-card-line"]');
    expect(lines).has.length(1);
    expect(lines[0].text()).contains('Birds');

    await lines[0].trigger('click');
    const shown = wrapper.find('[data-test="end-card"]');
    expect(shown.exists()).is.true;
    expect(shown.text()).contains('4 VP');
    expect(wrapper.vm.shown?.card).deep.eq({name: CardName.BIRDS, resources: 4});

    await shown.trigger('click');
    expect(wrapper.find('[data-test="end-card"]').exists()).is.false;
  });

  it('shows a card scored against a player from its owner\'s table, and names the owner', async () => {
    // Blue played Vermin and filled it; Aron pays for his cities without owning it.
    const owner = {...player('Blue', 'blue', 70, 10), tableau: [{name: CardName.VERMIN, resources: 11}]};
    const victim = {
      ...aron,
      victoryPointsBreakdown: {
        ...aron.victoryPointsBreakdown,
        detailsCards: [{cardName: CardName.VERMIN, victoryPoint: -5}],
      },
    };
    const wrapper = render([victim, owner]);

    const aronsLines = wrapper.findAll('[data-test="end-details"]')[0].findAll('[data-test="end-card-line"]');
    expect(aronsLines).has.length(1);
    await aronsLines[0].trigger('click');

    expect(wrapper.find('[data-test="end-card"]').text()).contains('-5 VP');
    expect(wrapper.vm.shown?.card).deep.eq({name: CardName.VERMIN, resources: 11});
    expect(wrapper.find('[data-test="end-card-owner"]').text()).contains('Blue\'s card');
  });

  it('does not name the owner of a player\'s own card', async () => {
    const scorer = player('Scorer', 'blue', 90, 10);
    const withCards = {
      ...scorer,
      tableau: [{name: CardName.VERMIN, resources: 11}],
      victoryPointsBreakdown: {
        ...scorer.victoryPointsBreakdown,
        detailsCards: [{cardName: CardName.VERMIN, victoryPoint: -3}],
      },
    };
    const wrapper = render([withCards, aron]);

    await wrapper.find('[data-test="end-card-line"]').trigger('click');
    expect(wrapper.vm.shown?.card).deep.eq({name: CardName.VERMIN, resources: 11});
    expect(wrapper.find('[data-test="end-card-owner"]').exists()).is.false;
  });

  it('opens a milestone or an award from its line, with its rule', async () => {
    const claimed = {
      ...green,
      victoryPointsBreakdown: {
        ...green.victoryPointsBreakdown,
        detailsMilestones: [{message: 'Claimed ${0} milestone', messageArgs: ['Terraformer'], victoryPoint: 5}],
        detailsAwards: [{message: '${0} place for ${1} award (funded by ${2})', messageArgs: ['1st', 'Banker', 'red'], victoryPoint: 5}],
      },
    };
    const view = fakePlayerViewModel();
    const wrapper = mount(MobileGameEnd, {
      ...globalConfig,
      props: {
        viewModel: {
          ...view,
          game: {
            ...view.game,
            generation: 2,
            milestones: [{name: 'Terraformer', playerName: 'Green', color: 'green', scores: []}],
            awards: [{name: 'Banker', playerName: 'Aron', color: 'red', scores: []}],
          },
          players: [claimed, aron],
        },
        myColor: 'red',
      },
    });

    const lines = wrapper.findAll('[data-test="end-medal-line"]');
    expect(lines).has.length(2);

    await lines[0].trigger('click');
    expect(wrapper.find('[data-test="medal-sheet"]').exists()).is.true;
    expect(wrapper.find('[data-test="medal-sheet-rule"]').text()).not.eq('');
    expect(wrapper.vm.medal).deep.eq({kind: 'milestone', name: 'Terraformer'});

    await wrapper.find('[data-test="medal-sheet-close"]').trigger('click');
    expect(wrapper.find('[data-test="medal-sheet"]').exists()).is.false;

    await lines[1].trigger('click');
    expect(wrapper.vm.medal).deep.eq({kind: 'award', name: 'Banker'});
  });
});
