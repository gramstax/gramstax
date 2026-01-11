import {KeyboardComponent} from "~/components/keyboard"
import {CtxCore} from "~/core/ctx"

export abstract class PageBase extends CtxCore {
  static kbc = KeyboardComponent
  static kbd = KeyboardComponent.data

  ikb(...args: Parameters<typeof this.inlineKeyboard>) {
    return this.inlineKeyboard(...args)
  }

  bkb(...args: Parameters<typeof this.bottomKeyboard>) {
    return this.bottomKeyboard(...args)
  }
}
