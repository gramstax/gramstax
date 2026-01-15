import {LabelKeyboard} from "gramstax"

// Keyboard data labels for inline menus.
export class KeyboardLabel extends LabelKeyboard {
  static menu(lang?: string) {
    return this._build(lang, false, {
      default: `Main Menu`
    })
  }

  static balance(lang?: string) {
    return this._build(lang, false, {
      default: `Balance`
    })
  }

  static deposit(lang?: string) {
    return this._build(lang, false, {
      default: `Deposit`
    })
  }

  static withdraw(lang?: string) {
    return this._build(lang, false, {
      default: `Withdraw`
    })
  }

  static transfer(lang?: string) {
    return this._build(lang, false, {
      default: `Transfer`
    })
  }

  static history(lang?: string) {
    return this._build(lang, false, {
      default: `History`
    })
  }
}
