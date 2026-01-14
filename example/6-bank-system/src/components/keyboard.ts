import {ComponentKeyboard} from "gramstax"
import {KeyboardData} from "~/data/keyboard"

// Keyboard component helpers for templates.
export class KeyboardComponent extends ComponentKeyboard {
  static data = KeyboardData

  static menu(lang?: string, type?: string) {
    return this._build(`menu`, lang, type)
  }

  static balance(lang?: string, type?: string) {
    return this._build(`balance`, lang, type)
  }

  static deposit(lang?: string, type?: string) {
    return this._build(`deposit`, lang, type)
  }

  static withdraw(lang?: string, type?: string) {
    return this._build(`withdraw`, lang, type)
  }

  static transfer(lang?: string, type?: string) {
    return this._build(`transfer`, lang, type)
  }

  static history(lang?: string, type?: string) {
    return this._build(`history`, lang, type)
  }
}
