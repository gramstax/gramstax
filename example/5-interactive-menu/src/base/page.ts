import {KeyboardBlock} from "~/blocks/keyboard"
import {CtxCore} from "~/core/ctx"

// Base page for interactive menu examples.
export abstract class PageBase extends CtxCore {
  static kbk = KeyboardBlock
  static kbl = KeyboardBlock.label
}
