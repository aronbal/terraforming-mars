import {mount, VueWrapper} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileInitialCards from '@/client/components/mobile/MobileInitialCards.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {InputResponse, SelectInitialCardsResponse} from '@/common/inputs/InputResponse';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Preferences} from '@/client/utils/PreferencesManager';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import * as titles from '@/common/inputs/SelectInitialCards';
import {asComplete} from '../utils/models';

let savedData: InputResponse | undefined;

type Component = VueWrapper<InstanceType<typeof MobileInitialCards>>;

describe('MobileInitialCards', () => {
  beforeEach(() => {
    savedData = undefined;
  });

  it('mounts without errors', () => {
    const component = createComponent([CardName.ECOLINE], [CardName.ANTS]);
    expect(component.find('[data-test="mobile-initial"]').exists()).is.true;
  });

  it('has one step per selection the game asks for', () => {
    const twoStep = createComponent([CardName.ECOLINE], [CardName.ANTS]);
    expect(stepIds(twoStep)).to.deep.eq(['corporation', 'cards']);

    const fourStep = createComponent(
      [CardName.ECOLINE],
      [CardName.ANTS],
      [CardName.ALLIED_BANK, CardName.SUPPLY_DROP],
      [CardName.FLOYD, CardName.HAL9000]);
    expect(stepIds(fourStep)).to.deep.eq(['corporation', 'prelude', 'ceo', 'cards']);
  });

  it('counts what each step has against what it wants', async () => {
    const component = createComponent(
      [CardName.ECOLINE],
      [CardName.ANTS],
      [CardName.ALLIED_BANK, CardName.SUPPLY_DROP]);

    expect(component.find('[data-test="initial-step-prelude"]').text()).to.contain('0/2');

    selectCards(component)[1].vm.$emit('cardschanged', [CardName.ALLIED_BANK]);
    await component.vm.$nextTick();

    expect(component.find('[data-test="initial-step-prelude"]').text()).to.contain('1/2');
  });

  it('shows no money until the corporation is settled', async () => {
    const component = createComponent([CardName.ECOLINE], [CardName.ANTS]);
    expect(component.find('[data-test="initial-money"]').exists()).is.false;

    selectCards(component)[0].vm.$emit('cardschanged', [CardName.ECOLINE]);
    await component.vm.$nextTick();

    // Ecoline starts on 36 M€, and nothing has been bought yet.
    expect(component.find('[data-test="initial-money"]').text()).to.contain('36');

    selectCards(component)[1].vm.$emit('cardschanged', [CardName.ANTS]);
    await component.vm.$nextTick();

    expect(component.find('[data-test="initial-money"]').text()).to.contain('33');
  });

  it('walks the steps with Next, and only offers to save on the last one', async () => {
    const component = createComponent([CardName.ECOLINE], [CardName.ANTS]);

    expect(shownStep(component)).eq('corporation');
    expect(component.find('[data-test="initial-submit"]').exists()).is.false;

    await component.find('[data-test="initial-next"]').trigger('click');

    expect(shownStep(component)).eq('cards');
    expect(component.find('[data-test="initial-next"]').exists()).is.false;
    expect(component.find('[data-test="initial-submit"]').exists()).is.true;
  });

  it('keeps a step\'s selection when another step is shown', async () => {
    const component = createComponent([CardName.ECOLINE], [CardName.ANTS]);

    selectCards(component)[0].vm.$emit('cardschanged', [CardName.ECOLINE]);
    await component.find('[data-test="initial-step-cards"]').trigger('click');

    expect(component.find('[data-test="initial-step-corporation"]').text()).to.contain('1/1');
    expect(component.find('[data-test="initial-money"]').text()).to.contain('36');
  });

  it('cannot save until every step is answered', async () => {
    const component = createComponent(
      [CardName.ECOLINE],
      [CardName.ANTS],
      [CardName.ALLIED_BANK, CardName.SUPPLY_DROP]);

    await component.find('[data-test="initial-step-cards"]').trigger('click');
    const button = () => component.find('[data-test="initial-submit"]');
    expect(button().attributes().disabled).not.to.be.undefined;
    expect(component.find('[data-test="initial-warning"]').text()).to.contain('Select a corporation');

    selectCards(component)[0].vm.$emit('cardschanged', [CardName.ECOLINE]);
    await component.vm.$nextTick();
    expect(button().attributes().disabled).not.to.be.undefined;

    selectCards(component)[1].vm.$emit('cardschanged', [CardName.ALLIED_BANK, CardName.SUPPLY_DROP]);
    selectCards(component)[2].vm.$emit('cardschanged', [CardName.ANTS]);
    await component.vm.$nextTick();
    expect(button().attributes().disabled).is.undefined;

    await button().trigger('click');

    expect(savedData).to.deep.eq({type: 'initialCards', responses: [
      {type: 'card', cards: [CardName.ECOLINE]},
      {type: 'card', cards: [CardName.ALLIED_BANK, CardName.SUPPLY_DROP]},
      {type: 'card', cards: [CardName.ANTS]},
    ]});
  });

  it('asks before an opening that buys nothing', async () => {
    const component = createComponent([CardName.ECOLINE], [CardName.ANTS]);

    selectCards(component)[0].vm.$emit('cardschanged', [CardName.ECOLINE]);
    await component.find('[data-test="initial-step-cards"]').trigger('click');
    await component.find('[data-test="initial-submit"]').trigger('click');

    expect(savedData).is.undefined;
    expect(component.vm.$refs.confirmation).to.have.nested.property('$data.shown', true);
  });
});

