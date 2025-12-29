import { KeyboardComponent } from "~/components/keyboard"
import { CtxCore } from "~/core/ctx"

export abstract class PageBase extends CtxCore {
  public static kbc = KeyboardComponent
  public static kbd = KeyboardComponent.data
}
