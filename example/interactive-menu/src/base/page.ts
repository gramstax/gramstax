import {KeyboardComponent} from "~/components/keyboard"
import {CtxCore} from "~/core/ctx"

// Base page for interactive menu examples.
export abstract class PageBase extends CtxCore {
  static kbc = KeyboardComponent
  static kbd = KeyboardComponent.data
}
