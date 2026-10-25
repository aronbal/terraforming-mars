<template>
<div class="payments_cont">
  <section v-trim-whitespace>
    <h3 class="payments_title">{{ $t(playerinput.title) }}</h3>
    <PaymentForm
      ref="paymentForm"
      :cost="cost"
      :order="order"
      :ledger="ledger"
      :showsave="showsave"
      :buttonLabel="playerinput.buttonLabel"
      @change="(p) => payment = p"
      @save="doSave"/>
  </section>
</div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Payment} from '@/common/inputs/Payment';
import {PaymentWidgetMixin} from '@/client/mixins/PaymentWidgetMixin';
import {SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectPaymentResponse} from '@/common/inputs/InputResponse';
import PaymentForm from '@/client/components/PaymentForm.vue';
import {Ledger} from '@/client/components/PaymentLedger';
import {Units} from '@/common/Units';
import {selectPaymentOrder} from '@/client/components/mobile/PaymentSheet';

export default defineComponent({
  name: 'SelectPayment',
  mixins: [PaymentWidgetMixin],
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectPaymentModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectPaymentResponse) => void,
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
    order(): ReadonlyArray<keyof Payment> {
      return selectPaymentOrder(this.playerinput);
    },
    ledger(): Ledger {
      return this.buildLedger(this.order, this.playerinput.reserveUnits ?? Units.EMPTY);
    },
  },
  components: {
    PaymentForm,
  },
  created() {
    this.cost = this.playerinput.amount;
  },
  methods: {
    saveData() {
      const paymentForm = this.$refs.paymentForm as {handleSave: () => void} | undefined;
      if (paymentForm !== undefined) {
        paymentForm.handleSave();
      } else {
        this.doSave();
      }
    },
    doSave() {
      this.onsave({type: 'payment', payment: this.payment});
    },
  },
});
</script>
