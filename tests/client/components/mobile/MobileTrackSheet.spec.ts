import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {FakeLocalStorage} from '../FakeLocalStorage';
import MobileTrackSheet from '@/client/components/mobile/MobileTrackSheet.vue';
import {PreferencesManager} from '@/client/utils/PreferencesManager';

describe('MobileTrackSheet', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    PreferencesManager.resetForTest();
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
    PreferencesManager.resetForTest();
  });

  const players = [
    {color: 'red' as const, name: 'Red', terraformRating: 23},
    {color: 'green' as const, name: 'Green', terraformRating: 27},
    {color: 'blue' as const, name: 'Blue', terraformRating: 23},
  ];

  it('lists who is where, best first, a shared rating sharing its place', () => {
    const rows = mount(MobileTrackSheet, {...globalConfig, props: {players, you: 'blue'}}).findAll('[data-test="track-sheet-row"]');
    expect(rows.map((row) => row.text())).deep.eq(['1Green27', '2Red23', '2Blue23']);
    expect(rows[2].classes()).contains('mobile-track-sheet-row--you');
  });

  it('draws each player\'s marker in their colour, with the symbol when asked for', () => {
    PreferencesManager.INSTANCE.set('symbol_overlay', true);
    const marker = mount(MobileTrackSheet, {...globalConfig, props: {players}}).find('.mobile-track-marker');
    expect(marker.classes()).contains('player_bg_color_green');
    expect(marker.text()).eq('◆');
  });

  it('is put down from its Close', async () => {
    const wrapper = mount(MobileTrackSheet, {...globalConfig, props: {players}});
    await wrapper.find('[data-test="track-sheet-close"]').trigger('click');
    expect(wrapper.emitted('close')).has.length(1);
  });
});
