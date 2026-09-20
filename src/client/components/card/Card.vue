<template>
  <div class="card-container filterDiv hover-hide-res" :class="cardClasses">
      <div class="card-content-wrapper" v-i18n @mouseover="hovering = true" @mouseleave="hovering = false">
          <div v-if="!isStandardProject" class="card-cost-and-tags">
              <CardCost :amount="cost" :newCost="reducedCost" />
              <div v-if="showPlayerCube" :class="playerCubeClass"></div>
              <CardHelp v-if="hasHelpText" :name="card.name" :hovering="hovering" />
              <CardTags :tags="tags" />
          </div>
          <CardTitle :title="card.name" :type="cardType"/>
          <CardContent
              :metadata="cardMetadata"
              :requirements="cardRequirements"
              :isCorporation="isCorporationCard"
              :bottomPadding="bottomPadding" />
      </div>
      <CardExpansion :expansion="cardExpansion" :isCorporation="isCorporationCard" :isResourceCard="isResourceCard" :compatibility="cardCompatibility" />
      <CardResourceCounter v-if="hasResourceType" :amount="resourceAmount" :type="resourceType" />
      <CardVictoryPoints v-if="cardMetadata.victoryPoints" :victoryPoints="cardMetadata.victoryPoints" />
      <CardExtraContent :card="card" />
      <slot></slot>
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';

import {CardModel} from '@/common/models/CardModel';
import {CARD_HELP_TEXT} from '@/client/cards/CardHelpText';
import CardTitle from './CardTitle.vue';
import CardResourceCounter from './CardResourceCounter.vue';
import CardCost from './CardCost.vue';
import CardExtraContent from './CardExtraContent.vue';
import CardExpansion from './CardExpansion.vue';
import CardTags from './CardTags.vue';
import CardVictoryPoints from './CardVictoryPoints.vue';
import CardContent from './CardContent.vue';
import CardHelp from './CardHelp.vue';
import {CardType} from '@/common/cards/CardType';
import {CardMetadata} from '@/common/cards/CardMetadata';
import {Tag} from '@/common/cards/Tag';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {CardResource} from '@/common/CardResource';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {Color} from '@/common/Color';
import {CardRequirementDescriptor} from '@/common/cards/CardRequirementDescriptor';
import {GameModule} from '@/common/cards/GameModule';
import {mobileLayout} from '@/client/utils/useMobileLayout';


