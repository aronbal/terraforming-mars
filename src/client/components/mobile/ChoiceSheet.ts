import {isActionMenu} from '@/client/components/mobile/MobileActionMenu';
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
