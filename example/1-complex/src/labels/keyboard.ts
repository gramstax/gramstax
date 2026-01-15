import {LabelKeyboard} from "gramstax"

export class KeyboardLabel extends LabelKeyboard {
  static home(lang?: string) {
    return this._build(lang, false, {
      default: `.. Home`,
      id: `.. Beranda`
    })
  }

  static back(lang?: string) {
    return this._build(lang, false, {
      default: `Back`,
      id: `Kembali`
    })
  }

  static cancel(lang?: string) {
    return this._build(lang, false, {
      default: `Cancel`,
      id: `Batal`
    })
  }

  static refresh(lang?: string) {
    return this._build(lang, false, {
      default: `Refresh`,
      id: `Segarkan`
    })
  }

  static refreshBack(lang?: string, reverse?: boolean) {
    return this._build(lang, reverse, {
      default: `${this.refresh(`default`)}, ${this.back(`default`)}`,
      id: `${this.refresh(`id`)}, ${this.back(`id`)}`
    })
  }

  static backRefresh(lang?: string) {
    return this.refreshBack(lang, true)
  }
}
