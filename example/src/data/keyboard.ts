import { DataKeyboard } from "gramstax"

export class KeyboardData extends DataKeyboard {
  public static home(lang?: string) {
    return this._build(lang, false, {
      default: `.. Home`,
      id: `.. Beranda`
    })
  }

  public static back(lang?: string) {
    return this._build(lang, false, {
      default: `Back`,
      id: `Kembali`
    })
  }

  public static cancel(lang?: string) {
    return this._build(lang, false, {
      default: `Cancel`,
      id: `Batal`
    })
  }

  public static refresh(lang?: string) {
    return this._build(lang, false, {
      default: `Refresh`,
      id: `Segarkan`
    })
  }

  public static refreshBack(lang?: string, reverse?: boolean) {
    return this._build(lang, reverse, {
      default: `${this.refresh(`default`)}, ${this.back(`default`)}`,
      id: `${this.refresh(`id`)}, ${this.back(`id`)}`
    })
  }

  public static backRefresh(lang?: string) {
    return this.refreshBack(lang, true)
  }
}
