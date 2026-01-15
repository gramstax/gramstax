import {KeyboardPartial} from "~/partials/keyboard"
import {CtxCore} from "~/core/ctx"

// Base page for interactive menu examples.
export abstract class PageBase extends CtxCore {
  static kbp = KeyboardPartial
  static kbd = KeyboardPartial.data
}
