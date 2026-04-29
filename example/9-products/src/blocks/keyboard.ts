import {BlockKeyboard, LabelKeyboard} from "gramstax"

export class KeyboardBlock extends BlockKeyboard {
  static label = class extends LabelKeyboard {
    static home = {default: `🏠 Home`, id: `🏠 Beranda`}
    static back = {default: `⬅️ Back`, id: `⬅️ Kembali`}
    static cancel = {default: `✖️ Cancel`, id: `✖️ Batal`}
    static prev = {default: `⬅️ Prev`, id: `⬅️ Sebelumnya`}
    static next = {default: `➡️ Next`, id: `➡️ Berikutnya`}
    static refresh = {default: `🔄 Refresh`, id: `🔄 Segarkan`}
    static search = {default: `🔍 Search`, id: `🔍 Cari`}
    static cart = {default: `🛒 Cart`, id: `🛒 Keranjang`}
    static categories = {default: `📂 Categories`, id: `📂 Kategori`}
  }
  static home = (lang?: string, type?: string) => this._build(`home`, lang, type)
  static back = (lang?: string, type?: string) => this._build(`back`, lang, type)
  static cancel = (lang?: string, type?: string) => this._build(`cancel`, lang, type)
  static prev = (lang?: string, type?: string) => this._build(`prev`, lang, type)
  static next = (lang?: string, type?: string) => this._build(`next`, lang, type)
  static refresh = (lang?: string, type?: string) => this._build(`refresh`, lang, type)
  static search = (lang?: string, type?: string) => this._build(`search`, lang, type)
  static cart = (lang?: string, type?: string) => this._build(`cart`, lang, type)
  static categories = (lang?: string, type?: string) => this._build(`categories`, lang, type)
}