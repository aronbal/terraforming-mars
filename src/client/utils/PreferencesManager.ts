/** How the mobile shell is chosen: by viewport width, or forced on or off. */
export const MOBILE_LAYOUT_MODES = ['auto', 'on', 'off'] as const;
export type MobileLayoutMode = typeof MOBILE_LAYOUT_MODES[number];

/** When the mobile tag row is shown: on the Cards tab only, everywhere, or nowhere. */
export const TAG_ROW_MODES = ['auto', 'always', 'never'] as const;
export type TagRowMode = typeof TAG_ROW_MODES[number];

/*
 * What tapping a card on the mobile Cards tab does: open it large enough to read, or
 * go straight to playing it. Reading first is the default, because a mis-tap that
 * plays a card costs a turn.
 */
export const CARD_TAP_MODES = ['magnify', 'play'] as const;
export type CardTapMode = typeof CARD_TAP_MODES[number];

export const MIN_CARD_SCALE = 0.4;
export const MAX_CARD_SCALE = 1;

export type Preferences = {
  learner_mode: boolean,
  enable_sounds: boolean,
  magnify_cards: boolean,
  show_alerts: boolean,
  hide_hand: boolean,
  hide_awards_and_milestones: boolean,
  show_milestone_details: boolean,
  show_award_details: boolean,
  hide_top_bar: boolean,
  small_cards: boolean,
  remove_background: boolean,
  hide_active_cards: boolean,
  hide_automated_cards: boolean,
  hide_event_cards: boolean,
  hide_tile_confirmation: boolean,
  hide_discount_on_cards: boolean,
  hide_animated_sidebar: boolean,
  debug_view: boolean,
  symbol_overlay: boolean,
  animated_title: boolean,
  experimental_ui: boolean,
  mobile_layout: MobileLayoutMode,
  tag_row: TagRowMode,
  card_tap: CardTapMode,
  card_scale: number,
  action_sheet_peek: boolean,
  mobile_tap_targets: boolean,
  lang: string,
}

export type Preference = keyof Preferences;

const defaults: Preferences = {
  learner_mode: true,
  enable_sounds: true,
  magnify_cards: true,
  show_alerts: true,
  lang: 'en',

  hide_hand: false,
  hide_awards_and_milestones: false,
  show_milestone_details: true,
  show_award_details: true,
  hide_top_bar: false,
  small_cards: false,
  remove_background: false,
  hide_active_cards: false,
  hide_automated_cards: false,
  hide_event_cards: false,
  hide_tile_confirmation: false,
  hide_discount_on_cards: false,
  hide_animated_sidebar: false,

  symbol_overlay: false,
  animated_title: true,

  mobile_layout: 'auto',
  tag_row: 'auto',
  card_tap: 'magnify',
  card_scale: 0.62,
  action_sheet_peek: true,
  mobile_tap_targets: false,

  experimental_ui: false,
  debug_view: false,
};

/**
 * Preferences whose value is not a boolean.
 *
 * `PreferencesDialog` renders every boolean preference as a switch and mirrors it onto a
 * `preferences_<name>` body class; these are the ones it has to leave alone.
 */
const NON_BOOLEAN_PREFERENCES: ReadonlySet<Preference> = new Set<Preference>(['lang', 'mobile_layout', 'tag_row', 'card_tap', 'card_scale']);

export type BooleanPreference = {[K in Preference]: Preferences[K] extends boolean ? K : never}[Preference];

export function isBooleanPreference(key: Preference): key is BooleanPreference {
  return !NON_BOOLEAN_PREFERENCES.has(key);
}

/**
 * Mirrors the boolean preferences onto the page as `preferences_<name>` classes.
 *
 * A dozen stylesheets key off those classes, so a preference that is only written to
 * storage is a preference that does nothing until the next reload. Whatever changes
 * one has to call this.
 */
export function applyPreferenceClasses(values: Readonly<Preferences> = getPreferences()): void {
  const target = document.getElementById('ts-preferences-target');
  if (target === null) {
    return;
  }
  for (const key of Object.keys(values) as Array<Preference>) {
    if (!isBooleanPreference(key)) {
      continue;
    }
    target.classList.toggle('preferences_' + key, values[key]);
  }
  if (!target.classList.contains('language-' + values.lang)) {
    target.classList.add('language-' + values.lang);
  }
}

function asMode<T extends string>(modes: ReadonlyArray<T>, val: string | boolean | number, fallback: T): T {
  const candidate = String(val) as T;
  return modes.includes(candidate) ? candidate : fallback;
}

function asCardScale(val: string | boolean | number): number {
  const parsed = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(parsed)) {
    return defaults.card_scale;
  }
  return Math.min(MAX_CARD_SCALE, Math.max(MIN_CARD_SCALE, parsed));
}

export class PreferencesManager {
  public static INSTANCE = new PreferencesManager();
  private readonly _values: Preferences;

  private localStorageSupported(): boolean {
    return typeof localStorage !== 'undefined';
  }

  public static resetForTest() {
    this.INSTANCE = new PreferencesManager();
  }

  private constructor() {
    this._values = {...defaults};
    for (const key of Object.keys(defaults) as Array<Preference>) {
      const value = this.localStorageSupported() ? localStorage.getItem(key) : undefined;
      if (value) {
        this._set(key, value);
      }
    }
  }

  private _set(key: Preference, val: string | boolean | number) {
    switch (key) {
    case 'lang':
      this._values.lang = String(val);
      break;
    case 'mobile_layout':
      this._values.mobile_layout = asMode(MOBILE_LAYOUT_MODES, val, defaults.mobile_layout);
      break;
    case 'tag_row':
      this._values.tag_row = asMode(TAG_ROW_MODES, val, defaults.tag_row);
      break;
    case 'card_tap':
      this._values.card_tap = asMode(CARD_TAP_MODES, val, defaults.card_tap);
      break;
    case 'card_scale':
      this._values.card_scale = asCardScale(val);
      break;
    default:
      this._values[key] = typeof(val) === 'boolean' ? val : (val === '1');
    }
  }

  private _serialize(key: Preference): string {
    const value = this._values[key];
    return typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
  }

  // Making this Readonly means that it's Typescript-impossible to
  // set preferences through the fields themselves.
  values(): Readonly<Preferences> {
    return this._values;
  }

  set(name: Preference, val: string | boolean | number, setOnChange = false): void {
    // Don't set values if nothing has changed.
    if (setOnChange && this._values[name] === val) {
      return;
    }
    this._set(name, val);
    if (this.localStorageSupported()) {
      localStorage.setItem(name, this._serialize(name));
    }
  }
}

export function getPreferences(): Readonly<Preferences> {
  return PreferencesManager.INSTANCE.values();
}
