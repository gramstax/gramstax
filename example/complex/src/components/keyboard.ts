import { KeyboardData } from "~/data/keyboard"
import { ComponentKeyboard } from "gramstax"

export class KeyboardComponent extends ComponentKeyboard {
  public static data = KeyboardData
  public static home(lang?: string, type?: string) {
    return this._build(`home`, lang, type)
  }

  public static back(lang?: string, type?: string) {
    return this._build(`back`, lang, type)
  }

  public static cancel(lang?: string, type?: string) {
    return this._build(`cancel`, lang, type)
  }

  public static refresh(lang?: string, type?: string) {
    return this._build(`refresh`, lang, type)
  }

  public static refreshBack(lang?: string, type?: string) {
    return this._build(`refreshBack`, lang, type)
  }

  public static backRefresh(lang?: string, type?: string) {
    return this._build(`backRefresh`, lang, type)
  }
}
