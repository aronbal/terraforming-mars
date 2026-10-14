<template>
  <section class="mobile-play-sheet-pay" data-test="play-sheet-payment">
    <div class="mobile-play-sheet-eyebrow" data-test="play-sheet-cost">{{ message('Pay ${0} M€', cost) }}</div>
    <div class="mobile-play-sheet-rows">
      <div v-for="unit in steppedUnits" :key="unit" class="mobile-play-sheet-row" :data-test="'pay-' + unit">
        <i class="resource_icon mobile-play-sheet-row-icon" :class="iconClass(unit)" aria-hidden="true"></i>
        <div class="mobile-play-sheet-row-text">
          <span class="mobile-play-sheet-row-title">{{ $t(descriptions[unit]) }}</span>
          <span class="mobile-play-sheet-row-sub">{{ message('${0} M€ each · ${1} available', ledger[unit].rate, ledger[unit].available) }}</span>
          <span v-if="ledger[unit].reserved" class="mobile-play-sheet-row-sub mobile-play-sheet-row-sub--warn">
            {{ message('Some ${0} are reserved and unavailable here.', unit) }}
          </span>
        </div>
        <button
          type="button"
          class="mobile-play-sheet-step"
          :aria-label="message('Pay one less ${0}', descriptions[unit])"
          :disabled="payment[unit] <= 0"
          :data-test="'less-' + unit"
          @click="reduceValue(unit)">−</button>
        <span class="mobile-play-sheet-row-value" :data-test="'count-' + unit">{{ payment[unit] }}</span>
        <button
          type="button"
          class="mobile-play-sheet-step mobile-play-sheet-step--more"
          :aria-label="message('Pay one more ${0}', descriptions[unit])"
          :disabled="!canAdd(unit)"
          :data-test="'more-' + unit"
          @click="addValue(unit)">+</button>
      </div>
      <div class="mobile-play-sheet-row" data-test="pay-megacredits">
        <i class="resource_icon mobile-play-sheet-row-icon resource_icon--megacredits" aria-hidden="true"></i>
        <div class="mobile-play-sheet-row-text">
          <span class="mobile-play-sheet-row-title">{{ $t('M€') }}</span>
          <span class="mobile-play-sheet-row-sub">{{ message('${0} available · ${1} left after', ledger.megacredits.available, megacreditsLeft) }}</span>
        </div>
        <span class="mobile-play-sheet-row-value mobile-play-sheet-row-value--total" data-test="count-megacredits">{{ payment.megacredits }}</span>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {Ledger, PAYMENT_UNIT_DESCRIPTIONS, paymentProblem, paymentUnitIconClass, remainingMegacredits, totalSpent} from '@/client/components/PaymentLedger';
import {computeDefaultPayment} from '@/client/components/PaymentDefaults';
import {
  ProjectCardPaymentContext,
  projectCardPaymentOrder,
  projectCardTitaniumRate,
  unitsAfterReserve,
} from '@/client/components/ProjectCardPayment';
import {PaymentWidgetMixin} from '@/client/mixins/PaymentWidgetMixin';
import {PlaySheetPaymentState} from '@/client/components/mobile/PlaySheet';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {Payment} from '@/common/inputs/Payment';
import {SpendableResource} from '@/common/inputs/Spendable';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {CardModel} from '@/common/models/CardModel';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Units} from '@/common/Units';

type DataModel = {
  card: CardModel | undefined;
  cost: number;
  tags: ReadonlyArray<Tag>;
  reserveUnits: Units;
  available: Units;
  payment: Payment;
};

/*
 * How a project card on the play sheet is paid for: one row with − and + for every
 * unit the card may be paid with, and the M€ that make up the rest.
 *
 * Every rule is the desktop's. Which units the card takes, what titanium is worth to
 * it, what a reserve holds back, Helion's heat and Stormcraft's floaters all come from
 * `ProjectCardPayment` and `PaymentWidgetMixin`, which `SelectProjectCardToPlay` uses
 * too; the first payment offered is `computeDefaultPayment`'s; and a payment is
 * refused for exactly the reasons `PaymentForm` refuses it. Only the drawing is the
 * shell's own.
 */
