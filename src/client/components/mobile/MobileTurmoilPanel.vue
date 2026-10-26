<template>
  <div class="mobile-turmoil" data-test="mobile-turmoil">
    <h3 class="mobile-eyebrow" v-i18n>Turmoil</h3>

    <!-- Who rules, by what, and who chairs. -->
    <div class="mobile-turmoil-ruling" data-test="turmoil-ruling">
      <span class="mobile-turmoil-ruling-text">
        <span class="mobile-stat-label" v-i18n>Ruling party</span>
        <span class="mobile-party-head">
          <span v-if="turmoil.ruling !== undefined" class="mobile-party-swatch" :class="'mobile-party-swatch--' + slug(turmoil.ruling)" aria-hidden="true"></span>
          <span class="mobile-party-name">{{ turmoil.ruling !== undefined ? $t(turmoil.ruling) : '–' }}</span>
        </span>
      </span>
      <span class="mobile-turmoil-chair">
        <span class="mobile-stat-label" v-i18n>Chairman</span>
        <i v-if="turmoil.chairman !== undefined" class="mobile-choice-standing-dot mobile-turmoil-dot" :class="dotClass(turmoil.chairman)" data-test="turmoil-chairman"></i>
        <span v-else>–</span>
      </span>
    </div>

    <!-- The global events on their way, nearest last, as the board lays them out. -->
    <div v-if="events.length > 0" class="mobile-list" data-test="turmoil-events">
      <div v-for="event in events" :key="event.when" class="mobile-row mobile-turmoil-event" data-test="turmoil-event">
        <span class="mobile-row-body">
          <span class="mobile-row-text">
            <span class="mobile-turmoil-when">{{ $t(event.when) }}</span>
            <span class="mobile-row-title">{{ $t(event.name) }}</span>
            <span v-if="event.description !== ''" class="mobile-row-subtitle mobile-more-wrap">{{ $t(event.description) }}</span>
          </span>
          <!-- The delegate it brings into play, and the party it then sets dominant. -->
          <span v-if="event.revealed !== undefined" class="mobile-turmoil-event-parties" aria-hidden="true">
            <span class="mobile-party-swatch" :class="'mobile-party-swatch--' + slug(event.revealed)"></span>
            <span v-if="event.current !== undefined" class="mobile-party-swatch" :class="'mobile-party-swatch--' + slug(event.current)"></span>
          </span>
        </span>
      </div>
    </div>

    <!-- Delegates not yet on the board: one free from the lobby each generation, the rest
         from the reserve. -->
    <div class="mobile-turmoil-pools">
      <span class="mobile-turmoil-pool" data-test="turmoil-lobby">
        <span class="mobile-stat-label" v-i18n>Lobby</span>
        <span class="mobile-party-delegates">
          <i v-for="(color, index) in turmoil.lobby" :key="index" class="mobile-choice-standing-dot mobile-turmoil-dot" :class="dotClass(color)"></i>
          <span v-if="turmoil.lobby.length === 0">–</span>
        </span>
      </span>
      <span class="mobile-turmoil-pool" data-test="turmoil-reserve">
        <span class="mobile-stat-label" v-i18n>Reserve</span>
        <span class="mobile-party-delegates">
          <span v-for="delegate in turmoil.reserve" :key="delegate.color" class="mobile-party-delegate">
            <i class="mobile-choice-standing-dot mobile-turmoil-dot" :class="dotClass(delegate.color)"></i>
            <span class="mobile-party-count">{{ delegate.number }}</span>
          </span>
        </span>
      </span>
    </div>

    <div class="mobile-turmoil-parties">
      <div v-for="party in turmoil.parties" :key="party.name" class="mobile-turmoil-party" data-test="turmoil-party">
        <MobilePartyRow :party="party" :turmoil="turmoil"/>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import MobilePartyRow from '@/client/components/mobile/MobilePartyRow.vue';
import {getGlobalEvent} from '@/client/turmoil/ClientGlobalEventManifest';
import {Color} from '@/common/Color';
import {TurmoilModel} from '@/common/models/TurmoilModel';
import {GlobalEventName} from '@/common/turmoil/globalEvents/GlobalEventName';
import {PartyName} from '@/common/turmoil/PartyName';

type EventRow = {
  when: string;
  name: GlobalEventName;
  description: string;
  revealed: PartyName | undefined;
  current: PartyName | undefined;
};

/*
 * Turmoil under the board, laid out for a phone: the ruling party and the chairman,
 * the global events coming, the delegates still to place, and each party with its
 * delegates, bonus and policy -- the same rows the party sheet chooses from.
 */
export default defineComponent({
  name: 'MobileTurmoilPanel',
  components: {
    MobilePartyRow,
  },
  props: {
    turmoil: {
      type: Object as PropType<TurmoilModel>,
      required: true,
    },
  },
  computed: {
    events(): Array<EventRow> {
      const events: Array<[string, GlobalEventName | undefined]> = [
        ['Distant', this.turmoil.distant],
        ['Coming', this.turmoil.coming],
        ['Current', this.turmoil.current],
      ];
      return events
        .filter((event): event is [string, GlobalEventName] => event[1] !== undefined)
        .map(([when, name]) => {
          const event = getGlobalEvent(name);
          return {
            when,
            name,
            description: event?.description ?? '',
            revealed: event?.revealedDelegate,
            current: event?.currentDelegate,
          };
        });
    },
  },
  methods: {
    slug(party: PartyName): string {
      return party.toLowerCase().split(' ').join('_');
    },
    dotClass(color: Color): string {
      return color === 'neutral' ? 'mobile-choice-standing-dot--unknown' : 'player_bg_color_' + color;
    },
  },
});
</script>
