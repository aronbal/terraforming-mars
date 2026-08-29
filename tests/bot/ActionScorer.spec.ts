import {expect} from 'chai';
import {testGame} from '../TestGame';
import {ActionScorer, PASS_SCORE} from '../../src/server/bot/evaluate/ActionScorer';
import {CardEvaluator} from '../../src/server/bot/evaluate/CardEvaluator';
import {Tempo, tempoOf} from '../../src/server/bot/evaluate/Values';
import {profileFor} from '../../src/server/bot/BotProfile';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {IPlayer} from '../../src/server/IPlayer';
import {TileType} from '../../src/common/TileType';

function scorerFor(player: IPlayer, tempo: Tempo): ActionScorer {
  const profile = profileFor('hard');
  return new ActionScorer(player, profile, tempo, new CardEvaluator(player, profile, tempo));
}

/** The action menu offers award funding as an annotated submenu. */
function awardMenu(): OrOptions {
  const menu = new OrOptions(new SelectOption('Landlord'), new SelectOption('Scientist'));
  menu.annotation = 'award';
  return menu;
}

describe('ActionScorer', () => {
  it('does not fund awards in the opening generation', () => {
    const [game, player] = testGame(2);

    // Nobody has played anything, so every award is tied at zero. Treating
    // that as a lead worth buying is how a bot burns its opening cash.
    const score = scorerFor(player, tempoOf(game)).score(awardMenu());

    expect(score).to.be.lessThan(PASS_SCORE);
  });

  it('funds an award it leads once the game is nearly over', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 40;
    // Give the player something every award-like counter can see.
    player.playedCards.push(...player.playedCards.asArray());

    const lateGame: Tempo = {progress: 0.95, remainingGenerations: 1, endgame: true};
    const score = scorerFor(player, lateGame).score(awardMenu());

    expect(score).to.be.greaterThan(PASS_SCORE);
  });

  it('will not spend on an award the opponent leads', () => {
    const [game, player, opponent] = testGame(2);
    const award = game.awards[0];
    // Put the opponent clearly ahead on this award.
    for (let i = 0; i < 6; i++) {
      game.board.spaces[i].tile = {tileType: TileType.GREENERY};
      game.board.spaces[i].player = opponent;
    }
    expect(award.getScore(opponent), 'test needs the opponent actually ahead')
      .to.be.greaterThan(award.getScore(player));

    const lateGame: Tempo = {progress: 0.95, remainingGenerations: 1, endgame: true};
    const scorer = scorerFor(player, lateGame);

    // The submenu entry for that specific award must be unattractive, or the
    // bot picks it and hands the opponent five points.
    expect(scorer.score(new SelectOption(award.name))).to.be.lessThan(PASS_SCORE);
  });

  it('picks the award it leads over the one it does not', () => {
    const [game, player, opponent] = testGame(2);
    const contested = game.awards[0];
    for (let i = 0; i < 6; i++) {
      game.board.spaces[i].tile = {tileType: TileType.GREENERY};
      game.board.spaces[i].player = opponent;
    }

    const lateGame: Tempo = {progress: 0.95, remainingGenerations: 1, endgame: true};
    const scorer = scorerFor(player, lateGame);

    const scores = game.awards.map((award) => scorer.score(new SelectOption(award.name)));
    const contestedScore = scores[game.awards.indexOf(contested)];
    expect(Math.max(...scores)).to.be.greaterThan(contestedScore);
  });

  it('always prefers claiming a milestone to passing', () => {
    const [/* game */, player] = testGame(2);
    const milestone = new OrOptions(new SelectOption('Terraformer'));
    milestone.annotation = 'milestone';

    // A milestone is only ever offered once its threshold is met, so it is a
    // real five points rather than a bet.
    expect(scorerFor(player, tempoOf(player.game)).score(milestone)).to.be.greaterThan(PASS_SCORE);
  });
});
