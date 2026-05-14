import {KeyboardBlock} from "../blocks/keyboard.js"
import {CtxCore} from "../core/ctx.js"

export class PageBase extends CtxCore {
  static kbk = KeyboardBlock
  static kbl = KeyboardBlock.label
}
