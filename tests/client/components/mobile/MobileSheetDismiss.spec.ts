import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel} from '../testHelpers';
import MobileSheetDismiss from '@/client/components/mobile/MobileSheetDismiss.vue';

describe('MobileSheetDismiss', () => {
  let requested: Array<string>;
  let realFetch: typeof global.fetch;

  beforeEach(() => {
    requested = [];
    realFetch = global.fetch;
    global.fetch = (async (url: string) => {
      requested.push(url);
      return {ok: true, status: 200, json: async () => fakePlayerViewModel()};
    }) as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  function render(canCancelAction: boolean, asked: boolean, label: 'Cancel' | 'Close' = 'Close') {
    return mount(MobileSheetDismiss, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel({id: 'p-blue-id', canCancelAction} as never), label, asked},
    });
  }

  it('only puts the sheet down when there is no action to take back', async () => {
    const wrapper = render(false, true);
    expect(wrapper.text()).eq('Close');
    await wrapper.trigger('click');
    expect(wrapper.emitted('close')).has.length(1);
    expect(requested).is.empty;
  });

  it('takes the action back to the turn\'s menu where the server allows it', async () => {
    const wrapper = render(true, true);
    expect(wrapper.text()).eq('Cancel');
    await wrapper.trigger('click');
    await flushPromises();
    expect(requested).deep.eq(['api/cancelaction?id=p-blue-id']);
    expect(wrapper.emitted('close')).is.undefined;
  });

  it('steps back instead in a sheet answering an entry the player opened', async () => {
    const wrapper = render(true, false, 'Cancel');
    expect(wrapper.text()).eq('Cancel');
    await wrapper.trigger('click');
    expect(wrapper.emitted('close')).has.length(1);
    expect(requested).is.empty;
  });
});
