import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import MobilePlaySheet from '@/client/components/mobile/MobilePlaySheet.vue';
import {CardName} from '@/common/cards/CardName';
import {Payment} from '@/common/inputs/Payment';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {RecursivePartial} from '@/common/utils/utils';
import {CardOffer} from '@/client/utils/cardSelection';

function projectCard(name: CardName, calculatedCost: number): PlayerInputModel {
  return {
    type: 'projectCard',
    title: 'Play project card',
    buttonLabel: 'Play card',
    annotation: 'projectCard',
    cards: [{name, calculatedCost}],
    paymentOptions: {},
    microbes: 0,
    floaters: 0,
    lunaArchivesScience: 0,
    seeds: 0,
    graphene: 0,
    kuiperAsteroids: 0,
    auroraiData: 0,
    spireScience: 0,
  };
}

function actionCard(name: CardName): PlayerInputModel {
  return {
    type: 'card',
    title: 'Perform an action from a played card',
    buttonLabel: 'Take action',
    annotation: 'actionCard',
    cards: [{name}],
    max: 1,
    min: 1,
    showOnlyInLearnerMode: false,
    selectBlueCardAction: true,
    showOwner: false,
    showSelectAll: false,
  };
}

function menu(...options: Array<PlayerInputModel>): OrOptionsModel {
  return {type: 'or', title: 'Take your first action', buttonLabel: 'Take action', options};
}

const pass: PlayerInputModel = {type: 'option', title: 'Pass for this generation', buttonLabel: 'Pass', annotation: 'pass'};

function view(waitingFor: PlayerInputModel, player: RecursivePartial<PublicPlayerModel>): PlayerViewModel {
  return fakePlayerViewModel({thisPlayer: fakePublicPlayerModel(player), waitingFor});
}

