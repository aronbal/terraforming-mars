import {expect} from 'chai';
import {seedForMatch} from '../../src/server/tools/bot_tournament';
import {SeededRandom} from '../../src/common/utils/Random';

/**
 * Guards the benchmark tools' seeding.
 *
 * `SeededRandom` scales its seed back up by 2^32, so whole-number seeds all
 * collapse onto one internal state and deal identical games. That failure is
 * invisible from the outside — a hundred-game run still reports a hundred
 * games — so it is worth a test rather than a comment.
 */
describe('seedForMatch', () => {
  it('gives consecutive matches different shuffles', () => {
    const firstDraws = (seed: number) => {
      const random = new SeededRandom(seed);
      return [random.next(), random.next(), random.next()].join();
    };

    const streams = new Set([1, 2, 3, 4, 5].map((match) => firstDraws(seedForMatch(match))));

    expect(streams.size, 'matches were dealt from the same shuffle').to.eq(5);
  });

  it('stays inside the unit interval', () => {
    for (const match of [1, 7, 1000, 123456]) {
      const seed = seedForMatch(match);
      expect(seed).to.be.at.least(0);
      expect(seed).to.be.lessThan(1);
    }
  });
});
