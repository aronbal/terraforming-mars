import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel} from '../testHelpers';
import MobileChoiceSheet from '@/client/components/mobile/MobileChoiceSheet.vue';
import {boardRuleIn, choiceInput} from '@/client/components/mobile/ChoiceSheet';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {menu, option} from './menuFixtures';

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

  it('takes only a choice between plain options, and never the turn\'s menu', () => {
    expect(choiceInput(plants())).is.not.undefined;
    expect(choiceInput(menu(option('Pass for this generation', 'pass'), option('Sell patents', 'sellPatents')))).is.undefined;
    const nested = {...plants(), options: [option('Skip'), {type: 'amount', title: 'How many', buttonLabel: 'OK', min: 0, max: 3, maxByDefault: false}]} as OrOptionsModel;
    expect(choiceInput(nested)).is.undefined;
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
});