describe('MobilePlaySheet', () => {
  type Posted = {url: string, body: unknown};
  let posted: Array<Posted>;
  let realFetch: typeof global.fetch;

  beforeEach(() => {
    posted = [];
    realFetch = global.fetch;
    global.fetch = (async (url: string, options: {body: string}) => {
      posted.push({url, body: JSON.parse(options.body)});
      return {ok: true, status: 200, json: async () => fakePlayerViewModel()};
    }) as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  function render(playerView: PlayerViewModel, card: CardName, offer: CardOffer) {
    return mount(MobilePlaySheet, {
      ...globalConfig,
      props: {playerView, card, offer},
    });
  }

  // Asteroid Deflection System costs 13 and has both a building and a space tag.
  function deflection(player: RecursivePartial<PublicPlayerModel>) {
    return render(
      view(menu(pass, projectCard(CardName.ASTEROID_DEFLECTION_SYSTEM, 13)), player),
      CardName.ASTEROID_DEFLECTION_SYSTEM,
      'play');
  }

  it('offers steel and titanium for a card that takes both', async () => {
    const wrapper = deflection({megacredits: 10, steel: 3, titanium: 2});
    await flushPromises();

    expect(wrapper.find('[data-test=play-sheet]').exists()).is.true;
    expect(wrapper.findComponent({name: 'Card'}).props('card').name).eq(CardName.ASTEROID_DEFLECTION_SYSTEM);
    expect(wrapper.find('[data-test=pay-steel]').exists()).is.true;
    expect(wrapper.find('[data-test=pay-titanium]').exists()).is.true;
    expect(wrapper.find('[data-test=pay-heat]').exists()).is.false;
    // The desktop's default: every metal that fits, M€ for the rest.
    expect(wrapper.find('[data-test=count-steel]').text()).eq('3');
    expect(wrapper.find('[data-test=count-titanium]').text()).eq('2');
    expect(wrapper.find('[data-test=play-sheet-submit]').text()).eq('Play · 1 M€');
  });

  it('moves the M€ in the button as a stepper changes', async () => {
    const wrapper = deflection({megacredits: 10, steel: 3, titanium: 2});
    await flushPromises();

    await wrapper.find('[data-test=less-titanium]').trigger('click');
    expect(wrapper.find('[data-test=count-titanium]').text()).eq('1');
    expect(wrapper.find('[data-test=count-megacredits]').text()).eq('4');
    expect(wrapper.find('[data-test=play-sheet-submit]').text()).eq('Play · 4 M€');

    await wrapper.find('[data-test=more-titanium]').trigger('click');
    expect(wrapper.find('[data-test=play-sheet-submit]').text()).eq('Play · 1 M€');
  });

  it('disables Play and says why when the payment falls short', async () => {
    const wrapper = deflection({megacredits: 2, steel: 3, titanium: 2});
    await flushPromises();

    const submit = wrapper.find('[data-test=play-sheet-submit]');
    expect(submit.attributes('disabled')).is.undefined;
    expect(wrapper.find('[data-test=play-sheet-reason]').exists()).is.false;

    await wrapper.find('[data-test=less-titanium]').trigger('click');
    expect(submit.attributes('disabled')).is.not.undefined;
    expect(wrapper.find('[data-test=play-sheet-reason]').text()).eq('Haven\'t spent enough');

    await submit.trigger('click');
    await flushPromises();
    expect(posted).is.empty;
  });

  it('plays the card with the answer the desktop menu sends', async () => {
    const wrapper = deflection({megacredits: 10, steel: 3, titanium: 2});
    await flushPromises();
    await wrapper.find('[data-test=less-steel]').trigger('click');

    await wrapper.find('[data-test=play-sheet-submit]').trigger('click');
    await flushPromises();

    expect(posted).has.length(1);
    expect(posted[0].url).eq('player/input?id=p-blue-id');
    expect(posted[0].body).deep.eq({
      runId: 'run-id',
      type: 'or',
      index: 1,
      response: {
        type: 'projectCard',
        card: CardName.ASTEROID_DEFLECTION_SYSTEM,
        payment: Payment.of({steel: 2, titanium: 2, megacredits: 3}),
      },
    });
    expect(wrapper.emitted('close')).has.length(1);
  });

  it('answers a card asked for directly without wrapping it in the menu', async () => {
    const wrapper = render(
      view(projectCard(CardName.BIRDS, 10), {megacredits: 12}),
      CardName.BIRDS,
      'play');
    await flushPromises();

    expect(wrapper.find('[data-test=pay-steel]').exists()).is.false;
    await wrapper.find('[data-test=play-sheet-submit]').trigger('click');
    await flushPromises();

    expect(posted[0].body).deep.eq({
      runId: 'run-id',
      type: 'projectCard',
      card: CardName.BIRDS,
      payment: Payment.of({megacredits: 10}),
    });
  });

  it('uses a card action by selecting the card', async () => {
    const wrapper = render(
      view(menu(actionCard(CardName.DEVELOPMENT_CENTER), pass), {}),
      CardName.DEVELOPMENT_CENTER,
      'action');
    await flushPromises();

    expect(wrapper.find('[data-test=play-sheet-payment]').exists()).is.false;
    const submit = wrapper.find('[data-test=play-sheet-submit]');
    expect(submit.text()).eq('Use');

    await submit.trigger('click');
    await flushPromises();

    expect(posted).has.length(1);
    expect(posted[0].body).deep.eq({
      runId: 'run-id',
      type: 'or',
      index: 0,
      response: {type: 'card', cards: [CardName.DEVELOPMENT_CENTER]},
    });
    expect(wrapper.emitted('close')).has.length(1);
  });

  it('closes on Cancel and on the scrim without sending anything', async () => {
    const wrapper = deflection({megacredits: 10, steel: 3, titanium: 2});
    await flushPromises();

    await wrapper.find('[data-test=play-sheet-cancel]').trigger('click');
    expect(wrapper.emitted('close')).has.length(1);
    await wrapper.find('[data-test=play-sheet-scrim]').trigger('click');
    expect(wrapper.emitted('close')).has.length(2);
    expect(posted).is.empty;
  });

  it('shows nothing and closes when the input no longer offers the card', async () => {
    const wrapper = render(
      view(menu(pass, projectCard(CardName.BIRDS, 10)), {megacredits: 12}),
      CardName.ASTEROID_DEFLECTION_SYSTEM,
      'play');
    await flushPromises();

    expect(wrapper.find('[data-test=play-sheet]').exists()).is.false;
    expect(wrapper.emitted('close')).has.length(1);
  });

  it('does not play a card the menu only offers as an action', async () => {
    const wrapper = render(
      view(menu(actionCard(CardName.DEVELOPMENT_CENTER)), {}),
      CardName.DEVELOPMENT_CENTER,
      'play');
    await flushPromises();

    expect(wrapper.find('[data-test=play-sheet]').exists()).is.false;
    expect(wrapper.emitted('close')).has.length(1);
  });
});
