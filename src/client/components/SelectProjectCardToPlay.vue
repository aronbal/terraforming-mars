<template>
<div class="payments_cont">
  <div v-if="showtitle === true">{{ $t(playerinput.title) }}</div>
  <label
    v-for="availableCard in visibleCards"
    class="payments_cards"
    :class="{'payments_cards--chosen': preselected}"
    :key="availableCard.name">
    <input v-if="!availableCard.isDisabled" class="hidden" type="radio" v-model="cardName" :value="availableCard.name" >
    <Card class="cardbox" :card="availableCard" />
  </label>
  <div v-if="preselected" class="wf-chosen-card">
    <AppButton size="tiny" :title="$t('Choose another card')" data-test="show-all-cards" @click="preselected = false" />
  </div>
  <template v-if="card !== undefined && card.additionalProjectCosts">
    <div v-if="card.additionalProjectCosts.aeronGenomicsResources" class="card-warning"
      v-i18n="[$t(card.name), card.additionalProjectCosts.aeronGenomicsResources, 'animals', $t(CardName.AERON_GENOMICS)]"
    >
      Playing ${0} consumes ${1} ${2} from ${3}
    </div>
    <div v-if="card.additionalProjectCosts.thinkTankResources" class="card-warning"
      v-i18n="[$t(card.name), card.additionalProjectCosts.thinkTankResources, 'data', $t(CardName.THINK_TANK)]">
      Playing ${0} consumes ${1} ${2} from ${3}
    </div>
    <div v-if="card.additionalProjectCosts.redsCost" class="card-warning" v-i18n="[$t(card.name), card.additionalProjectCosts.redsCost, $t('Reds')]">
      Playing ${0} will cost ${1} M€ more because ${2} are in power
    </div>
  </template>
  <WarningsComponent v-if="card !== undefined" :warnings="card.warnings"/>

  <PaymentForm
    v-if="showPaymentSection"
    ref="paymentForm"
    :key="cardName"
    :cost="cost"
    :order="order"
    :ledger="ledger"
    :showsave="showsave"
    :buttonLabel="playerinput.buttonLabel"
    @change="(p) => payment = p"
    @save="doSave"/>
</div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {SpendableResource} from '@/common/inputs/Spendable';
import Card from '@/client/components/card/Card.vue';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {CardModel} from '@/common/models/CardModel';
import {CardOrderStorage} from '@/client/utils/CardOrderStorage';
import {PaymentWidgetMixin} from '@/client/mixins/PaymentWidgetMixin';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Units} from '@/common/Units';
import {CardName} from '@/common/cards/CardName';
import {SelectProjectCardToPlayResponse} from '@/common/inputs/InputResponse';
import WarningsComponent from '@/client/components/WarningsComponent.vue';
import PaymentForm from '@/client/components/PaymentForm.vue';
import {Ledger} from '@/client/components/PaymentLedger';
import AppButton from '@/client/components/common/AppButton.vue';
import {pickedCard} from '@/client/utils/cardSelection';
import {
  ProjectCardPaymentContext,
  projectCardPaymentOrder,
  projectCardTitaniumRate,
  unitsAfterReserve,
} from '@/client/components/ProjectCardPayment';