export default defineComponent({
  name: 'MobilePlaySheetPayment',
  mixins: [PaymentWidgetMixin],
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    playerinput: {
      type: Object as PropType<SelectProjectCardToPlayModel>,
      required: true,
    },
    cardName: {
      type: String as PropType<CardName>,
      required: true,
    },
  },
  emits: {
    change: (_state: PlaySheetPaymentState) => true,
  },
  data(): DataModel {
    const card = this.playerinput.cards.find((each) => each.name === this.cardName);
    return {
      card,
      cost: card?.calculatedCost ?? 0,
      tags: getCardOrThrow(this.cardName).tags,
      reserveUnits: card?.reserveUnits ?? Units.EMPTY,
      available: Units.of({}),
      payment: {...Payment.EMPTY},
    };
  },
  created() {
    this.available = unitsAfterReserve(this.playerView.thisPlayer, this.availableHeat(), this.reserveUnits);
    this.payment = computeDefaultPayment(this.cost, this.order, this.ledger, /* reserveMegacredits= */ false);
  },
  computed: {
    paymentContext(): ProjectCardPaymentContext | undefined {
      if (this.card === undefined) {
        return undefined;
      }
      return {card: this.card, tags: this.tags, playerinput: this.playerinput, thisPlayer: this.playerView.thisPlayer};
    },
    order(): ReadonlyArray<SpendableResource> {
      const context = this.paymentContext;
      return context === undefined ? [] : projectCardPaymentOrder(context);
    },
    ledger(): Ledger {
      return this.buildLedger(this.order, this.reserveUnits);
    },
    /* The units with a stepper. The desktop leaves out a unit the player has none of,
       and so does this; M€ is not stepped, it is whatever the rest leaves. */
    steppedUnits(): ReadonlyArray<SpendableResource> {
      return this.order.filter((unit) => unit !== 'megacredits' && this.ledger[unit].available > 0);
    },
    descriptions(): Readonly<Record<SpendableResource, string>> {
      return PAYMENT_UNIT_DESCRIPTIONS;
    },
    spent(): number {
      return totalSpent(this.payment, this.order, this.ledger);
    },
    megacreditsLeft(): number {
      return this.ledger.megacredits.available - this.payment.megacredits;
    },
    state(): PlaySheetPaymentState {
      const problem = paymentProblem(this.payment, this.cost, this.order, this.ledger);
      return {
        payment: {...this.payment},
        problem,
        overpaid: problem === undefined ? Math.max(0, this.spent - this.cost) : 0,
      };
    },
  },
  watch: {
    state: {
      handler(state: PlaySheetPaymentState) {
        this.$emit('change', state);
      },
      immediate: true,
    },
  },
  methods: {
    /** @override */
    getTitaniumResourceRate(): number {
      const context = this.paymentContext;
      return context === undefined ? this.playerView.thisPlayer.titaniumValue : projectCardTitaniumRate(context);
    },
    iconClass(unit: SpendableResource): string {
      return paymentUnitIconClass(unit);
    },
    message(text: string, ...values: Array<string | number>): string {
      return this.$t({
        message: text,
        data: values.map((value) => ({type: LogMessageDataType.RAW_STRING, value: String(value)})),
      });
    },
    /*
     * Whether one more `unit` could go towards the card.
     *
     * Once the M€ are down to nothing and the price is met, one more unit can only
     * overspend it by a whole unit, which `paymentProblem` refuses; so the button
     * stops there instead of offering a payment that cannot be sent.
     */
    canAdd(unit: SpendableResource): boolean {
      if (this.payment[unit] >= this.ledger[unit].available) {
        return false;
      }
      return this.payment.megacredits > 0 || this.spent < this.cost;
    },
    addValue(unit: SpendableResource): void {
      if (!this.canAdd(unit)) {
        return;
      }
      this.payment[unit] += 1;
      this.payment.megacredits = remainingMegacredits(this.payment, this.cost, this.order, this.ledger);
    },
    reduceValue(unit: SpendableResource): void {
      if (this.payment[unit] <= 0) {
        return;
      }
      this.payment[unit] -= 1;
      this.payment.megacredits = remainingMegacredits(this.payment, this.cost, this.order, this.ledger);
    },
  },
});
</script>
