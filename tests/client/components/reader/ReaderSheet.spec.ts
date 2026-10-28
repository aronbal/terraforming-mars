import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ReaderSheet from '@/client/components/reader/ReaderSheet.vue';
import {closeReader, openReaderAt, readerStack} from '@/client/components/reader/reader';

const VARIANTS = [
  '# Variants',
  '### TR Boost',
  'Start with more TR. See [Allow Undo](Variants#allow-undo).',
  '### Allow Undo',
  'Take it back.',
].join('\n');

describe('ReaderSheet', () => {
  let originalFetch: typeof global.fetch;
  let fetched: Array<string>;
  let mounted: Array<ReturnType<typeof mount>>;

  function mountSheet() {
    const wrapper = mount(ReaderSheet, {...globalConfig, global: {...globalConfig.global, stubs: {teleport: true}}});
    mounted.push(wrapper);
    return wrapper;
  }

  beforeEach(() => {
    mounted = [];
    fetched = [];
    originalFetch = global.fetch;
    global.fetch = (input: string | URL | Request) => {
      fetched.push(String(input));
      return Promise.resolve({ok: true, text: () => Promise.resolve(VARIANTS)} as Response);
    };
  });

  afterEach(() => {
    // The sheet listens on the document while it is mounted.
    mounted.forEach((wrapper) => wrapper.unmount());
    global.fetch = originalFetch;
    closeReader();
  });

  it('shows nothing until a page is opened', () => {
    const wrapper = mountSheet();
    expect(wrapper.find('[data-test=reader]').exists()).is.false;
  });

  it('shows one section as an info box', async () => {
    const wrapper = mountSheet();
    openReaderAt('https://github.com/terraforming-mars/terraforming-mars/wiki/Variants#tr-boost');
    await flushPromises();

    expect(wrapper.find('[data-test=reader]').classes()).to.include('reader--section');
    expect(wrapper.find('.reader-title').text()).eq('TR Boost');
    const text = wrapper.find('[data-test=reader-text]');
    expect(text.text()).to.include('Start with more TR.');
    expect(text.text()).not.to.include('Take it back.');
    expect(fetched[0]).eq('https://raw.githubusercontent.com/wiki/terraforming-mars/terraforming-mars/Variants.md');
  });

  it('follows a wiki link inside the page, and goes back', async () => {
    const wrapper = mountSheet();
    openReaderAt('https://github.com/terraforming-mars/terraforming-mars/wiki/Variants#tr-boost');
    await flushPromises();

    await wrapper.find('[data-test=reader-text] a').trigger('click');
    await flushPromises();
    expect(readerStack.value).has.length(2);
    expect(wrapper.find('.reader-title').text()).eq('Allow Undo');

    await wrapper.find('[data-test=reader-back]').trigger('click');
    await flushPromises();
    expect(wrapper.find('.reader-title').text()).eq('TR Boost');
  });

  it('says so when the page cannot be loaded', async () => {
    global.fetch = () => Promise.resolve({ok: false, status: 404} as Response);
    const consoleError = console.error;
    console.error = () => {};
    const wrapper = mountSheet();
    openReaderAt('https://github.com/terraforming-mars/terraforming-mars/wiki/Missing');
    await flushPromises();

    console.error = consoleError;
    expect(wrapper.find('[data-test=reader-failed]').exists()).is.true;
  });

  it('closes', async () => {
    const wrapper = mountSheet();
    openReaderAt('https://github.com/terraforming-mars/terraforming-mars/wiki/Variants');
    await flushPromises();
    await wrapper.find('[data-test=reader-close]').trigger('click');

    expect(readerStack.value).is.empty;
    expect(wrapper.find('[data-test=reader]').exists()).is.false;
  });
});
