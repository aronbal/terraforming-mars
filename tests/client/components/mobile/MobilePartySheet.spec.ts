import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakeGameModel, fakePlayerViewModel} from '../testHelpers';
import MobilePartySheet from '@/client/components/mobile/MobilePartySheet.vue';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PartyName} from '@/common/turmoil/PartyName';
import {fakeTurmoil, option} from './menuFixtures';

describe('MobilePartySheet', () => {
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

  const party = (parties: Array<PartyName>): PlayerInputModel => ({
    type: 'party',
    title: 'Send a delegate in an area (5 M€)',
    buttonLabel: 'Send delegate',
    parties,
  } as PlayerInputModel);

  function render(waitingFor: PlayerInputModel, entry?: number) {
    return mount(MobilePartySheet, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel({waitingFor, game: fakeGameModel({turmoil: fakeTurmoil()})} as never),
        entry,
      },
    });
  }

  it('lists only the parties the delegate may go to', () => {
    const rows = render(party([PartyName.MARS, PartyName.GREENS])).findAll('[data-test="party-sheet-option"]');
    expect(rows.map((row) => row.text())).has.length(2);
    expect(rows[0].text()).contains('Mars First');
    expect(rows[0].find('[data-test="party-dominant"]').exists()).is.true;
    expect(rows[1].find('[data-test="party-ruling"]').exists()).is.true;
  });

  it('sends nothing until a party is chosen', async () => {
    const wrapper = render(party([PartyName.MARS, PartyName.GREENS]));
    expect(wrapper.find('[data-test="party-sheet-submit"]').attributes('disabled')).is.not.undefined;
    await wrapper.findAll('[data-test="party-sheet-option"]')[1].trigger('click');
    await wrapper.find('[data-test="party-sheet-submit"]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'party', partyName: PartyName.GREENS});
    expect(wrapper.emitted('close')).has.length(1);
  });

  it('answers an option of a choice as that option', async () => {
    const choice = {type: 'or', title: 'Take an action', buttonLabel: 'OK', options: [option('Pass'), party([PartyName.SCIENTISTS])]} as PlayerInputModel;
    const wrapper = render(choice, 1);
    expect(wrapper.find('[data-test="party-sheet-cancel"]').exists()).is.true;
    await wrapper.find('[data-test="party-sheet-submit"]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'or', index: 1, response: {type: 'party', partyName: PartyName.SCIENTISTS}});
  });
});
