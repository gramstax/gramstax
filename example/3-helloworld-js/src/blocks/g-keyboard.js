import {BlockGKeyboard, LabelGKeyboard} from "gramstax"

// Block template keyboard.
export class KeyboardGBlock extends BlockGKeyboard {
  static label = class extends LabelGKeyboard {
    static home = {default: `.. Home`}
    static back = {default: `Back`}
    static cancel = {default: `Cancel`}
  }
  static home = (lang, type) => this._build(`home`, lang, type)
  static back = (lang, type) => this._build(`back`, lang, type)
  static cancel = (lang, type) => this._build(`cancel`, lang, type)
}
