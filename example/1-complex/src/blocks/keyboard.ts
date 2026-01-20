import {BlockKeyboard, LabelKeyboard} from "gramstax"

// Block template keyboard.
export class KeyboardBlock extends BlockKeyboard {
  static label = class extends LabelKeyboard {
    static home = {default: `.. Home`, id: `.. Beranda`}
    static back = {default: `Back`, id: `Kembali`}
    static cancel = {default: `Cancel`, id: `Batal`}
    static refresh = {default: `Refresh`, id: `Segarkan`}
    static refreshBack = {
      default: `${this.refresh.default}, ${this.back.default}`,
      id: `${this.refresh.id}, ${this.back.id}`
    }
    static backRefresh = this._reverseObj(this.refreshBack)
  }
  static home = (lang?: string, type?: string) => this._build(`home`, lang, type)
  static back = (lang?: string, type?: string) => this._build(`back`, lang, type)
  static cancel = (lang?: string, type?: string) => this._build(`cancel`, lang, type)
  static refresh = (lang?: string, type?: string) => this._build(`refresh`, lang, type)
  static refreshBack = (lang?: string, type?: string) => this._build(`refreshBack`, lang, type)
  static backRefresh = (lang?: string, type?: string) => this._build(`backRefresh`, lang, type)
}
