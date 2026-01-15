import {BlockKeyboard} from "gramstax"
import {KeyboardLabel} from "~/labels/keyboard"

export class KeyboardBlock extends BlockKeyboard {
  static label = KeyboardLabel
  static home(lang?: string, type?: string) {
    return this._build(`home`, lang, type)
  }

  static back(lang?: string, type?: string) {
    return this._build(`back`, lang, type)
  }

  static cancel(lang?: string, type?: string) {
    return this._build(`cancel`, lang, type)
  }

  static refresh(lang?: string, type?: string) {
    return this._build(`refresh`, lang, type)
  }

  static refreshBack(lang?: string, type?: string) {
    return this._build(`refreshBack`, lang, type)
  }

  static backRefresh(lang?: string, type?: string) {
    return this._build(`backRefresh`, lang, type)
  }
}
