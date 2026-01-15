import {LabelKeyboard} from "gramstax"

export class KeyboardLabel extends LabelKeyboard {
  static home(lang?: string) {
    return this._build(lang, false, {
      default: `.. Home`
    })
  }

  static back(lang?: string) {
    return this._build(lang, false, {
      default: `Back`
    })
  }

  static cancel(lang?: string) {
    return this._build(lang, false, {
      default: `Cancel`
    })
  }
}
