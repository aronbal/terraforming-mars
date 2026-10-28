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
import {Attention} from '../../src/server/bot/Attention';
import {BotRandom} from '../../src/server/bot/BotRandom';
import {NEUTRAL_PERSONALITY} from '../../src/server/bot/BotPersonality';
import {SelectProjectCardToPlay} from '../../src/server/inputs/SelectProjectCardToPlay';
import {SelectCardToPlay} from '../../src/server/inputs/SelectCardToPlay';
import {PlayableCard} from '../../src/server/bot/CardPayment';
import {PowerPlant} from '../../src/server/cards/base/PowerPlant';
import {Mine} from '../../src/server/cards/base/Mine';
import {MicroMills} from '../../src/server/cards/base/MicroMills';
import {BuildingIndustries} from '../../src/server/cards/base/BuildingIndustries';
import {SolarWindPower} from '../../src/server/cards/base/SolarWindPower';

function scorerFor(player: IPlayer, tempo: Tempo, attention: Attention = Attention.FULL): ActionScorer {
  const profile = profileFor('hard');
  return new ActionScorer(player, profile, tempo, new CardEvaluator(player, profile, tempo), NEUTRAL_PERSONALITY, attention);
}

/** A play-a-card menu of cheap cards the player can pay for. */
function cardMenu(player: IPlayer): SelectCardToPlay<PlayableCard> {
  player.megaCredits = 100;
  const menu = new SelectProjectCardToPlay(player, [
    new PowerPlant(), new Mine(), new MicroMills(), new BuildingIndustries(), new SolarWindPower(),
  ]);
  // The bot reads every play-a-card menu this way; see `BotBrain.respond`.
  return menu as SelectCardToPlay<PlayableCard>;
}

function namesOf(entries: ReadonlyArray<{card: {name: string}}>): Array<string> {
  return entries.map((entry) => entry.card.name);
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

  it('weighs every card it can pay for at full attention', () => {
    const [game, player] = testGame(2);
    const menu = cardMenu(player);

    const considered = scorerFor(player, tempoOf(game)).consideredCards(menu);

    expect(namesOf(considered)).to.have.members(menu.cards.map((card) => card.name));
  });

  it('overlooks some cards when it is not paying attention', () => {
    const [game, player] = testGame(2);
    const menu = cardMenu(player);

    const sizes: Array<number> = [];
    for (let seed = 1; seed <= 20; seed++) {
      const scorer = scorerFor(player, tempoOf(game), new Attention(0.6, new BotRandom(seed)));
      sizes.push(scorer.consideredCards(menu).length);
    }

    expect(Math.min(...sizes)).to.be.lessThan(menu.cards.length);
    expect(Math.min(...sizes)).to.be.at.least(1);
  });

  it('still sees its best card when it would overlook them all', () => {
    const [game, player] = testGame(2);
    const menu = cardMenu(player);
    const best = scorerFor(player, tempoOf(game)).consideredCards(menu)
      .reduce((a, b) => b.value > a.value ? b : a);

    const considered = scorerFor(player, tempoOf(game), new Attention(0, new BotRandom(1))).consideredCards(menu);

    expect(namesOf(considered)).to.deep.eq([best.card.name]);
  });

  it('scores the card menu by the same cards it then chooses from', () => {
    const [game, player] = testGame(2);
    const menu = cardMenu(player);

    for (let seed = 1; seed <= 20; seed++) {
      const scorer = scorerFor(player, tempoOf(game), new Attention(0.5, new BotRandom(seed)));
      const score = scorer.bestPlayableCardScore(menu);
      const considered = scorer.consideredCards(menu);

      expect(Math.max(...considered.map((entry) => entry.value))).to.eq(score);
      expect(namesOf(scorer.consideredCards(menu))).to.deep.eq(namesOf(considered));
    }
  });
});
