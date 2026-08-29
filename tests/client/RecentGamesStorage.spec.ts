import {expect} from 'chai';
import {FakeLocalStorage} from './components/FakeLocalStorage';
import {forgetAllGames, forgetGame, getRecentGames, rememberGame} from '@/client/utils/RecentGamesStorage';

describe('RecentGamesStorage', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
  });

  it('starts empty', () => {
    expect(getRecentGames()).is.empty;
  });

  it('remembers a game', () => {
    rememberGame({id: 'p-player', kind: 'player', gameName: 'Ares', name: 'Aron', color: 'blue', generation: 3});

    const games = getRecentGames();
    expect(games).has.length(1);
    expect(games[0].id).eq('p-player');
    expect(games[0].gameName).eq('Ares');
    expect(games[0].name).eq('Aron');
    expect(games[0].color).eq('blue');
    expect(games[0].generation).eq(3);
    expect(games[0].lastSeenMs).is.a('number');
  });

  it('lists the most recently seen game first', () => {
    rememberGame({id: 'p-first', kind: 'player', gameName: 'Ares'});
    rememberGame({id: 'p-second', kind: 'player', gameName: 'Deimos'});

    expect(getRecentGames().map((game) => game.id)).deep.eq(['p-second', 'p-first']);
  });

  it('refreshes a game in place instead of duplicating it', () => {
    rememberGame({id: 'p-player', kind: 'player', gameName: 'Ares', generation: 3});
    rememberGame({id: 'p-player', kind: 'player', gameName: 'Ares', generation: 4});

    const games = getRecentGames();
    expect(games).has.length(1);
    expect(games[0].generation).eq(4);
  });

  it('caps the list', () => {
    for (let idx = 0; idx < 20; idx++) {
      rememberGame({id: `p-${idx}`, kind: 'player', gameName: 'Ares'});
    }

    const games = getRecentGames();
    expect(games).has.length(12);
    expect(games[0].id).eq('p-19');
  });

  it('drops games older than the retention window', () => {
    const ancient = Date.now() - (91 * 24 * 60 * 60 * 1000);
    localStorage.setItem('recentGames', JSON.stringify([
      {id: 'p-old', kind: 'player', gameName: 'Ares', lastSeenMs: ancient},
      {id: 'p-new', kind: 'player', gameName: 'Deimos', lastSeenMs: Date.now()},
    ]));

    expect(getRecentGames().map((game) => game.id)).deep.eq(['p-new']);
  });

  it('ignores malformed entries', () => {
    localStorage.setItem('recentGames', JSON.stringify([
      {id: 'p-good', kind: 'player', gameName: 'Ares', lastSeenMs: Date.now()},
      {id: 'p-no-kind', gameName: 'Ares', lastSeenMs: Date.now()},
      'not an entry',
    ]));

    expect(getRecentGames().map((game) => game.id)).deep.eq(['p-good']);
  });

  it('ignores unparseable storage', () => {
    localStorage.setItem('recentGames', 'not json');

    expect(getRecentGames()).is.empty;
  });

  it('forgets one game', () => {
    rememberGame({id: 'p-first', kind: 'player', gameName: 'Ares'});
    rememberGame({id: 'p-second', kind: 'player', gameName: 'Deimos'});

    forgetGame('p-first');

    expect(getRecentGames().map((game) => game.id)).deep.eq(['p-second']);
  });

  it('forgets every game', () => {
    rememberGame({id: 'p-first', kind: 'player', gameName: 'Ares'});
    rememberGame({id: 's-spectator', kind: 'spectator', gameName: 'Deimos'});

    forgetAllGames();

    expect(getRecentGames()).is.empty;
  });
});
