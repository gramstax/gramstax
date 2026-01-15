import {LabelKeyboard} from "gramstax"

// Shared keyboard labels for inline/bottom keyboards.
export class KeyboardLabel extends LabelKeyboard {
  static home(lang?: string) {
    return this._build(lang, false, {
      default: `Home`
    })
  }

  static back(lang?: string) {
    return this._build(lang, false, {
      default: `Back`
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
}
