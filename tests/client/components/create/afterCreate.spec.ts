import {expect} from 'chai';
import {onlyHumanPlayer} from '@/client/components/create/afterCreate';
import {PlayerId} from '@/common/Types';

describe('onlyHumanPlayer', () => {
  const created = {players: [{id: 'pred' as PlayerId, color: 'red'}, {id: 'pgreen' as PlayerId, color: 'green'}, {id: 'pblue' as PlayerId, color: 'blue'}]};

  it('goes straight to the one person playing against computers', () => {
    const seats = [{color: 'red', bot: 'hard'}, {color: 'green'}, {color: 'blue', bot: 'easy'}] as const;
    expect(onlyHumanPlayer(created, seats)).eq('pgreen');
  });

  it('leaves the links page for a game with other people in it', () => {
    const seats = [{color: 'red'}, {color: 'green'}, {color: 'blue', bot: 'easy'}] as const;
    expect(onlyHumanPlayer(created, seats)).is.undefined;
  });

  it('never picks a computer', () => {
    const seats = [{color: 'red', bot: 'hard'}, {color: 'green', bot: 'easy'}, {color: 'blue', bot: 'easy'}] as const;
    expect(onlyHumanPlayer(created, seats)).is.undefined;
  });
});
