<template>
  <span class="mobile-party" data-test="party-row">
    <span class="mobile-party-head">
      <span class="mobile-party-swatch" :class="'mobile-party-swatch--' + slug" aria-hidden="true"></span>
      <span class="mobile-party-name">{{ $t(party.name) }}</span>
      <span v-if="party.name === turmoil.ruling" class="mobile-pill mobile-pill--pr" data-test="party-ruling" v-i18n>Ruling</span>
      <span v-if="party.name === turmoil.dominant" class="mobile-pill mobile-pill--accent" data-test="party-dominant" v-i18n>Dominant</span>
    </span>
    <!-- The delegates, the leader's colour first and ringed; a number beside a dot is
         how many of that colour sit there. -->
    <span class="mobile-party-delegates" data-test="party-delegates">
      <span v-if="delegates.length === 0" class="mobile-party-empty" v-i18n>No delegates</span>
      <span
        v-for="delegate in delegates"
        :key="delegate.color"
        class="mobile-party-delegate"
        :class="{'mobile-party-delegate--leader': delegate.color === party.partyLeader}">
        <i class="mobile-choice-standing-dot" :class="dotClass(delegate.color)"></i>
        <span v-if="delegate.number > 1" class="mobile-party-count">{{ delegate.number }}</span>
      </span>
    </span>
    <!-- What the party pays when it comes to power, and what it rules by while it holds it. -->
    <span v-if="agenda !== undefined" class="mobile-party-agenda">
      <span class="mobile-party-agenda-part">
        <span class="mobile-party-agenda-label" v-i18n>Bonus</span>
        <span class="mobile-party-agenda-art"><TurmoilAgenda :id="agenda.bonusId"/></span>
      </span>
      <span class="mobile-party-agenda-part">
        <span class="mobile-party-agenda-label" v-i18n>Policy</span>
        <span class="mobile-party-agenda-art"><TurmoilAgenda :id="agenda.policyId"/></span>
      </span>
    </span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import TurmoilAgenda from '@/client/components/turmoil/TurmoilAgenda.vue';
import {partyAgenda} from '@/client/components/turmoil/agendas';
import {Color} from '@/common/Color';
import {DelegatesModel, PartyModel, TurmoilModel} from '@/common/models/TurmoilModel';
import {Agenda} from '@/common/turmoil/Types';

/*
 * One Turmoil party as a row: its colour and name, whether it rules or leads, its
 * delegates, and its bonus and policy. The party sheet and the Turmoil panel under the
 * board both draw parties with it.
 */
export default defineComponent({
  name: 'MobilePartyRow',
  components: {
    TurmoilAgenda,
  },
  props: {
    party: {
      type: Object as PropType<PartyModel>,
      required: true,
    },
    turmoil: {
      type: Object as PropType<TurmoilModel>,
      required: true,
    },
  },
  computed: {
    slug(): string {
      return this.party.name.toLowerCase().split(' ').join('_');
    },
    delegates(): ReadonlyArray<DelegatesModel> {
      const leader = this.party.partyLeader;
      return [...this.party.delegates].sort((a, b) => Number(b.color === leader) - Number(a.color === leader));
    },
    agenda(): Agenda | undefined {
      return partyAgenda(this.turmoil, this.party.name);
    },
  },
  methods: {
    dotClass(color: Color): string {
      // The neutral delegates are drawn grey, as the board draws them.
      return color === 'neutral' ? 'mobile-choice-standing-dot--unknown' : 'player_bg_color_' + color;
    },
  },
});
</script>