export default defineComponent({
  name: 'SelectProjectCardToPlay',
  mixins: [PaymentWidgetMixin],
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectProjectCardToPlayModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectProjectCardToPlayResponse) => void,
      required: true,
    },
    showsave: {
      type: Boolean,
    },
    showtitle: {
      type: Boolean,
    },
  },
  computed: {
    /*
     * Just the chosen card once one has been picked elsewhere -- on the mobile shell's
     * Cards tab. Listing the whole hand again under a card the player has already
     * chosen is the step that picking it there was meant to save.
     */
    pickedCard(): CardName | undefined {
      return pickedCard.value;
    },
    visibleCards(): ReadonlyArray<CardModel> {
      if (!this.preselected) {
        return this.cards;
      }
      return this.cards.filter((card) => card.name === this.cardName);
    },
    order(): ReadonlyArray<SpendableResource> {
      const context = this.paymentContext();
      return context === undefined ? [] : projectCardPaymentOrder(context);
    },
    ledger(): Ledger {
      return this.buildLedger(this.order, this.reserveUnits);
    },
    CardName(): typeof CardName {
      return CardName;
    },
    showPaymentSection(): boolean {
      return this.card !== undefined && this.card.isDisabled !== true;
    },
  },
  watch: {
    pickedCard: {
      handler() {
        this.selectPickedCard();
      },
      immediate: true,
    },
    // Vue runs watchers before re-rendering the component that owns them, so
    // available units are updated before PaymentForm remounts via :key and reads them.
    cardName(newVal: string | undefined) {
      if (newVal === undefined) {
        return;
      }
      // TODO(kberg): this stuff is set in data(). Perhaps share the code?
      this.card = this.getCard();
      this.cost = this.card.calculatedCost ?? 0;
      this.tags = this.getCardTags();
      this.reserveUnits = this.card.reserveUnits ?? Units.EMPTY;
      this.updateAvailableUnits();
    },
  },
  data() {
    let card: CardModel | undefined;
    let cards: ReadonlyArray<CardModel> = [];
    if ((this.playerinput?.cards?.length ?? 0) > 0) {
      cards = CardOrderStorage.getOrdered(
        CardOrderStorage.getCardOrder(this.playerView.id),
        this.playerinput.cards,
      );
      card = cards[0];
    }
    return {
      cardName: card?.name,
      card: card,
      reserveUnits: card?.reserveUnits ?? Units.EMPTY,
      cards: cards,
      cost: card?.calculatedCost ?? 0,
      tags: card !== undefined ? getCardOrThrow(card.name).tags : [],
      available: Units.of({}),
      // Set when the card came from somewhere other than this list.
      preselected: false,
    };
  },
  components: {
    AppButton,
    Card,
    PaymentForm,
    WarningsComponent,
  },
  created() {
    if (this.cards.length === 0) {
      return;
    }
    this.updateAvailableUnits();
  },
  methods: {
    selectPickedCard(): void {
      const name = pickedCard.value;
      if (name === undefined) {
        return;
      }
      if (!this.cards.some((card) => card.name === name && card.isDisabled !== true)) {
        return;
      }
      this.cardName = name;
      this.preselected = true;
    },
    getCard() {
      const card = this.cards.find((c) => c.name === this.cardName);
      if (card === undefined) {
        throw new Error(`card not found ${this.cardName}`);
      }
      return card;
    },
    getCardTags() {
      // By the time getCardTags is called, this.cardName is defined. This is an
      // unnecessary guard.
      if (this.cardName === undefined) {
        return [];
      }
      return getCardOrThrow(this.cardName).tags;
    },
    updateAvailableUnits() {
      this.available = unitsAfterReserve(this.playerView.thisPlayer, this.availableHeat(), this.reserveUnits);
    },
    paymentContext(): ProjectCardPaymentContext | undefined {
      if (this.card === undefined) {
        return undefined;
      }
      return {card: this.card, tags: this.tags, playerinput: this.playerinput, thisPlayer: this.playerView.thisPlayer};
    },
    /** @override */
    getTitaniumResourceRate(): number {
      const context = this.paymentContext();
      return context === undefined ? this.playerView.thisPlayer.titaniumValue - 1 : projectCardTitaniumRate(context);
    },
    saveData() {
      if (this.card === undefined) {
        return;
      }
      const paymentForm = this.$refs.paymentForm as {handleSave: () => void} | undefined;
      if (paymentForm !== undefined) {
        paymentForm.handleSave();
      } else {
        this.doSave();
      }
    },
    doSave() {
      if (this.card === undefined) {
        return;
      }
      this.onsave({type: 'projectCard', card: this.card.name, payment: this.payment});
    },
  },
});
</script>
