import {getAward, getMilestone} from '@/client/MilestoneAwardManifest';
import {isActionMenu} from '@/client/components/mobile/MobileActionMenu';
import {Color} from '@/common/Color';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {Message} from '@/common/logs/Message';
import {AwardName} from '@/common/ma/AwardName';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';

/**
 * The question, when it is a choice between plain options and nothing else -- whose
 * plants to remove, whether to pay for something -- which the choice sheet answers.
 * The turn's menu is a choice too, but it is answered from the turn page.
 */
export function choiceInput(waitingFor: PlayerInputModel | undefined): OrOptionsModel | undefined {
  // Read into a plain boolean: as a type guard it would narrow away every `or`.
  const menu: boolean = isActionMenu(waitingFor);
  if (waitingFor?.type !== 'or' || menu) {
    return undefined;
  }
  if (waitingFor.options.length < 2 || waitingFor.options.some((option) => option.type !== 'option')) {
    return undefined;
  }
  return waitingFor;
}

/** Where a player stands in the award or milestone an option is about. */
export type Standing = {
  name: string;
  color: Color | undefined;
  score: number;
};

/** What an option about an award or a milestone is about, for the sheet to explain. */
export type BoardRule = {
  kind: 'award' | 'milestone';
  name: AwardName | MilestoneName;
  /** What it is won by, in the rules' words. */
  description: string;
  /** Everyone's score in it, when the option says. */
  standings: Array<Standing>;
};

/**
 * The award or milestone `option` is about, with its rule and the scores the option
 * lists -- Asimov's `Fund Incorporator award [Aron: 3 / Green: 0]`, say -- or undefined
 * for any other option. Only the name is matched; the rule comes from the client's
 * own manifest, so it reads the same as it does under the board.
 */
export function boardRuleIn(option: PlayerInputModel, players: ReadonlyArray<{name: string, color: Color}>): BoardRule | undefined {
  const title = option.title;
  if (typeof title === 'string') {
    return undefined;
  }
  const award = title.data.find((datum) => datum.type === LogMessageDataType.AWARD);
  const milestone = title.data.find((datum) => datum.type === LogMessageDataType.MILESTONE);
  const named = award ?? milestone;
  if (named === undefined) {
    return undefined;
  }
  const kind = award !== undefined ? 'award' : 'milestone';
  const name = named.value as AwardName | MilestoneName;
  const description = kind === 'award' ? getAward(name as AwardName)?.description : getMilestone(name as MilestoneName)?.description;
  if (description === undefined) {
    return undefined;
  }
  return {kind, name, description, standings: standingsIn(title, players)};
}

/** Reads `Name: 3 / Other: 0` out of the option's text, best first as the server wrote it. */
function standingsIn(title: Message, players: ReadonlyArray<{name: string, color: Color}>): Array<Standing> {
  for (const datum of title.data) {
    if (datum.type !== LogMessageDataType.STRING || typeof datum.value !== 'string') {
      continue;
    }
    const parts = datum.value.split(' / ').map((part) => /^(.+): (-?\d+)$/.exec(part));
    const matched = parts.filter((part): part is RegExpExecArray => part !== null);
    if (matched.length === 0 || matched.length !== parts.length) {
      continue;
    }
    return matched.map(([, name, score]) =>
      ({name, color: players.find((player) => player.name === name)?.color, score: Number(score)}));
  }
  return [];
}
