import {CtxCore} from "~/core/ctx"
import {KeyboardBlock} from "~/blocks/keyboard"

export abstract class PageBase extends CtxCore {
  static kbk = KeyboardBlock
  static kbl = KeyboardBlock.label
}
