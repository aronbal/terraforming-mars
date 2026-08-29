/**
 * Stable identifiers for the entries in a player's action menu.
 *
 * `PlayerInput.annotation` is free-form, but the action menu built by
 * `Player.getActions` uses these values so that code which has to reason about
 * a menu entry (the computer opponent, mainly) can recognise it without
 * matching on display titles, which are user-facing and translated.
 */
export const ACTION_ANNOTATIONS = [
  'milestone',
  'award',
  'convertPlants',
  'convertHeat',
  'actionCard',
  'ceoAction',
  'projectCard',
  'standardProject',
  'sellPatents',
  'endTurn',
  'pass',
  'undo',
  'turmoilParty',
  'sendDelegate',
  'tradeWithColony',
] as const;

export type ActionAnnotation = typeof ACTION_ANNOTATIONS[number];
