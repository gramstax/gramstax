import {BlockGKeyboard, LabelGKeyboard} from "gramstax"

export class KeyboardGBlock extends BlockGKeyboard {
  static label = class extends LabelGKeyboard {
    static home = {default: `🏠 Home`, id: `🏠 Beranda`}
    static back = {default: `⬅️ Back`, id: `⬅️ Kembali`}
    static cancel = {default: `✖️ Cancel`, id: `✖️ Batal`}
    static prev = {default: `⬅️ Prev`, id: `⬅️ Sebelumnya`}
    static next = {default: `➡️ Next`, id: `➡️ Berikutnya`}
  }
  static home = (lang?: string, type?: string) => this._build(`home`, lang, type)
  static back = (lang?: string, type?: string) => this._build(`back`, lang, type)
  static cancel = (lang?: string, type?: string) => this._build(`cancel`, lang, type)
  static prev = (lang?: string, type?: string) => this._build(`prev`, lang, type)
  static next = (lang?: string, type?: string) => this._build(`next`, lang, type)
}
