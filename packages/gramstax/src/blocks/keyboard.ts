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
 * import { BlockKeyboard, LabelKeyboard } from "gramstax";
 *
 * class KeyboardLabel extends LabelKeyboard {
 *   static backNext(lang?: string) {
 *     return this._build(lang, false, {
 *       en: "Back, Next",
 *       id: "Kembali, Lanjut",
 *     });
 *   }
 * }
 *
 * class KeyboardBlock extends BlockKeyboard {
 *   static label = KeyboardLabel;
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
   * Generate keyboard template blocks from an object of language-keyed values.
   *
   * @param obj - Object with language keys. Structure is `{ en: "...", id: "..." }`.
   * @param params - Configuration parameters for keyboard generation.
   * @param params.type - Keyboard type. Values are `"inline"` or `"bottom"`. Defaults to `"inline"`.
   * @param params.lang - Target language. If set, returns single language block.
   * @param params.reverse - Reverse button order. If true, reverses comma-separated labels.
   * @returns HTML-like `<keyboard>` block(s) as string.
   *
   * @example
   * ```typescript
   * const obj = { en: "Back, Next", id: "Kembali, Lanjut" };
   *
   * // All languages
   * BlockKeyboard._process(obj, { type: "inline" });
   * // => `<keyboard type="inline" lang="en">Back, Next</keyboard> <keyboard type="inline" lang="id">Kembali, Lanjut</keyboard>`
   *
   * // Single language
   * BlockKeyboard._process(obj, { type: "inline", lang: "en" });
   * // => `<keyboard type="inline" lang="en">Back, Next</keyboard>`
   *
   * // Reversed
   * BlockKeyboard._process(obj, { type: "inline", reverse: true });
   * // => `<keyboard type="inline" lang="en">Next, Back</keyboard> ...`
   * ```
   * @internal
   */
  static _process(obj: any, params: {type?: string; lang?: string; reverse?: boolean}) {
    if (!params.type) {
      params.type = `inline`
    }

    if (params.lang) {
      const v = obj[params.lang]
      return `
        <keyboard type="${params.type}" lang="${params.lang}">${params.reverse ? this.label._reverse(v) : v}</keyboard>
      `
    }
    return Object.keys(obj)
      .map((lang) => {
        const v = obj[lang]
        return `
          <keyboard type="${params.type}" lang="${lang}">${params.reverse ? this.label._reverse(v) : v}</keyboard>
        `
      })
      .join(` `)
  }

  /**
   * Build keyboard blocks by calling a method from the linked `LabelKeyboard`.
   *
   * @param key - Method name in LabelKeyboard. Must exist or throws.
   * @param lang - Target language. If set, returns single language block.
   * @param type - Keyboard type. Values are `"inline"` or `"bottom"`. Defaults to `"inline"`.
   * @returns Keyboard block string.
   *
   * @throws Error if {@link BlockKeyboard.label} is not set.
   * @throws Error if the specified method name does not exist in the label class.
   *
   * @example
   * ```typescript
   * // Assuming BlockKeyboard.label = MyKeyboards with backNext() method
   *
   * BlockKeyboard._build("backNext");
   * // => '<keyboard type="inline" lang="en">Back, Next</keyboard> ...'
   *
   * BlockKeyboard._build("backNext", "en", "bottom");
   * // => '<keyboard type="bottom" lang="en">Back, Next</keyboard>'
   * ```
   * @internal
   */
  static _build(key: string, lang?: string, type?: string) {
    if (!this.label) {
      throw new Error(`Label not found, make sure set this.label from class extends LabelKeyboard`)
    }
    const func = (this.label as any)[key]
    if (!func) {
      throw new Error(`Function ${key} not found`)
    }
    return this._process(func.call(this.label, undefined), {type, lang})
  }
}
