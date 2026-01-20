import {BlockKeyboard, LabelKeyboard} from "gramstax"

// Block template keyboard.
export class KeyboardBlock extends BlockKeyboard {
  static label = class extends LabelKeyboard {
    static home = {default: `.. Home`}
    static back = {default: `Back`}
    static cancel = {default: `Cancel`}
  }
  static home = (lang?: string, type?: string) => this._build(`home`, lang, type)
  static back = (lang?: string, type?: string) => this._build(`back`, lang, type)
  static cancel = (lang?: string, type?: string) => this._build(`cancel`, lang, type)
}
