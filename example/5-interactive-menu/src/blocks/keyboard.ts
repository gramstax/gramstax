import {BlockKeyboard} from "gramstax"
import {KeyboardLabel} from "~/labels/keyboard"

// Block template keyboard block.
export class KeyboardBlock extends BlockKeyboard {
  static label = KeyboardLabel
  static home(lang?: string, type?: string) {
    return this._build(`home`, lang, type)
  }

  static back(lang?: string, type?: string) {
    return this._build(`back`, lang, type)
  }

  static browse(lang?: string, type?: string) {
    return this._build(`browse`, lang, type)
  }

  static help(lang?: string, type?: string) {
    return this._build(`help`, lang, type)
  }

  static reset(lang?: string, type?: string) {
    return this._build(`reset`, lang, type)
  }
}
