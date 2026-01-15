import {KeyboardData} from "~/data/keyboard"
import {ComponentKeyboard} from "gramstax"

export class KeyboardPartial extends ComponentKeyboard {
  static data = KeyboardData
  static home(lang?: string, type?: string) {
    return this._build(`home`, lang, type)
  }
  static back(lang?: string, type?: string) {
    return this._build(`back`, lang, type)
  }
  static cancel(lang?: string, type?: string) {
    return this._build(`cancel`, lang, type)
  }
  static refresh(lang?: string, type?: string) {
    return this._build(`refresh`, lang, type)
  }
  static refreshBack(lang?: string, type?: string) {
    return this._build(`refreshBack`, lang, type)
  }
  static backRefresh(lang?: string, type?: string) {
    return this._build(`backRefresh`, lang, type)
  }
}
