import { KbComHelp } from "~/helpers/component-keyboard"

export class KbCom extends KbComHelp {
  public static home(lang?: string, type = `inline`): string {
    return this._build(type, lang, false, {
      default: `.. Home`,
      id: `.. Beranda`
    })
  }

  public static back(lang?: string, type = `inline`): string {
    return this._build(type, lang, false, {
      default: `Back`,
      id: `Kembali`
    })
  }
}
