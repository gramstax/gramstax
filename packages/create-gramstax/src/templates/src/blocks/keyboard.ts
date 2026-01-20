import {BlockKeyboard, LabelKeyboard} from "gramstax"

export class KeyboardBlock extends BlockKeyboard {
  static label = class extends LabelKeyboard {
    static home = {default: `Home`, it: `Casa`, id: `Beranda`}
    static back = {default: `.. Back`, it: `.. Ritorno`, id: `.. Kembali`}
  }
  static home = (lang?: string, type?: string) => this._build(`home`, lang, type)
  static back = (lang?: string, type?: string) => this._build(`back`, lang, type)
}
