import {BlockKeyboard, LabelKeyboard} from "gramstax"

// Block template keyboard block.
export class KeyboardBlock extends BlockKeyboard {
  static label = class extends LabelKeyboard {
    static home = {default: `🏠 Home`}
    static back = {default: `⬅️ Back`}
    static browse = {default: `🔎 Browse`}
    static help = {default: `❓ Help`}
    static reset = {default: `♻️ Reset`}
    static prev = {default: `⬅️ Prev`}
    static next = {default: `➡️ Next`}
  }
  static home = (lang?: string, type?: string) => this._build(`home`, lang, type)
  static back = (lang?: string, type?: string) => this._build(`back`, lang, type)
  static browse = (lang?: string, type?: string) => this._build(`browse`, lang, type)
  static help = (lang?: string, type?: string) => this._build(`help`, lang, type)
  static reset = (lang?: string, type?: string) => this._build(`reset`, lang, type)
  static prev = (lang?: string, type?: string) => this._build(`prev`, lang, type)
  static next = (lang?: string, type?: string) => this._build(`next`, lang, type)
}
