import {LabelKeyboard} from "gramstax"

export class KeyboardLabel extends LabelKeyboard {
  static home(lang?: string) {
    return this._build(lang, false, {
      default: `Home`,
      it: `Casa`,
      id: `Beranda`
    })
  }

  static back(lang?: string) {
    return this._build(lang, false, {
      default: `.. Back`,
      it: `.. Ritorno`,
      id: `.. Kembali`
    })
  }
}
