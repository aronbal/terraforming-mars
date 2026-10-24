import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileTurnPage from '@/client/components/mobile/MobileTurnPage.vue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import {CardName} from '@/common/cards/CardName';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {LogEvent} from '@/client/components/mobile/MobileLog';
import {cardList, menu, namedChoices, option, projectCard} from './menuFixtures';

describe('MobileTurnPage', () => {
  function event(n: number): LogEvent {
    return {key: 'e' + n, generation: 5, title: 'Played Comet', color: 'red', icon: 'layers', timestamp: 0, private: false, effects: undefined, cards: []};
  }

  function mount(waitingFor: PlayerInputModel | undefined, player: Record<string, unknown> = {}, recent: Array<LogEvent> = []) {
    return shallowMount(MobileTurnPage, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel({
          waitingFor,
          thisPlayer: fakePublicPlayerModel({heat: 12, plants: 5, plantsNeededForGreenery: 8, ...player}),
        } as never),
        recent,
        players: [{color: 'red', name: 'Mette'}],
        now: 0,
      },
    });
  }

  function fullMenu(): PlayerInputModel {
    return menu(
      option('Convert 8 heat into temperature', 'convertHeat'),
      cardList('actionCard', [CardName.SPACE_ELEVATOR], {action: true}),
      projectCard(CardName.ANTS),
      namedChoices('award', {message: 'Fund an award (${0} M€)', data: [{type: 1, value: '8'}]} as never, 'Landlord'),
      cardList('standardProject', [CardName.AQUIFER_STANDARD_PROJECT, CardName.CITY_STANDARD_PROJECT], {disabled: [CardName.CITY_STANDARD_PROJECT]}),
      option('Pass for this generation', 'pass'),
      option('Sell patents', 'sellPatents'),
      option('Summon the worm', 'rideTheSandworm'));
  }

  it('mounts without errors', () => {
    expect(mount(fullMenu()).exists()).is.true;
  });

  it('puts every playable card and usable action in the ready row', () => {
    const wrapper = mount(fullMenu());
    const cards = wrapper.findAll('[data-test="ready-card"]');
    expect(cards).has.length(2);
    expect(cards[0].text()).contains('Play · 9 M€');
    expect(cards[1].text()).contains('Use');
  });

  it('selects a ready card on tap', async () => {
    const wrapper = mount(fullMenu());
    await wrapper.find('[data-test="ready-card"]').trigger('click');
    expect(wrapper.emitted('select')).deep.eq([[CardName.ANTS]]);
  });

  it('says why a tile cannot be used, and dims it', () => {
    const wrapper = mount(fullMenu());
    const tiles = wrapper.vm.tiles;
    expect(tiles.find((tile) => tile.key === 'heat')).deep.include({usable: true, subtitle: '8 of 12 heat'});
    expect(tiles.find((tile) => tile.key === 'greenery')).deep.include({usable: false, subtitle: 'Needs 8 · 5 plants'});
    expect(wrapper.find('[data-test="tile-greenery"]').attributes('disabled')).is.not.undefined;
  });

  it('counts the standard projects the player can afford', () => {
    expect(mount(fullMenu()).vm.tiles.find((tile) => tile.key === 'projects')?.subtitle).eq('1 option');
  });

  // The server sends the standard projects as cards to pay for.
  it('counts them the same when they come as project cards', () => {
    const projects = {...projectCard(CardName.POWER_PLANT_STANDARD_PROJECT, CardName.ASTEROID_STANDARD_PROJECT), annotation: 'standardProject'};
    const tile = mount(menu(projects)).vm.tiles.find((each) => each.key === 'projects');
    expect(tile).deep.include({usable: true, subtitle: '2 options'});
  });

  it('reads the award price out of the entry', () => {
    expect(mount(fullMenu()).vm.tiles.find((tile) => tile.key === 'board')?.subtitle).eq('Award from 8 M€');
  });

  it('a tile opens the entry it stands for', async () => {
    const wrapper = mount(fullMenu());
    await wrapper.find('[data-test="tile-heat"]').trigger('click');
    expect(wrapper.emitted('openEntry')).deep.eq([[0]]);
  });

  it('Milestones & awards goes to the board instead', async () => {
    const wrapper = mount(fullMenu());
    await wrapper.find('[data-test="tile-board"]').trigger('click');
    expect(wrapper.emitted('openMilestones')).has.length(1);
  });

  it('passing and selling patents are buttons for their entries', async () => {
    const wrapper = mount(fullMenu());
    await wrapper.find('[data-test="pass"]').trigger('click');
    await wrapper.find('[data-test="sell-patents"]').trigger('click');
    expect(wrapper.emitted('openEntry')).deep.eq([[5], [6]]);
    expect(wrapper.find('[data-test="end-turn"]').exists()).is.false;
  });

  it('lists the entries it draws nothing for, so none goes missing', () => {
    const others = mount(fullMenu()).findAll('[data-test="other-action"]');
    expect(others).has.length(1);
    expect(others[0].text()).contains('Summon the worm');
  });

  it('shows the three newest things that happened since the last turn', () => {
    const wrapper = mount(fullMenu(), {}, [event(1), event(2), event(3), event(4)]);
    expect(wrapper.vm.recentEvents.map((each) => each.key)).deep.eq(['e1', 'e2', 'e3']);
  });

  it('passes on a tap on a row that names cards', () => {
    const comet = {...event(1), cards: [CardName.COMET]};
    const wrapper = mount(fullMenu(), {}, [comet]);
    wrapper.findComponent({name: 'MobileLogRow'}).vm.$emit('inspect', comet);
    expect(wrapper.emitted('inspect')).deep.eq([[comet]]);
  });

  it('says whose turn it is when it is not this player\'s', () => {
    const wrapper = mount(undefined);
    expect(wrapper.find('[data-test="turn-waiting"]').exists()).is.true;
    expect(wrapper.find('[data-test="ready-now"]').exists()).is.false;
    expect(wrapper.find('[data-test="tile-heat"]').attributes('disabled')).is.not.undefined;
  });

  it('offers the way back to a question the sheet is asking', async () => {
    const wrapper = mount(option('Pay 3 M€?'));
    await wrapper.find('[data-test="turn-question"]').trigger('click');
    expect(wrapper.emitted('openSheet')).has.length(1);
  });
});
