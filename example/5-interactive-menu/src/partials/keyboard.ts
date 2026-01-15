import {ComponentKeyboard} from "gramstax"
import {KeyboardData} from "~/data/keyboard"

// Partial template keyboard block.
export class KeyboardPartial extends ComponentKeyboard {
  static data = KeyboardData

  static menu(lang?: string, type?: string) {
    return this._build(`menu`, lang, type)
  }

  static browse(lang?: string, type?: string) {
    return this._build(`browse`, lang, type)
  }

  static help(lang?: string, type?: string) {
    return this._build(`help`, lang, type)
  }

  static reset(lang?: string, type?: string) {
    return this._build(`reset`, lang, type)
  }

  static back(lang?: string, type?: string) {
    return this._build(`back`, lang, type)
  }
}
