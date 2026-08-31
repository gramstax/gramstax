import {BlockGKeyboard, LabelGKeyboard} from "gramstax"

export class KeyboardGBlock extends BlockGKeyboard {
  static label = class extends LabelGKeyboard {
    static home = {default: `🏠 Home`, id: `🏠 Beranda`}
    static back = {default: `⬅️ Back`, id: `⬅️ Kembali`}
    static cancel = {default: `✖️ Cancel`, id: `✖️ Batal`}
    static cancelHome = {default: `${this.cancel.default}, ${this.home.default}`, id: `${this.cancel.id}, ${this.home.id}`}
    static broadcastConfirm = {default: `✅ Send, ✏️ Edit, ${this.cancelHome.default}`, id: `✅ Kirim, ✏️ Edit, ${this.cancelHome.id}`}
  }

  static home = (lang?: string, type?: string) => this._build(`home`, lang, type)
  static back = (lang?: string, type?: string) => this._build(`back`, lang, type)
  static cancel = (lang?: string, type?: string) => this._build(`cancel`, lang, type)
  static cancelHome = (lang?: string, type?: string) => this._build(`cancelHome`, lang, type)
  static broadcastConfirm = (lang?: string, type?: string) => this._build(`broadcastConfirm`, lang, type)
}
