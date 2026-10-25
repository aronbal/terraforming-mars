import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel} from '../testHelpers';
import MobileColonySheet from '@/client/components/mobile/MobileColonySheet.vue';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyName} from '@/common/colonies/ColonyName';
import {option} from './menuFixtures';

describe('MobileColonySheet', () => {
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

  const colonyModel = (name: ColonyName): ColonyModel => ({
    colonies: [],
    isActive: true,
    name,
    trackPosition: 1,
    visitor: undefined,
  });

  const colony = (names: Array<ColonyName>): PlayerInputModel => ({
    type: 'colony',
    title: 'Select where to build a colony',
    buttonLabel: 'Build',
    coloniesModel: names.map(colonyModel),
  } as PlayerInputModel);

  function render(waitingFor: PlayerInputModel, entry?: number) {
    return mount(MobileColonySheet, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel({waitingFor} as never), entry},
    });
  }

  it('shows each colony and sends the one chosen', async () => {
    const wrapper = render(colony([ColonyName.CERES, ColonyName.IO]));
    const rows = wrapper.findAll('[data-test="colony-sheet-option"]');
    expect(rows).has.length(2);
    expect(wrapper.find('[data-test="colony-sheet-submit"]').attributes('disabled')).is.not.undefined;
    await rows[1].trigger('click');
    expect(rows[1].classes()).contains('mobile-colony-option--on');
    await wrapper.find('[data-test="colony-sheet-submit"]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'colony', colonyName: ColonyName.IO});
  });

  it('answers an option of a choice as that option', async () => {
    const choice = {type: 'or', title: 'Select one option', buttonLabel: 'OK', options: [option('Skip'), colony([ColonyName.CERES])]} as PlayerInputModel;
    const wrapper = render(choice, 1);
    await wrapper.find('[data-test="colony-sheet-submit"]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'or', index: 1, response: {type: 'colony', colonyName: ColonyName.CERES}});
  });
});
