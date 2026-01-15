import {KeyboardLabel} from "~/labels/keyboard"
import {BlockKeyboard} from "gramstax"

// Block template keyboard.
export class KeyboardBlock extends BlockKeyboard {
  static label = KeyboardLabel

  static home(lang, type) {
    return this._build(`home`, lang, type)
  }

  static back(lang, type) {
    return this._build(`back`, lang, type)
  }

  static cancel(lang, type) {
    return this._build(`cancel`, lang, type)
  }
}
