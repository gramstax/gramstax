import {BlockKeyboard, LabelKeyboard} from "gramstax"

export class KeyboardBlock extends BlockKeyboard {
  static label = class extends LabelKeyboard {
    static home = {default: `🏠 Home`}
    static browse = {default: `🔎 Browse`}
    static cart = {default: `🛒 Cart`}
    static history = {default: `🧾 History`}
    static help = {default: `❓ Help`}
    static back = {default: `⬅️ Back`}
    static prev = {default: `⬅️ Prev`}
    static next = {default: `➡️ Next`}
    static buy = {default: `✅ Buy Now`}
    static addCart = {default: `➕ Add Cart`}
    static checkout = {default: `💳 Checkout`}
    static clear = {default: `🧹 Clear`}
    static confirm = {default: `✅ Confirm`}
    static cancel = {default: `❌ Cancel`}
    static remove = {default: `🗑️ Remove`}
    static plus = {default: `➕`}
    static minus = {default: `➖`}
    static continueShopping = {default: `${this.browse.default}`}
    static cancelHome = {default: `${this.cancel.default} | ${this.home.default}`}
  }

  static home = (lang?: string, type?: string) => this._build(`home`, lang, type)
  static browse = (lang?: string, type?: string) => this._build(`browse`, lang, type)
  static cart = (lang?: string, type?: string) => this._build(`cart`, lang, type)
  static history = (lang?: string, type?: string) => this._build(`history`, lang, type)
  static help = (lang?: string, type?: string) => this._build(`help`, lang, type)
  static back = (lang?: string, type?: string) => this._build(`back`, lang, type)
  static cancel = (lang?: string, type?: string) => this._build(`cancel`, lang, type)
}
