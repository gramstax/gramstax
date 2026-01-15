import {LabelKeyboard} from "gramstax"

// Shared keyboard labels for inline/bottom keyboards.
export class KeyboardLabel extends LabelKeyboard {
  static menu(lang?: string) {
    return this._build(lang, false, {
      default: `Menu`
    })
  }

  static browse(lang?: string) {
    return this._build(lang, false, {
      default: `Browse`
    })
  }

  static help(lang?: string) {
    return this._build(lang, false, {
      default: `Help`
    })
  }

  static reset(lang?: string) {
    return this._build(lang, false, {
      default: `Reset`
    })
  }

  static back(lang?: string) {
    return this._build(lang, false, {
      default: `Back`
    })
  }
}
