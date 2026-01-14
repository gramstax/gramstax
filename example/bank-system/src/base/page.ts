import {KeyboardComponent} from "~/components/keyboard"
import {CtxCore} from "~/core/ctx"

// Base page to share helpers across pages.
export abstract class PageBase extends CtxCore {
  static kbc = KeyboardComponent
  static kbd = KeyboardComponent.data
}
