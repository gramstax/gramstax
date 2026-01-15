import {LabelKeyboard} from "gramstax"

export class KeyboardLabel extends LabelKeyboard {
  static home(lang) {
    return this._build(lang, false, {
      default: `.. Home`
    })
  }

  static back(lang) {
    return this._build(lang, false, {
      default: `Back`
    })
  }

  static cancel(lang) {
    return this._build(lang, false, {
      default: `Cancel`
    })
  }
}
