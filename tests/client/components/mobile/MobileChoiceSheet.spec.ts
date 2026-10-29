import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import MobileChoiceSheet from '@/client/components/mobile/MobileChoiceSheet.vue';
import {boardRuleIn, choiceInput, nestedKind, playerChoiceInput} from '@/client/components/mobile/ChoiceSheet';
import {CardName} from '@/common/cards/CardName';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {OrOptionsModel, PlayerInputModel, SelectPlayerModel} from '@/common/models/PlayerInputModel';
import {cardChoice, menu, option} from './menuFixtures';

describe('MobileChoiceSheet', () => {
  let posted: Array<unknown>;
  let realFetch: typeof global.fetch;

  beforeEach(() => {
    posted = [];
    realFetch = global.fetch;
    global.fetch = (async (_url: string, options: {body: string}) => {
      posted.push(JSON.parse(options.body));
      return {ok: true, status: 200, json: async () => fakePlayerViewModel()};
    }) as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  function plants(fields: Partial<OrOptionsModel> = {}): OrOptionsModel {
    return {
      type: 'or',
      title: 'Select player to remove up to 3 plants',
      buttonLabel: 'Confirm',
      options: [
        {...option('Remove 3 plants from Green'), buttonLabel: 'Remove plants'},
        {...option('Remove 3 plants from Yellow'), buttonLabel: 'Remove plants'},
        {...option('Skip removing plants'), buttonLabel: 'Skip'},
      ],
      ...fields,
    };
  }

  function render(waitingFor: PlayerInputModel) {
    return mount(MobileChoiceSheet, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel({waitingFor} as never)},
    });
  }

  function discardOrSkip(): OrOptionsModel {
    return {...plants(), options: [{...cardChoice([CardName.ANTS]), title: 'Select a card to discard', buttonLabel: 'Discard'}, option('Do not discard a card')]} as OrOptionsModel;
  }

  it('takes a choice between options it or another sheet can answer, and never the turn\'s menu', () => {
    expect(choiceInput(plants())).is.not.undefined;
    expect(choiceInput(menu(option('Pass for this generation', 'pass'), option('Sell patents', 'sellPatents')))).is.undefined;
    const amount = {...plants(), options: [option('Skip'), {type: 'amount', title: 'How many', buttonLabel: 'OK', min: 0, max: 3, maxByDefault: false}]} as OrOptionsModel;
    expect(choiceInput(amount)).is.not.undefined;
    expect(choiceInput(discardOrSkip())).is.not.undefined;
    const space = {...plants(), options: [option('Skip'), {type: 'space', title: 'Where', buttonLabel: 'OK', spaces: []}]} as unknown as OrOptionsModel;
    expect(choiceInput(space)).is.not.undefined;
    expect(nestedKind(space.options[1])).eq('space');
    const event = {...plants(), options: [option('Skip'), {type: 'globalEvent', title: 'Which', buttonLabel: 'OK', globalEventNames: []}]} as unknown as OrOptionsModel;
    expect(choiceInput(event)).is.undefined;
  });

  it('hands a resource or a delegate to the pick sheet, and numbers to the units sheet', () => {
    expect(nestedKind({type: 'resource', title: 'Gain 1 standard resource', buttonLabel: 'Select', include: ['steel']})).eq('pick');
    expect(nestedKind({type: 'delegate', title: 'Remove', buttonLabel: 'Remove', players: ['NEUTRAL']})).eq('pick');
    expect(nestedKind({type: 'resources', title: 'Gain 2', buttonLabel: 'Select', count: 2})).eq('units');
    const amount = {type: 'amount', title: 'Heat', buttonLabel: 'OK', min: 0, max: 3, maxByDefault: false} as const;
    expect(nestedKind({type: 'and', title: '', buttonLabel: 'OK', options: [amount, amount]})).eq('units');
    expect(nestedKind({type: 'and', title: '', buttonLabel: 'OK', options: [amount, option('Skip')]})).is.undefined;
  });

  it('takes back the action that asked it, where the server allows it', async () => {
    const requested: Array<string> = [];
    global.fetch = (async (url: string) => {
      requested.push(url);
      return {ok: true, status: 200, json: async () => fakePlayerViewModel()};
    }) as unknown as typeof global.fetch;
    const wrapper = mount(MobileChoiceSheet, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel({id: 'p-blue-id', canCancelAction: true, waitingFor: plants()} as never)},
    });
    const cancel = wrapper.find('[data-test=choice-sheet-cancel]');
    expect(cancel.text()).eq('Cancel');
    await cancel.trigger('click');
    await flushPromises();
    expect(requested).deep.eq(['api/cancelaction?id=p-blue-id']);
  });

  it('hands an option that is a question of its own on to its sheet', async () => {
    const wrapper = render(discardOrSkip());
    const rows = wrapper.findAll('[data-test=choice-sheet-option]');
    expect(rows[0].text()).eq('Select a card to discard');
    expect(wrapper.find('[data-test=choice-sheet-submit]').text()).eq('Continue');
    await wrapper.find('[data-test=choice-sheet-submit]').trigger('click');
    expect(wrapper.emitted('next')).deep.eq([[{kind: 'card', index: 0}]]);
    expect(posted).is.empty;

    await rows[1].trigger('click');
    expect(wrapper.find('[data-test=choice-sheet-submit]').text()).eq('Confirm');
    await wrapper.find('[data-test=choice-sheet-submit]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'or', index: 1, response: {type: 'option'}});
  });

  describe('a player to choose', () => {
    function whichPlayer(): SelectPlayerModel {
      return {type: 'player', title: 'Select player to decrease heat production 1 step', buttonLabel: 'Decrease', players: ['green', 'yellow']};
    }

    function renderPlayers() {
      const players = [fakePublicPlayerModel({color: 'green', name: 'Green'}), fakePublicPlayerModel({color: 'yellow', name: 'Yellow'})];
      return mount(MobileChoiceSheet, {
        ...globalConfig,
        props: {playerView: fakePlayerViewModel({waitingFor: whichPlayer(), players} as never)},
      });
    }

    it('is a row per player, by colour and name', () => {
      expect(playerChoiceInput(whichPlayer())).is.not.undefined;
      const rows = renderPlayers().findAll('[data-test=choice-sheet-player]');
      expect(rows.map((row) => row.text())).deep.eq(['Green', 'Yellow']);
      expect(rows[1].find('.mobile-choice-standing-dot').classes()).contains('player_bg_color_yellow');
    });

    it('sends the chosen player from the question\'s own button', async () => {
      const wrapper = renderPlayers();
      await wrapper.findAll('[data-test=choice-sheet-player]')[1].trigger('click');
      const submit = wrapper.find('[data-test=choice-sheet-submit]');
      expect(submit.text()).eq('Decrease');
      await submit.trigger('click');
      await flushPromises();
      expect(posted[0]).deep.include({type: 'player', player: 'yellow'});
      expect(wrapper.emitted('close')).has.length(1);
    });
  });

  it('starts on the server\'s default, and a tap only moves the choice', async () => {
    const wrapper = render(plants({initialIdx: 2}));
    const rows = wrapper.findAll('[data-test=choice-sheet-option]');
    expect(rows[2].attributes('aria-checked')).eq('true');
    await rows[1].trigger('click');
    expect(rows[1].attributes('aria-checked')).eq('true');
    expect(posted).is.empty;
    expect(wrapper.find('[data-test=choice-sheet-submit]').text()).eq('Remove plants');
  });

  it('sends the chosen option from the button at the bottom', async () => {
    const wrapper = render(plants());
    await wrapper.findAll('[data-test=choice-sheet-option]')[1].trigger('click');
    await wrapper.find('[data-test=choice-sheet-submit]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'or', index: 1, response: {type: 'option'}});
    expect(wrapper.emitted('close')).has.length(1);
  });

  it('closes when the question is not a plain choice', () => {
    expect(render(option('Pay 3 M€?')).emitted('close')).has.length(1);
  });

  function fund(award: string, scores: string): PlayerInputModel {
    return {
      type: 'option',
      title: {message: 'Fund ${0} award [${1}]', data: [{type: LogMessageDataType.AWARD, value: award}, {type: LogMessageDataType.STRING, value: scores}]},
      buttonLabel: 'Confirm',
    } as PlayerInputModel;
  }

  it('reads an award option as its name, its rule and everyone\'s score', () => {
    const players = [{name: 'Aron Balschmidt', color: 'red'}, {name: 'Green', color: 'green'}] as const;
    expect(boardRuleIn(fund('Cultivator', 'Aron Balschmidt: 2 / Green: 0'), players)).deep.eq({
      kind: 'award',
      name: 'Cultivator',
      description: 'Own the most greenery tiles',
      standings: [{name: 'Aron Balschmidt', color: 'red', score: 2}, {name: 'Green', color: 'green', score: 0}],
    });
    expect(boardRuleIn(option('Do nothing'), players)).is.undefined;
  });

  it('shows the rule of the chosen award only', async () => {
    const wrapper = render({type: 'or', title: 'Select award to put into play and fund', buttonLabel: 'Confirm',
      options: [fund('Cultivator', 'Green: 0'), fund('Celebrity', 'Green: 0'), option('Do nothing')]} as OrOptionsModel);
    expect(wrapper.findAll('[data-test=choice-sheet-rule]')).has.length(2);
    expect(wrapper.findAll('[data-test=choice-sheet-rule-text]')).has.length(1);
    expect(wrapper.find('[data-test=choice-sheet-rule-text]').text()).contains('Own the most greenery tiles');
    await wrapper.findAll('[data-test=choice-sheet-option]')[1].trigger('click');
    expect(wrapper.find('[data-test=choice-sheet-rule-text]').text()).contains('at least 20 M€');
  });

  it('pays a second place only with more than two players', () => {
    const question = {type: 'or', title: 'Select award to put into play and fund', buttonLabel: 'Confirm',
      options: [fund('Cultivator', 'Green: 0'), option('Do nothing')]} as OrOptionsModel;
    const withPlayers = (count: number) => mount(MobileChoiceSheet, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel({waitingFor: question, players: Array.from({length: count}, () => fakePublicPlayerModel())} as never)},
    }).find('[data-test=choice-sheet-rule-text]').text();
    expect(withPlayers(2)).contains('1st 5 VP at the end').and.not.contains('2nd');
    expect(withPlayers(3)).contains('2nd 2 VP');
  });
});
