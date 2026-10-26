import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel} from '../testHelpers';
import MobileUnitsSheet from '@/client/components/mobile/MobileUnitsSheet.vue';
import {unitsFor} from '@/client/components/mobile/UnitsSheet';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {Units} from '@/common/Units';
import {option} from './menuFixtures';

describe('MobileUnitsSheet', () => {
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

  const amount = (title: string, max: number): PlayerInputModel => ({type: 'amount', title, buttonLabel: 'Save', min: 0, max, maxByDefault: false});
  const spread = (): PlayerInputModel => ({type: 'and', title: 'Spread 3 microbes', buttonLabel: 'Save', options: [amount('Decomposers', 3), amount('Tardigrades', 3)]});
  const resources = (count: number): PlayerInputModel => ({type: 'resources', title: 'Gain 3 standard resources', buttonLabel: 'Select', count});
  const production = (): PlayerInputModel => ({
    type: 'productionToLose',
    title: 'Choose 2 unit(s) of production to lose',
    buttonLabel: 'Save',
    payProduction: {cost: 2, units: {...Units.EMPTY, megacredits: -5, steel: 1, energy: 2}},
  });

  function render(waitingFor: PlayerInputModel, entry?: number) {
    return mount(MobileUnitsSheet, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel({waitingFor} as never), entry},
    });
  }

  async function tapMore(wrapper: ReturnType<typeof render>, row: number, times = 1) {
    for (let i = 0; i < times; i++) {
      await wrapper.findAll('[data-test="units-sheet-more"]')[row].trigger('click');
    }
  }

  it('is only an and made entirely of numbers', () => {
    expect(unitsFor(spread())).is.not.undefined;
    expect(unitsFor({type: 'and', title: '', buttonLabel: 'Save', options: [amount('Heat', 2), option('Skip')]})).is.undefined;
  });

  it('sends one number per row of an and', async () => {
    const wrapper = render(spread());
    expect(wrapper.findAll('[data-test="units-sheet-row"]')).has.length(2);
    await tapMore(wrapper, 0, 2);
    await tapMore(wrapper, 1);
    await wrapper.find('[data-test="units-sheet-submit"]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'and', responses: [{type: 'amount', amount: 2}, {type: 'amount', amount: 1}]});
  });

  it('waits for the resources to add up to the count, and goes no further', async () => {
    const wrapper = render(resources(3));
    const submit = () => wrapper.find('[data-test="units-sheet-submit"]');
    expect(submit().attributes('disabled')).is.not.undefined;
    await tapMore(wrapper, 0, 2);
    await tapMore(wrapper, 3, 2);
    expect(wrapper.find('[data-test="units-sheet-total"]').text()).contains('3 / 3');
    expect(wrapper.findAll('[data-test="units-sheet-value"]').map((value) => value.text())).deep.eq(['2', '0', '0', '1', '0', '0']);
    await submit().trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'resources', units: {megacredits: 2, steel: 0, titanium: 0, plants: 1, energy: 0, heat: 0}});
  });

  it('offers only the production that can be lost, M€ down to -5', () => {
    const rows = unitsFor(production())?.rows ?? [];
    expect(rows.map((row) => [row.resource, row.max])).deep.eq([['steel', 1], ['energy', 2]]);
  });

  it('answers an option of a choice as that option', async () => {
    const choice: PlayerInputModel = {type: 'or', title: 'Select one option', buttonLabel: 'OK', options: [option('Skip'), production()]};
    const wrapper = render(choice, 1);
    expect(wrapper.find('[data-test="units-sheet-cancel"]').exists()).is.true;
    await tapMore(wrapper, 1, 2);
    await wrapper.find('[data-test="units-sheet-submit"]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'or', index: 1, response: {type: 'productionToLose', units: {...Units.EMPTY, energy: 2}}});
  });
});