/*
 * Which step is on screen, read off the step bar. The panes themselves are toggled
 * with `v-show`, and jsdom reports a stale computed style for an element whose inline
 * display was cleared after mount.
 */
function shownStep(component: Component): string | undefined {
  return component.findAll('.mobile-initial-steps button')
    .find((button) => button.attributes('aria-selected') === 'true')
    ?.attributes('data-test')?.replace('initial-step-', '');
}

function stepIds(component: Component): Array<string> {
  return component.findAll('.mobile-initial-steps button')
    .map((button) => button.attributes('data-test')?.replace('initial-step-', '') ?? '');
}

function selectCards(component: Component) {
  return component.findAllComponents({name: 'select-card'});
}

function createComponent(corpCards: Array<CardName>, projectCards: Array<CardName>, preludeCards?: Array<CardName>, ceoCards?: Array<CardName>) {
  const toObject = (cards: Array<CardName>) => cards.map((name) => {
    return {name} as CardModel;
  });
  const option = (title: string, cards: Array<CardName>, min: number, max: number): SelectCardModel => ({
    type: 'card',
    title,
    buttonLabel: 'x',
    cards: toObject(cards),
    max,
    min,
    showOnlyInLearnerMode: false,
    selectBlueCardAction: false,
    showOwner: false,
    showSelectAll: false,
  });

  const options: Array<SelectCardModel> = [option(titles.SELECT_CORPORATION_TITLE, corpCards, 1, 1)];
  if (preludeCards) {
    options.push(option(titles.SELECT_PRELUDE_TITLE, preludeCards, 2, 2));
  }
  if (ceoCards) {
    options.push(option(titles.SELECT_CEO_TITLE, ceoCards, 1, 1));
  }
  options.push(option(titles.SELECT_PROJECTS_TITLE, projectCards, 1, projectCards.length));

  return mount(MobileInitialCards, {
    ...globalConfig,
    props: {
      playerView: asComplete<PlayerViewModel>({
        id: 'p1',
        dealtCorporationCards: [],
        thisPlayer: {actionsThisGeneration: []},
        game: {},
      }),
      playerinput: {
        type: 'initialCards',
        title: 'selectInitialCards',
        buttonLabel: 'save',
        options,
      },
      onsave: function(data: SelectInitialCardsResponse) {
        savedData = data;
      },
      showsave: true,
      preferences: {
        show_alerts: true,
      } as Readonly<Preferences>,
    },
  });
}
