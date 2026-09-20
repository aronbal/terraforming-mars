import {mount} from '@vue/test-utils';
import {h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import CreateGameSection from '@/client/components/create/CreateGameSection.vue';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {
  refreshMobileLayoutPreference,
  resetMobileLayoutForTest,
  startMobileLayoutTracking,
} from '@/client/utils/useMobileLayout';

describe('CreateGameSection', () => {
  let localStorage: FakeLocalStorage;
  const realViewportWidth = window.innerWidth;

  function useMobileLayout() {
    Object.defineProperty(window, 'innerWidth', {value: 390, configurable: true});
    startMobileLayoutTracking();
    PreferencesManager.INSTANCE.set('mobile_layout', 'on');
    refreshMobileLayoutPreference();
  }

  function createComponent(initiallyOpen = false) {
    return mount(CreateGameSection, {
      ...globalConfig,
      props: {title: 'Expansions', initiallyOpen},
      // A render function, not a template string: the test build runs the runtime-only
      // compiler, which cannot compile one.
      slots: {default: () => h('label', {'data-test': 'option'}, 'Venus Next')},
    });
  }

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    PreferencesManager.resetForTest();
    resetMobileLayoutForTest();
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
    PreferencesManager.resetForTest();
    resetMobileLayoutForTest();
    // The width is on the shared window; leaving a phone width here would put every
    // later spec that starts tracking into the mobile shell.
    Object.defineProperty(window, 'innerWidth', {value: realViewportWidth, configurable: true});
  });

  it('mounts without errors, showing what it was given', () => {
    const component = createComponent();
    expect(component.find('[data-test="option"]').exists()).is.true;
    expect(component.find('h4').text()).to.contain('Expansions');
  });

  it('is a plain heading, always open, where there is room for the columns', () => {
    const component = createComponent();
    expect(component.find('.create-game-section-toggle').exists()).is.false;
    expect(component.classes()).not.to.include('create-game-page-column--collapsed');
  });

  it('becomes the control that opens its own section on a phone', async () => {
    useMobileLayout();
    const component = createComponent();

    const toggle = component.find('.create-game-section-toggle');
    expect(toggle.exists()).is.true;
    expect(toggle.attributes('aria-expanded')).eq('false');
    expect(component.classes()).to.include('create-game-page-column--collapsed');

    await toggle.trigger('click');

    expect(toggle.attributes('aria-expanded')).eq('true');
    expect(component.classes()).not.to.include('create-game-page-column--collapsed');
  });

  it('opens on arrival when it is asked to', () => {
    useMobileLayout();
    const component = createComponent(true);

    expect(component.find('.create-game-section-toggle').attributes('aria-expanded')).eq('true');
  });
});
