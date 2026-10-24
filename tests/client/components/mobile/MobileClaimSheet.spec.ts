import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel} from '../testHelpers';
import MobileClaimSheet from '@/client/components/mobile/MobileClaimSheet.vue';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {menu, namedChoices, option} from './menuFixtures';

describe('MobileClaimSheet', () => {
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

  function claimMenu(): PlayerInputModel {
    return menu(
      option('Pass for this generation', 'pass'),
      namedChoices('milestone', 'Claim a milestone', 'Terraformer'),
      namedChoices('award', {message: 'Fund an award (${0} M€)', data: [{type: 1, value: '14'}]} as never, 'Landlord', 'Banker'));
  }

  function render(kind: 'milestone' | 'award', name: string, count = 1) {
    const playerView = fakePlayerViewModel({waitingFor: claimMenu()} as never);
    playerView.game.milestones = [{name: 'Terraformer', scores: []} as never];
    playerView.game.awards = [{name: 'Landlord', scores: []} as never, {name: 'Banker', scores: []} as never];
    return mount(MobileClaimSheet, {
      ...globalConfig,
      props: {playerView, kind, name, position: 0, count},
    });
  }

  it('mounts without errors', () => {
    expect(render('milestone', 'Terraformer').find('[data-test=claim-sheet]').exists()).is.true;
  });

  it('says what an award costs on its button, and a milestone only what it does', () => {
    expect(render('award', 'Banker').find('[data-test=claim-sheet-submit]').text()).eq('Fund · 14 M€');
    expect(render('milestone', 'Terraformer').find('[data-test=claim-sheet-submit]').text()).eq('Claim');
  });

  it('answers with the menu entry and the option that names the tile', async () => {
    const wrapper = render('award', 'Banker');
    await wrapper.find('[data-test=claim-sheet-submit]').trigger('click');
    await flushPromises();
    expect(posted).has.length(1);
    expect(posted[0]).deep.include({type: 'or', index: 2, response: {type: 'or', index: 1, response: {type: 'option'}}});
  });

  it('closes when the turn no longer offers it', () => {
    expect(render('award', 'Thermalist').emitted('close')).has.length(1);
  });

  it('turns to the next on a swipe left', () => {
    const wrapper = render('award', 'Banker', 3);
    wrapper.vm.onSwipeStart({clientX: 200, clientY: 300} as PointerEvent);
    wrapper.vm.onSwipeEnd({clientX: 120, clientY: 305} as PointerEvent);
    expect(wrapper.emitted('next')).has.length(1);
  });
});
