import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import MobilePickSheet from '@/client/components/mobile/MobilePickSheet.vue';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {option} from './menuFixtures';

describe('MobilePickSheet', () => {
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

  const resource = (): PlayerInputModel => ({type: 'resource', title: 'Gain 1 standard resource', buttonLabel: 'Select', include: ['megacredits', 'steel', 'plants']});
  const delegate = (): PlayerInputModel => ({type: 'delegate', title: 'Select which delegate to remove', buttonLabel: 'Remove delegate', players: ['green', 'NEUTRAL']});

  function render(waitingFor: PlayerInputModel, entry?: number) {
    const green = fakePublicPlayerModel({color: 'green', name: 'Greta'});
    return mount(MobilePickSheet, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel({waitingFor, players: [green]} as never), entry},
    });
  }

  it('sends the resource chosen, and nothing before one is', async () => {
    const wrapper = render(resource());
    const rows = wrapper.findAll('[data-test="pick-sheet-option"]');
    expect(rows.map((row) => row.text())).deep.eq(['M€', 'Steel', 'Plants']);
    expect(wrapper.find('[data-test="pick-sheet-submit"]').attributes('disabled')).is.not.undefined;
    await rows[2].trigger('click');
    await wrapper.find('[data-test="pick-sheet-submit"]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'resource', resource: 'plants'});
    expect(wrapper.emitted('close')).has.length(1);
  });

  it('names a delegate by its owner, or as neutral', async () => {
    const wrapper = render(delegate());
    const rows = wrapper.findAll('[data-test="pick-sheet-option"]');
    expect(rows.map((row) => row.text())).deep.eq(['Greta', 'Neutral']);
    await rows[1].trigger('click');
    await wrapper.find('[data-test="pick-sheet-submit"]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'delegate', player: 'NEUTRAL'});
  });

  it('answers an option of a choice as that option', async () => {
    const choice: PlayerInputModel = {type: 'or', title: 'Select one option', buttonLabel: 'OK', options: [option('Skip'), delegate()]};
    const wrapper = render(choice, 1);
    expect(wrapper.find('[data-test="pick-sheet-cancel"]').exists()).is.true;
    await wrapper.findAll('[data-test="pick-sheet-option"]')[0].trigger('click');
    await wrapper.find('[data-test="pick-sheet-submit"]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'or', index: 1, response: {type: 'delegate', player: 'green'}});
  });
});
