import {KeyboardGBlock} from "~/blocks/g-keyboard"
import {CtxCore} from "~/core/ctx"

// Base page for interactive menu examples.
export abstract class PageBase extends CtxCore {
  static kbk = KeyboardGBlock
  static kbl = KeyboardGBlock.label
}
