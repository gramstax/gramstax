import {KeyboardBlock} from "~/blocks/keyboard"
import {CtxCore} from "~/core/ctx"

export class PageBase extends CtxCore {
  static kbk = KeyboardBlock
  static kbl = KeyboardBlock.label
}