export default defineComponent({
  name: 'Card',
  components: {
    CardTitle,
    CardHelp,
    CardResourceCounter,
    CardCost,
    CardExtraContent,
    CardExpansion,
    CardTags,
    CardContent,
    CardVictoryPoints,
  },
  props: {
    card: {
      type: Object as () => CardModel,
      required: true,
    },
    actionUsed: {
      type: Boolean,
      required: false,
      default: false,
    },
    robotCard: {
      type: Object as () => CardModel | undefined,
      required: false,
    },
    // Cube is only shown when actionUsed is true.
    cubeColor: {
      type: String as () => Color,
      required: false,
      default: 'neutral',
    },
    // When true, the card is automatically sized regardless of hover.
    autoTall: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    const cardName = this.card.name;
    const card = getCardOrThrow(cardName);

    return {
      cardInstance: card,
      hovering: false,
      sizeObserver: undefined as ResizeObserver | undefined,
    };
  },
  computed: {
    cardExpansion(): GameModule {
      return this.cardInstance.module;
    },
    cardCompatibility(): Array<GameModule> {
      return this.cardInstance.compatibility;
    },
    isResourceCard(): boolean {
      if (this.cardInstance.resourceType !== undefined) {
        return true;
      } else {
        return false;
      }
    },
    tags(): Array<Tag> {
      const type = this.cardType;
      const tags = [...this.cardInstance.tags || []];
      tags.forEach((tag, idx) => {
        // Clone are changed on card implementations but that's not passed down directly through the
        // model, however, it sends down the `cloneTag` field. So this function does the substitution.
        if (tag === Tag.CLONE && this.card.cloneTag !== undefined) {
          tags[idx] = this.card.cloneTag;
        }
      });
      if (type === CardType.EVENT) {
        tags.push(Tag.EVENT);
      }
      return tags;
    },
    cost(): number | undefined {
      return this.isProjectCard ? this.cardInstance.cost : undefined;
    },
    reducedCost(): number | undefined {
      return this.isProjectCard ? this.card.calculatedCost : undefined;
    },
    cardType(): CardType {
      return this.cardInstance.type;
    },
    cardClasses(): string {
      const classes = [];
      classes.push('card-' + this.card.name.toLowerCase().replaceAll(' ', '-'));

      if (this.card.isDisabled) {
        classes.push('card-unavailable');
      } else if (!getPreferences().experimental_ui && this.actionUsed) {
        classes.push('card-unavailable');
      }

      if (this.isStandardProject) {
        classes.push('card-standard-project');
      }
      if (this.autoTall) {
        classes.push('card-auto-tall');
      } else if (getPreferences().experimental_ui) {
        classes.push('card-hover-tall');
      }
      const learnerModeOff = !getPreferences().learner_mode;
      if (learnerModeOff && this.isStandardProject && this.card.isDisabled) {
        classes.push('card-hide');
      }
      return classes.join(' ');
    },
    cardMetadata(): CardMetadata {
      return this.cardInstance.metadata;
    },
    cardRequirements(): ReadonlyArray<CardRequirementDescriptor> | undefined {
      return this.cardInstance.requirements;
    },
    resourceAmount(): number {
      return this.card.resources || this.robotCard?.resources || 0;
    },
    isCorporationCard() : boolean {
      return this.cardType === CardType.CORPORATION;
    },
    isProjectCard(): boolean {
      const type = this.cardType;
      return type === CardType.AUTOMATED || type === CardType.ACTIVE || type === CardType.EVENT;
    },
    isStandardProject() : boolean {
      return this.cardType === CardType.STANDARD_PROJECT || this.cardType === CardType.STANDARD_ACTION;
    },
    hasResourceType(): boolean {
      return this.card.isSelfReplicatingRobotsCard === true || this.cardInstance.resourceType !== undefined || this.robotCard !== undefined;
    },
    resourceType(): CardResource {
      if (this.robotCard !== undefined || this.card.isSelfReplicatingRobotsCard === true) {
        return CardResource.RESOURCE_CUBE;
      }
      // This last RESOURCE_CUBE is functionally unnecessary and serves to satisfy the type contract.
      return this.cardInstance.resourceType ?? CardResource.RESOURCE_CUBE;
    },
    bottomPadding(): string {
      if (this.cardMetadata.victoryPoints !== undefined) {
        return 'long';
      }
      if (this.hasResourceType) {
        return 'short';
      }
      return '';
    },
    hasHelpText(): boolean {
      return CARD_HELP_TEXT[this.card.name] !== undefined;
    },
    showPlayerCube(): boolean {
      return getPreferences().experimental_ui && this.actionUsed;
    },
    playerCubeClass(): string {
      return `board-cube board-cube--${this.cubeColor}`;
    },
  },
  methods: {
    /*
     * Publishes the card's own size, so the shell can reserve room for the scaled
     * card without scaling the card's type down with it. See `mobile_shell.less`.
     *
     * `offsetWidth` and `offsetHeight` are the layout box, which a transform does not
     * touch, so this reads the card's full size however small it is being drawn -- and
     * the margins computed from it never feed back into the measurement.
     */
    publishNaturalSize(): void {
      const el = this.$el as HTMLElement | undefined;
      if (el === undefined || el.style === undefined) {
        return;
      }
      /*
       * A card in a pane the shell has mounted but not shown has no box at all, and
       * measures zero. Publishing that would ask the shell to reserve no room for it;
       * leaving the properties unset uses the printed card size until the pane is
       * opened, which is what the observer below is watching for.
       */
      if (el.offsetWidth === 0 || el.offsetHeight === 0) {
        return;
      }
      el.style.setProperty('--card-natural-w', `${el.offsetWidth}px`);
      el.style.setProperty('--card-natural-h', `${el.offsetHeight}px`);
    },
  },
  mounted() {
    // Desktop draws cards at their own size, so there is nothing to publish and no
    // reason to put an observer on every card in a tableau.
    if (!mobileLayout.value || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.publishNaturalSize();
    // A card grows when a resource counter or a victory point badge appears on it.
    this.sizeObserver = new ResizeObserver(() => this.publishNaturalSize());
    this.sizeObserver.observe(this.$el as HTMLElement);
  },
  unmounted() {
    this.sizeObserver?.disconnect();
    this.sizeObserver = undefined;
  },
});

</script>
