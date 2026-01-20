import {LabelKeyboard} from "~/labels/keyboard"

/**
 * Provides static methods for generating keyboard template blocks from `LabelKeyboard` definitions.
 *
 * @remarks
 * This class generates HTML-like `<keyboard>` blocks for the template engine.
 * Requires `LabelKeyboard` to be set via {@link BlockKeyboard.label} before using {@link BlockKeyboard._build}.
 *
 * @example
 * ```typescript
 * // blocks/keyboard.ts
 * import { BlockKeyboard, LabelKeyboard } from "gramstax";
 *
 * class KeyboardBlock extends BlockKeyboard {
 *   static label = class extends LabelKeyboard {
 *     static backNext = {en: "Back, Next", id: "Kembali, Lanjut"}
 *   }
 *   static backNext = (lang?: string, type?: string) => this._build(`backNext`, lang, type)
 * }
 *
 * // base/page.ts
 * import {KeyboardBlock} from "~/blocks/keyboard"
 * export abstract class PageBase extends CtxCore {
 *   static kbk = KeyboardBlock
 *   static kbl = KeyboardBlock.label
 * }
 *
 * // pages/some.ts
 * import {PageBase} from "~/base/page"
 * export class SomePage extends PageBase {
 *   static template = `
 *     <base>
 *       ${this.kbk.backNext()}
 *       <message>Default message hello world</message>
 *     </base>
 *     <base id="others-id-1">
 *       <message>Message from others id 1 with keyboard from base id default</message>
 *     </base>
 *     <base id="others-id-2">
 *       <base>${this.kbk.backNext()}</base>
 *       <message>Message from others id 3 with keyboard in same base</message>
 *     </base>
 *   `
 * }
 * ```
 *
 * @public
 */
export class BlockKeyboard {
  /**
   * Reference to the `LabelKeyboard` class containing keyboard definitions.
   *
   * @remarks
   * Must be set before using {@link BlockKeyboard._build}.
   * @virtual
   */
  static label: typeof LabelKeyboard

  /**
   * Build keyboard blocks by calling a method from the linked `LabelKeyboard`.
   *
   * @param key - Method name in LabelKeyboard. Must exist or throws.
   * @param lang - Target language. If set, returns single language block.
   * @param type - Keyboard type. Values are `"inline"` or `"bottom"`. Defaults to `"inline"`.
   * @param reverse - Reverse button order. If true, reverses comma-separated labels.
   * @returns Keyboard block string.
   *
   * @throws Error if {@link BlockKeyboard.label} is not set.
   * @throws Error if the specified method name does not exist in the label class.
   *
   * @example
   * ```typescript
   * // Assuming BlockKeyboard.label = MyKeyboards with backNext() method
   *
   * const kbk = BlockKeyboard
   * kbk._build("backNext");
   * // => '<keyboard type="inline" lang="en">Back, Next</keyboard> ...'
   *
   * kbk._build("backNext", "en", "bottom");
   * // => '<keyboard type="bottom" lang="en">Back, Next</keyboard>'
   * ```
   * @internal
   */
  static _build(key: string, lang?: string, type?: string, reverse?: boolean) {
    if (!this.label) {
      throw new Error(`Label not found, make sure set this.label from class extends LabelKeyboard`)
    }

    if (!type) {
      type = `inline`
    }

    const obj = (this.label as any)[key]
    if (!obj) {
      throw new Error(`Object value ${key} not found`)
    }
    const pro = (v: string, lang: string) => `<keyboard type="${type}" lang="${lang}">${reverse ? this.label._reverse(v) : v}</keyboard>`
    return lang
      ? pro(obj[lang], lang)
      : Object.keys(obj)
          .map((lang) => pro(obj[lang], lang))
          .join(` `)
  }
}
