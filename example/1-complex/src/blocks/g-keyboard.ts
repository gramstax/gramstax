import {BlockGKeyboard, LabelGKeyboard} from "gramstax"

// Block template keyboard.
export class KeyboardGBlock extends BlockGKeyboard {
  static label = class extends LabelGKeyboard {
    static home = {default: `🏠 Home`, id: `🏠 Beranda`}
    static back = {default: `⬅️ Back`, id: `⬅️ Kembali`}
    static cancel = {default: `✖️ Cancel`, id: `✖️ Batal`}
    static refresh = {default: `🔄 Refresh`, id: `🔄 Segarkan`}
    static refresh_back = {
      default: `${this.refresh.default}, ${this.back.default}`,
      id: `${this.refresh.id}, ${this.back.id}`
    }
    static back_refresh = this._reverseObj(this.refresh_back)
  }
  static home = (lang?: string, type?: string) => this._build(`home`, lang, type)
  static back = (lang?: string, type?: string) => this._build(`back`, lang, type)
  static cancel = (lang?: string, type?: string) => this._build(`cancel`, lang, type)
  static refresh = (lang?: string, type?: string) => this._build(`refresh`, lang, type)
  static refresh_back = (lang?: string, type?: string) => this._build(`refresh_back`, lang, type)
  static back_refresh = (lang?: string, type?: string) => this._build(`back_refresh`, lang, type)
}
