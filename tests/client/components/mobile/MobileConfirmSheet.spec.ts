import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel} from '../testHelpers';
import MobileConfirmSheet from '@/client/components/mobile/MobileConfirmSheet.vue';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {menu, option} from './menuFixtures';

describe('MobileConfirmSheet', () => {
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

  function render(waitingFor: PlayerInputModel) {
    return mount(MobileConfirmSheet, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel({waitingFor} as never), annotation: 'convertHeat', icon: 'thermometer'},
    });
  }

  function heatMenu(): PlayerInputModel {
    const heat = {...option('Convert 8 heat into temperature', 'convertHeat'), buttonLabel: 'Convert heat', warnings: ['maxtemp']};
    return menu(option('Pass for this generation', 'pass'), heat as PlayerInputModel);
  }

  it('says what the action does, its warning, and has its button', () => {
    const wrapper = render(heatMenu());
    expect(wrapper.find('[data-test=confirm-sheet-title]').text()).eq('Convert 8 heat into temperature');
    expect(wrapper.find('.card-warning').exists()).is.true;
    expect(wrapper.find('[data-test=confirm-sheet-submit]').text()).eq('Convert heat');
  });

  it('answers with the menu entry\'s own option', async () => {
    const wrapper = render(heatMenu());
    await wrapper.find('[data-test=confirm-sheet-submit]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'or', index: 1, response: {type: 'option'}});
    expect(wrapper.emitted('close')).has.length(1);
  });

  it('closes without sending anything on Cancel', async () => {
    const wrapper = render(heatMenu());
    await wrapper.find('[data-test=confirm-sheet-cancel]').trigger('click');
    expect(posted).is.empty;
    expect(wrapper.emitted('close')).has.length(1);
  });

  it('closes when the turn no longer offers the action', () => {
    expect(render(menu(option('Pass for this generation', 'pass'))).emitted('close')).has.length(1);
  });
});
