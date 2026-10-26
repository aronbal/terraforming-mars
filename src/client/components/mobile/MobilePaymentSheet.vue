<template>
  <div class="mobile-play-sheet" data-test="payment-sheet">
    <div class="mobile-play-sheet-scrim" data-test="payment-sheet-scrim" @click="close"></div>
    <section
      ref="panel"
      class="mobile-play-sheet-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="$t(playerinput.title)"
      tabindex="-1"
      @keydown.esc="close">
      <span class="mobile-play-sheet-grabber" aria-hidden="true"></span>
      <div class="mobile-play-sheet-body">
        <h2 class="mobile-confirm-sheet-title" data-test="payment-sheet-title">{{ $t(playerinput.title) }}</h2>
        <section class="mobile-play-sheet-pay">
          <div class="mobile-play-sheet-eyebrow" data-test="payment-sheet-cost">{{ message('Pay ${0} M€', cost) }}</div>
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
      </div>
      <div class="mobile-play-sheet-actions">
        <p v-if="reason !== undefined"
          class="mobile-play-sheet-reason"
          :class="{'mobile-play-sheet-reason--problem': reason.problem}"
          data-test="payment-sheet-reason">{{ reason.text }}</p>
        <button
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          :disabled="!canSubmit"
          data-test="payment-sheet-submit"
          @click="submit">{{ message('Pay · ${0} M€', payment.megacredits) }}</button>
        <button
          type="button"
          class="mobile-play-sheet-button"
          data-test="payment-sheet-cancel"
          @click="close">{{ $t((playerinput.optional === true || entry !== undefined) ? 'Cancel' : 'Close') }}</button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import {Ledger, PAYMENT_UNIT_DESCRIPTIONS, paymentProblem, paymentUnitIconClass, remainingMegacredits, totalSpent} from '@/client/components/PaymentLedger';
import {computeDefaultPayment} from '@/client/components/PaymentDefaults';
import {paymentResponse, selectPaymentOrder} from '@/client/components/mobile/PaymentSheet';
import {PaymentWidgetMixin} from '@/client/mixins/PaymentWidgetMixin';
import {postPlayerInput} from '@/client/utils/playerInputRequest';
import {SpendableResource} from '@/common/inputs/Spendable';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Units} from '@/common/Units';

type Reason = {text: string, problem: boolean};

type DataModel = {
  submitting: boolean;
};

/*
 * The sheet a price is paid in when that is the whole question: the cards bought
 * after drawing, a fee, a card's extra cost.
 *
 * It is drawn like the play sheet's payment: a row with − and + for every unit the
 * price may be paid with, the M€ that make up the rest, and one blue button that
 * says what it pays. Every rule is the desktop's `SelectPayment`: the units it
 * offers, the ledger, the first payment offered, and why a payment is refused.
 */
export default defineComponent({
  name: 'MobilePaymentSheet',
  mixins: [PaymentWidgetMixin],
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    /** The question: the price, and what it may be paid with. */
    playerinput: {
      type: Object as PropType<SelectPaymentModel>,
      required: true,
    },
    /** The option of the choice the price is asked for, or undefined for the question itself. */
    entry: {
      type: Number,
      default: undefined,
    },
  },
  emits: ['close'],
  data(): DataModel {
    return {
      submitting: false,
    };
  },
  created() {
    this.cost = this.playerinput.amount;
    this.payment = computeDefaultPayment(this.cost, this.order, this.ledger, /* reserveMegacredits= */ false);
  },
  computed: {
    order(): ReadonlyArray<SpendableResource> {
      return selectPaymentOrder(this.playerinput);
    },
    ledger(): Ledger {
      return this.buildLedger(this.order, this.playerinput.reserveUnits ?? Units.EMPTY);
    },
    /* The units with a stepper: those the player has any of. M€ is whatever the rest leaves. */
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
    problem(): string | undefined {
      return this.cost === 0 ? undefined : paymentProblem(this.payment, this.cost, this.order, this.ledger);
    },
    canSubmit(): boolean {
      return !this.submitting && this.problem === undefined;
    },
    /* The one line above the button: why it cannot be pressed, or what pressing it
       will overpay by. */
    reason(): Reason | undefined {
      if (this.problem !== undefined) {
        return {text: this.$t(this.problem), problem: true};
      }
      const overpaid = this.spent - this.cost;
      if (overpaid > 0) {
        return {text: this.message('Overpaying by ${0} M€', overpaid), problem: false};
      }
      return undefined;
    },
  },
  mounted() {
    const panel = this.$refs.panel as HTMLElement | undefined;
    panel?.focus({preventScroll: true});
  },
  methods: {
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
     * Whether one more `unit` could go towards the price. Once the M€ are down to
     * nothing and the price is met, one more unit can only overspend it by a whole
     * unit, which `paymentProblem` refuses; so the button stops there.
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
    async submit(): Promise<void> {
      if (!this.canSubmit) {
        return;
      }
      this.submitting = true;
      try {
        if (await postPlayerInput(this, this.playerView, paymentResponse(this.entry, this.payment))) {
          this.$emit('close');
        }
      } finally {
        this.submitting = false;
      }
    },
    close(): void {
      this.$emit('close');
    },
  },
});
</script>
