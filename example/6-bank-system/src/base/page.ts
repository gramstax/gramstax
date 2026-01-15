import {KeyboardPartial} from "~/partials/keyboard"
import {CtxCore} from "~/core/ctx"

// Base page to share helpers across pages.
export abstract class PageBase extends CtxCore {
  static kbp = KeyboardPartial
  static kbd = KeyboardPartial.data
}
