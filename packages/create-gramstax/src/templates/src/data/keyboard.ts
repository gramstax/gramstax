import { DataKeyboard } from "gramstax"

export class KeyboardData extends DataKeyboard {
  public static home(lang?: string) {
    return this._build(lang, false, {
      default: `Home`,
      it: `Casa`,
      id: `Beranda`
    })
  }

  public static back(lang?: string) {
    return this._build(lang, false, {
      default: `.. Back`,
      it: `.. Ritorno`,
      id: `.. Kembali`
    })
  }
}
