import {KeyboardGBlock} from "~/blocks/g-keyboard"
import {CtxCore} from "~/core/ctx"

export abstract class PageBase extends CtxCore {
  static kbk = KeyboardGBlock
  static kbl = KeyboardGBlock.label
}
