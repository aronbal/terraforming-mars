import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import MobileCardChooser from '@/client/components/mobile/MobileCardChooser.vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {cardChoice, menu, option} from './menuFixtures';
import {chooserInput} from '@/client/components/mobile/CardChooser';

describe('MobileCardChooser', () => {
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

  function render(waitingFor: PlayerInputModel, entry?: number) {
    const playerView = fakePlayerViewModel({waitingFor, thisPlayer: fakePublicPlayerModel({cardCost: 3})} as never);
    return mount(MobileCardChooser, {
      ...globalConfig,
      props: {playerView, entry},
      global: {...globalConfig.global, stubs: {Card: true}},
    });
  }

  const draft = () => cardChoice([CardName.ANTS, CardName.BIRDS, CardName.COMET]);
  const cardsOf = (wrapper: ReturnType<typeof render>) => wrapper.findAll('[data-test=card-chooser-card]');

  it('shows every card at once', () => {
    expect(cardsOf(render(draft()))).has.length(3);
  });

  it('a tap picks a card for a question that takes one, and another tap moves the pick', async () => {
    const wrapper = render(draft());
    const submit = () => wrapper.find('[data-test=card-chooser-submit]');
    expect(submit().attributes('disabled')).is.not.undefined;

    await cardsOf(wrapper)[0].trigger('click');
    await cardsOf(wrapper)[1].trigger('click');
    expect(wrapper.vm.chosen).deep.eq([CardName.BIRDS]);
    expect(wrapper.findAll('[data-test=card-chooser-check]')).has.length(1);
    expect(submit().text()).eq('Select');

    await submit().trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'card', cards: [CardName.BIRDS]});
  });

  it('will not choose a card the question greys out', async () => {
    const repick = cardChoice([CardName.ANTS, CardName.BIRDS]);
    (repick as unknown as {cards: Array<{isDisabled?: boolean}>}).cards[0].isDisabled = true;
    const wrapper = render(repick);
    expect(cardsOf(wrapper)[0].attributes('disabled')).is.not.undefined;
    wrapper.vm.toggle(CardName.ANTS);
    expect(wrapper.vm.chosen).is.empty;
  });

  it('buys several, saying how many and what they cost', async () => {
    const wrapper = render(cardChoice([CardName.ANTS, CardName.BIRDS, CardName.COMET], {min: 0, max: 3, buttonLabel: 'Buy', annotation: 'buyCards'}));
    const submit = () => wrapper.find('[data-test=card-chooser-submit]');
    expect(submit().text()).eq('Skip');

    await cardsOf(wrapper)[0].trigger('click');
    await cardsOf(wrapper)[2].trigger('click');
    expect(wrapper.findAll('[data-test=card-chooser-check]')).has.length(2);
    expect(submit().text()).eq('Buy 2 · 6 M€');

    await submit().trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'card', cards: [CardName.ANTS, CardName.COMET]});
  });

  it('prices only a purchase the server marks as buying cards', async () => {
    const wrapper = render(cardChoice([CardName.ANTS, CardName.BIRDS], {min: 0, max: 2, buttonLabel: 'Buy'}));
    await cardsOf(wrapper)[0].trigger('click');
    expect(wrapper.find('[data-test=card-chooser-submit]').text()).eq('Buy · 1');
  });

  /* Board of Directors: one prelude, pay 12 M€ to play it or discard it. */
  it('offers one card to take or leave as two buttons that say so', async () => {
    const wrapper = render(cardChoice([CardName.ANTS], {min: 0, max: 1, buttonLabel: 'Buy'}));
    expect(wrapper.find('[data-test=card-chooser-submit]').exists()).is.false;
    expect(wrapper.find('[data-test=card-chooser-take]').text()).eq('Buy');
    expect(wrapper.find('[data-test=card-chooser-leave]').text()).eq('Skip');

    await wrapper.find('[data-test=card-chooser-take]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'card', cards: [CardName.ANTS]});
  });

  it('leaves the one card with Skip', async () => {
    const wrapper = render(cardChoice([CardName.ANTS], {min: 0, max: 1, buttonLabel: 'Buy'}));
    await wrapper.find('[data-test=card-chooser-leave]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'card', cards: []});
  });

  it('a second tap puts a card back', async () => {
    const wrapper = render(cardChoice([CardName.ANTS, CardName.BIRDS], {min: 0, max: 2, buttonLabel: 'Buy'}));
    await cardsOf(wrapper)[0].trigger('click');
    await cardsOf(wrapper)[0].trigger('click');
    expect(wrapper.vm.chosen).is.empty;
  });

  it('chooses no more than the question allows', async () => {
    const wrapper = render(cardChoice([CardName.ANTS, CardName.BIRDS, CardName.COMET], {min: 0, max: 2, buttonLabel: 'Buy'}));
    for (const card of cardsOf(wrapper)) {
      await card.trigger('click');
    }
    expect(wrapper.vm.chosen).deep.eq([CardName.ANTS, CardName.BIRDS]);
  });

  it('sells patents through the menu entry, saying what they fetch', async () => {
    const sell = cardChoice([CardName.ANTS, CardName.BIRDS], {min: 1, max: 2, buttonLabel: 'Sell', annotation: 'sellPatents'});
    const wrapper = render(menu(option('Pass for this generation', 'pass'), sell), 1);
    expect(wrapper.find('[data-test=card-chooser-submit]').attributes('disabled')).is.not.undefined;
    expect(wrapper.find('[data-test=card-chooser-cancel]').exists()).is.true;

    await cardsOf(wrapper)[0].trigger('click');
    expect(wrapper.find('[data-test=card-chooser-submit]').text()).eq('Sell 1 · +1 M€');
    await wrapper.find('[data-test=card-chooser-submit]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'or', index: 1, response: {type: 'card', cards: [CardName.ANTS]}});
  });

  it('has no Cancel for a question that must be answered, only the scrim', async () => {
    const wrapper = render(draft());
    expect(wrapper.find('[data-test=card-chooser-cancel]').exists()).is.false;
    await wrapper.find('[data-test=card-chooser-scrim]').trigger('click');
    expect(wrapper.emitted('close')).has.length(1);
  });

  it('answers a pick among cards that is an option of a choice as that option', async () => {
    const choice = {type: 'or', title: 'Select one option', buttonLabel: 'OK', options: [cardChoice([CardName.ANTS, CardName.BIRDS]), option('Do not discard a card')]} as PlayerInputModel;
    expect(chooserInput(choice, 0)).is.not.undefined;
    expect(chooserInput(choice, 1)).is.undefined;
    expect(render(choice, 0).emitted('close')).is.undefined;
  });

  it('closes when there is no pick among cards to answer', () => {
    expect(render(menu(option('Pass for this generation', 'pass'))).emitted('close')).has.length(1);
  });
});
