import {KeyboardBlock} from "~/blocks/keyboard"
import {CtxCore} from "~/core/ctx"

// Base page to share helpers across pages.
export abstract class PageBase extends CtxCore {
  static kbk = KeyboardBlock
  static kbl = KeyboardBlock.label
}
