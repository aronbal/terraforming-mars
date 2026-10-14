<template>
<section v-trim-whitespace>
  <table class="payments_table">
    <tbody>
      <tr>
        <td></td>
        <td v-trim-whitespace><i class="resource_icon payments_type_smallicon resource_icon--megacredits"></i></td>
      </tr>
      <template v-for="unit of order" :key="unit">
        <template v-if="ledger[unit]?.available > 0">
          <tr>
            <td>
              <PaymentUnitComponent
                v-model.number="payment[unit]"
                :unit="unit"
                :description="descriptions[unit]"
                :rate="ledger[unit].rate"
                @plus="addValue(unit)"
                @minus="reduceValue(unit)"
                @max="maxValue(unit)"/>
              <div v-if="ledger[unit]?.reserved" class="card-warning" v-i18n="$t(unit)">
              Some ${0} are reserved and unavailable here.</div>
            </td>
            <td class='payments_unit_subtotal' v-if="ledger[unit].rate !== undefined && payment[unit] !== 0" v-trim-whitespace>
              {{ ledger[unit].rate * payment[unit] }}
            </td>
          </tr>
        </template>
      </template>
    <tr :class="totalSpentClass()">
      <td class="payments_total_heading"></td>
      <td class="payments_total_value" :title="$t(totalSpentTitle())" :aria-label="$t(totalSpentTitle())" v-trim-whitespace>
        {{ totalSpent() }}
      </td>
    </tr>
    </tbody>
  </table>

  <div v-if="warning !== undefined" class="tm-warning">
    <label class="label label-error">{{ $t(warning) }}</label>
  </div>

  <div v-if="showsave" class="payments_save">
    <AppButton size="big" @click="handleSave()" :title="$t(buttonLabel)" data-test="save"/>
  </div>
</section>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Payment} from '@/common/inputs/Payment';
import {SpendableResource} from '@/common/inputs/Spendable';
import {getPreferences} from '@/client/utils/PreferencesManager';
import AppButton from '@/client/components/common/AppButton.vue';
import PaymentUnitComponent from '@/client/components/PaymentUnit.vue';
import {
  Ledger,
  PAYMENT_UNIT_DESCRIPTIONS,
  paymentProblem,
  remainingMegacredits,
  totalSpent,
} from '@/client/components/PaymentLedger';
import {computeDefaultPayment} from '@/client/components/PaymentDefaults';

type DataModel = {
  payment: Payment;
  warning: string | undefined;
};

export default defineComponent({
  name: 'PaymentForm',
  components: {
    AppButton,
    PaymentUnitComponent,
  },
  props: {
    cost: {
      type: Number,
      required: true,
    },
    // Rename to something related to how it is both display order and documents the
    // resources in use.
    order: {
      type: Array as () => ReadonlyArray<SpendableResource>,
      required: true,
    },
    ledger: {
      type: Object as () => Ledger,
      required: true,
    },
    showsave: {
      type: Boolean,
      default: false,
    },
    buttonLabel: {
      type: String,
      required: true,
    },
  },
  emits: ['save', 'change'],
  data(): DataModel {
    return {
      payment: computeDefaultPayment(this.cost, this.order, this.ledger, /* reserveMegacredits=*/ false),
      warning: undefined,
    };
  },
  computed: {
    descriptions(): Readonly<Record<SpendableResource, string>> {
      return PAYMENT_UNIT_DESCRIPTIONS;
    },
  },
  watch: {
    payment: {
      deep: true,
      immediate: true,
      handler(val: Payment) {
        this.$emit('change', val);
      },
    },
  },
  methods: {
    /**
     * Returns the most MC necessary, capped by the cost of the payment.
     */
    getMegaCreditsMax(): number {
      return Math.min(this.ledger['megacredits'].available, this.cost);
    },
    addValue(unit: SpendableResource): void {
      // MC is special-cased because it's the currency being spent.
      if (unit === 'megacredits') {
        if (this.payment[unit] < this.getMegaCreditsMax()) {
          this.payment[unit] += 1;
        }
      } else {
        if (this.payment[unit] < this.ledger[unit].available) {
          this.payment[unit] += 1;
          this.setRemainingMCValue();
        }
      }
    },
    reduceValue(unit: SpendableResource): void {
      if (this.payment[unit] > 0) {
        this.payment[unit] -= 1;
        if (unit !== 'megacredits') {
          this.setRemainingMCValue();
        }
      }
    },
    setRemainingMCValue(): void {
      this.payment.megacredits = remainingMegacredits(this.payment, this.cost, this.order, this.ledger);
    },
    maxValue(unit: SpendableResource): void {
      const target = Math.min(this.ledger[unit].available, Math.floor(this.cost / this.ledger[unit].rate));

      if (this.payment[unit] < target) {
        this.payment[unit] = target;

        if (unit !== 'megacredits') {
          this.setRemainingMCValue();
        } else {
          const saved = this.payment.megacredits;
          this.payment = computeDefaultPayment(this.cost, this.order, this.ledger, /* reserveMegacredits=*/ true);
          this.payment.megacredits = saved;
        }
      }
    },
    totalSpent(): number {
      return totalSpent(this.payment, this.order, this.ledger);
    },
    handleSave(): void {
      this.warning = undefined;
      if (this.cost === 0) {
        this.$emit('save', this.payment);
        return;
      }
      const problem = paymentProblem(this.payment, this.cost, this.order, this.ledger);
      if (problem !== undefined) {
        this.warning = problem;
        return;
      }
      const delta = this.totalSpent() - this.cost;
      if (delta > 0 && getPreferences().show_alerts) {
        if (!confirm('Warning: You are overpaying by ' + delta + ' M€')) {
          this.warning = 'Please adjust payment amount';
          return;
        }
      }
      this.$emit('save', this.payment);
    },
    totalSpentClass(): string {
      const total = this.totalSpent();
      if (total < this.cost) {
        return 'payments_total_under';
      } else if (total > this.cost) {
        return 'payments_total_over';
      } else {
        return 'payments_total_exact';
      }
    },
    totalSpentTitle(): string {
      const total = this.totalSpent();
      if (total < this.cost) {
        return 'Underpaying';
      } else if (total > this.cost) {
        return 'Overpaying';
      }
      return '';
    },
  },
});
</script>
