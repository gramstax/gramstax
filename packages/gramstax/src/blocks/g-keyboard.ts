/**
 * Keyboard block builder — generates `<g-keyboard>` template blocks.
 *
 * @remarks
 * Converts {@link LabelGKeyboard} definitions into HTML-like template strings
 * for the template engine. Requires `BlockGKeyboard.label` to be set before
 * calling build methods.
 *
 * @public
 */

import type {LabelGKeyboard} from "~/labels/g-keyboard"

/**
 * Provides static methods for generating keyboard template blocks from `LabelGKeyboard` definitions.
 *
 * @remarks
 * This class generates HTML-like `<g-keyboard>` blocks for the template engine.
 * Requires `LabelGKeyboard` to be set via {@link BlockGKeyboard.label} before using {@link BlockGKeyboard._build}.
 *
 * @example
 * ```typescript
 * // blocks/g-keyboard.ts
 * import { BlockGKeyboard, LabelGKeyboard } from "gramstax";
 *
 * class KeyboardGBlock extends BlockGKeyboard {
 *   static label = class extends LabelGKeyboard {
 *     static backNext = {en: "Back, Next", id: "Kembali, Lanjut"}
 *   }
 *   static backNext = (lang?: string, type?: string) => this._build(`backNext`, lang, type)
 * }
 *
 * // base/page.ts
 * import {KeyboardGBlock} from "~/blocks/g-keyboard"
 * export abstract class PageBase extends CtxCore {
 *   static kbk = KeyboardGBlock
 *   static kbl = KeyboardGBlock.label
 * }
 *
 * // pages/some.ts
 * import {PageBase} from "~/base/page"
 * export class SomePage extends PageBase {
 *   static template = `
 *     <g-base>
 *       ${this.kbk.backNext()}
 *       <g-message>Default message hello world</g-message>
 *     </g-base>
 *     <g-base id="others-id-1">
 *       <g-message>Message from others id 1 with keyboard from base id default</g-message>
 *     </g-base>
 *     <g-base id="others-id-2">
 *       <g-base>${this.kbk.backNext()}</g-base>
 *       <g-message>Message from others id 3 with keyboard in same base</g-message>
 *     </g-base>
 *   `
 * }
 *
 * // understanding example
 * this.kbk.backNext() // will show all language with block template
 * this.kbk.backNext("id") // will show all language only (lang="id") with block template
 * this.kbk.backNext("default") // will show all language only (lang="default" or without lang) with block template
 * ```
 *
 * @public
 */
export class BlockGKeyboard {
  /**
   * Reference to the `LabelGKeyboard` class containing keyboard definitions.
   *
   * @remarks
   * Must be set before using {@link BlockGKeyboard._build}.
   * @virtual
   */
  static label: typeof LabelGKeyboard

  /**
   * Build keyboard blocks by calling a method from the linked `LabelGKeyboard`.
   *
   * @param key - Method name in LabelGKeyboard. Must exist or throws.
   * @param lang - Target language. If set, returns single language block.
   * @param type - Keyboard type. Values are `"inline"` or `"bottom"`. Defaults to `"inline"`.
   * @param reverse - Reverse button order. If true, reverses comma-separated labels.
   * @returns Keyboard block string.
   *
   * @throws Error if {@link BlockGKeyboard.label} is not set.
   * @throws Error if the specified method name does not exist in the label class.
   *
   * @example
   * ```typescript
   * // Assuming BlockGKeyboard.label = MyKeyboards with backNext() method
   *
   * const kbk = BlockGKeyboard
   * kbk._build("backNext");
   * // => '<g-keyboard type="inline" lang="en">Back, Next</g-keyboard> ...'
   *
   * kbk._build("backNext", "en", "bottom");
   * // => '<g-keyboard type="bottom" lang="en">Back, Next</g-keyboard>'
   * ```
   * @public
   */
  static _build(key: string, lang?: string, type?: string, reverse?: boolean) {
    if (!this.label) {
      throw new Error(`Label not found, make sure set this.label from class extends LabelGKeyboard`)
    }

    if (!type) {
      type = `inline`
    }

    if (!Object.hasOwn(this.label, key)) {
      throw new Error(`Object value ${key} not found`)
    }
    const obj = this.label[key as keyof typeof LabelGKeyboard] as Record<string, string>
    if (lang !== undefined && !Object.hasOwn(obj, lang)) {
      throw new Error(`Language "${lang}" not found in label "${key}"`)
    }
    const pro = (v: string, lang: string) => `<g-keyboard type="${type}" lang="${lang}">${reverse ? this.label._reverse(v) : v}</g-keyboard>`

    return lang
      ? pro(obj[lang]!, lang)
      : Object.keys(obj)
          .map((lang) => pro(obj[lang]!, lang))
          .join(` `)
  }
}
