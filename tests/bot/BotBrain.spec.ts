import {expect} from 'chai';
import {testGame} from '../TestGame';
import {BotBrain} from '../../src/server/bot/BotBrain';
import {BotRandom} from '../../src/server/bot/BotRandom';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {SelectAmount} from '../../src/server/inputs/SelectAmount';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {SelectPlayer} from '../../src/server/inputs/SelectPlayer';
import {SelectProductionToLose} from '../../src/server/inputs/SelectProductionToLose';
import {UndoActionOption} from '../../src/server/inputs/UndoActionOption';
import {Resource} from '../../src/common/Resource';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';

/** Empty land beside a space, which is where greeneries can still go. */
function countOpenNeighbours(game: IGame, space: Space): number {
  return game.board.getAdjacentSpaces(space).filter((adjacent) => game.board.canPlaceTile(adjacent)).length;
}

describe('BotBrain', () => {
  it('answers a plain confirmation', () => {
    const [/* game */, player] = testGame(2);
    const brain = new BotBrain(player, 'hard', new BotRandom(1));

    expect(brain.respond(new SelectOption('Confirm'))).to.deep.eq({type: 'option'});
  });

  it('prefers doing something to passing', () => {
    const [/* game */, player] = testGame(2);
    const brain = new BotBrain(player, 'hard', new BotRandom(1));

    const pass = new SelectOption('Pass for this generation');
    pass.annotation = 'pass';
    const options = new OrOptions(pass, new SelectOption('Do something useful'));

    const response = brain.respond(options);
    expect(response).to.have.property('index', 1);
  });

  it('never chooses to undo', () => {
    const [/* game */, player] = testGame(2);
    const brain = new BotBrain(player, 'hard', new BotRandom(1));

    const pass = new SelectOption('Pass for this generation');
    pass.annotation = 'pass';
    const options = new OrOptions(new UndoActionOption(), pass);

    for (let attempt = 0; attempt < 20; attempt++) {
      expect(brain.respond(options)).to.have.property('index', 1);
    }
  });

  it('answers every branch of an and', () => {
    const [/* game */, player] = testGame(2);
    const brain = new BotBrain(player, 'hard', new BotRandom(1));

    const options = new AndOptions(new SelectOption('One'), new SelectAmount('How many', 'Save', 0, 4));
    const response = brain.respond(options);

    expect(response).to.have.property('type', 'and');
    expect((response as {responses: Array<unknown>}).responses).to.have.length(2);
  });

  it('picks a space that was offered', () => {
    const [game, player] = testGame(2);
    const spaces = game.board.getAvailableSpacesOnLand(player).slice(0, 5);
    const brain = new BotBrain(player, 'hard', new BotRandom(1));

    const response = brain.respond(new SelectSpace('Select space for greenery tile', spaces));

    expect(spaces.map((space) => space.id)).to.include((response as {spaceId: string}).spaceId);
  });

  it('plants beside its own city rather than beside the opponent\'s', () => {
    const [game, player, opponent] = testGame(2);
    const board = game.board;
    const open = board.getAvailableSpacesOnLand(player);
    const mine = open[0];
    // Somewhere far enough that the two cities share no neighbour.
    const theirs = open.find((space) =>
      board.getAdjacentSpaces(space).every((adjacent) =>
        adjacent.id !== mine.id &&
        board.getAdjacentSpaces(adjacent).every((next) => next.id !== mine.id)));
    if (theirs === undefined) {
      throw new Error('expected two spaces that share no neighbour');
    }
    game.addCity(player, mine);
    game.addCity(opponent, theirs);

    const besideMine = board.getAdjacentSpaces(mine).filter((space) => board.canPlaceTile(space));
    const besideTheirs = board.getAdjacentSpaces(theirs).filter((space) => board.canPlaceTile(space));
    const brain = new BotBrain(player, 'hard', new BotRandom(1));

    // A greenery scores its city's owner a point too, so where it goes decides
    // who gets the second point.
    const response = brain.respond(
      new SelectSpace('Select space for greenery tile', [...besideTheirs, ...besideMine]));

    expect(besideMine.map((space) => space.id)).to.include((response as {spaceId: string}).spaceId);
  });

  it('builds a city where there is room to grow forests', () => {
    const [game, player] = testGame(2);
    const board = game.board;
    player.production.override({plants: 3});

    const roomy = board.getAvailableSpacesForCity(player)
      .reduce((best, space) => countOpenNeighbours(game, space) > countOpenNeighbours(game, best) ? space : best);
    const boxedIn = board.getAvailableSpacesForCity(player)
      .reduce((worst, space) => countOpenNeighbours(game, space) < countOpenNeighbours(game, worst) ? space : worst);
    const brain = new BotBrain(player, 'hard', new BotRandom(1));

    const response = brain.respond(new SelectSpace('Select space for city tile', [boxedIn, roomy]));

    expect(countOpenNeighbours(game, roomy), 'the two spaces were equally roomy')
      .to.be.greaterThan(countOpenNeighbours(game, boxedIn));
    expect((response as {spaceId: string}).spaceId).to.eq(roomy.id);
  });

  it('aims player-targeting prompts at the opponent', () => {
    const [/* game */, player, opponent] = testGame(2);
    const brain = new BotBrain(player, 'hard', new BotRandom(1));

    const response = brain.respond(new SelectPlayer([player, opponent], 'Select player'));

    expect(response).to.have.property('player', opponent.color);
  });

  it('gives up its least valuable production', () => {
    const [/* game */, player] = testGame(2);
    player.production.add(Resource.ENERGY, 3);
    player.production.add(Resource.TITANIUM, 3);
    const brain = new BotBrain(player, 'hard', new BotRandom(1));

    const response = brain.respond(new SelectProductionToLose('Lose 2 production', 2, player));
    const units = (response as {units: Record<string, number>}).units;

    expect(units.energy, 'energy is the cheapest production to give up').to.eq(2);
    expect(units.titanium).to.eq(0);
  });

  it('keeps its opening hand within what the corporation can pay for', () => {
    const [/* game */, player] = testGame(2, {skipInitialCardSelection: false});
    player.bot = 'hard';
    const waitingFor = player.getWaitingFor();
    expect(waitingFor, 'expected an initial card selection').is.not.undefined;

    const brain = new BotBrain(player, 'hard', new BotRandom(1));
    player.process(brain.respond(waitingFor!));

    const corporation = player.pickedCorporationCard;
    expect(corporation, 'the bot should have chosen a corporation').is.not.undefined;
    const cardCost = corporation?.cardCost ?? player.cardCost;
    expect(player.cardsInHand.length * cardCost).to.be.at.most(corporation!.startingMegaCredits);
  });
});
