import { KeyboardComponent } from "~/components/keyboard"
import { CtxCore } from "~/core/ctx"

export abstract class PageBase extends CtxCore {
  public static KbCom = KeyboardComponent
  public static KbData = KeyboardComponent.data
}
