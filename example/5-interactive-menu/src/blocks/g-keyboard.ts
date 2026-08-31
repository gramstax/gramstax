import {BlockGKeyboard, LabelGKeyboard} from "gramstax"

// Block template keyboard block.
export class KeyboardGBlock extends BlockGKeyboard {
  static label = class extends LabelGKeyboard {
    static home = {default: `🏠 Home`, id: `🏠 Beranda`}
    static back = {default: `⬅️ Back`, id: `⬅️ Kembali`}
    static browse = {default: `🔎 Browse`, id: `🔎 Jelajahi`}
    static help = {default: `❓ Help`, id: `❓ Bantuan`}
    static reset = {default: `♻️ Reset`, id: `♻️ Atur Ulang`}
    static prev = {default: `⬅️ Prev`, id: `⬅️ Sebelumnya`}
    static next = {default: `➡️ Next`, id: `➡️ Selanjutnya`}
  }
  static home = (lang?: string, type?: string) => this._build(`home`, lang, type)
  static back = (lang?: string, type?: string) => this._build(`back`, lang, type)
  static browse = (lang?: string, type?: string) => this._build(`browse`, lang, type)
  static help = (lang?: string, type?: string) => this._build(`help`, lang, type)
  static reset = (lang?: string, type?: string) => this._build(`reset`, lang, type)
  static prev = (lang?: string, type?: string) => this._build(`prev`, lang, type)
  static next = (lang?: string, type?: string) => this._build(`next`, lang, type)
}
