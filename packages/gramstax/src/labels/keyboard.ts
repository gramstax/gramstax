/**
 * Provides static utilities for keyboard data manipulation, specifically for reversing keyboard button order.
 *
 * @remarks
 * Used as base class for user-defined keyboard data classes.
 * Provides button order manipulation for multi-language keyboards.
 *
 * @example
 * ```typescript
 * import { LabelKeyboard } from "gramstax";
 *
 * export class KeyboardLabel extends LabelKeyboard {
 *   static backNext(lang?: string) {
 *     return this._build(lang, false, {
 *       en: "Back, Next",
 *       id: "Kembali, Lanjut",
 *     });
 *   }
 * }
 * ```
 *
 * @public
 */
export class LabelKeyboard {
  /**
   * Reverse the order of comma-separated button labels.
   *
   * @param input - Comma-separated button labels. Escaped commas (`\,`) are preserved.
   * @returns Reversed comma-separated labels.
   *
   * @example
   * ```typescript
   * const reversed = LabelKeyboard._reverse("Back, Next, Submit");
   * // => "Submit, Next, Back"
   *
   * // Escaped commas are preserved
   * const preserved = LabelKeyboard._reverse("Option A\\, B, Option C");
   * // => "Option C, Option A\\, B"
   * ```
   * @internal
   */
  static _reverse(input: string) {
    return input
      .split(/(?<!\\), */)
      .reverse()
      .join(`, `)
  }

  /**
   * Reverse button order for all languages in an object.
   *
   * @param input - Object with language keys and button values. Applies {@link LabelKeyboard._reverse} to each value.
   * @returns Object with reversed labels.
   *
   * @example
   * ```typescript
   * const reversed = LabelKeyboard._reverseObj({
   *   en: "Back, Next",
   *   id: "Kembali, Lanjut",
   * });
   * // => { en: "Next, Back", id: "Lanjut, Kembali" }
   * ```
   * @internal
   */
  static _reverseObj(input: any) {
    return Object.keys(input).reduce((acc: any, key: string) => {
      acc[key] = this._reverse(input[key])
      return acc
    }, {})
  }

  /**
   * Build keyboard string with optional language selection and reversal.
   *
   * @param lang - Target language code. If provided, returns only that language value.
   * @param reverse - Whether to reverse button order. If true, applies {@link LabelKeyboard._reverse} to result.
   * @param obj - Object with language keys. Structure is `{ en: "...", id: "...", ... }`.
   * @returns String if `lang` provided, object otherwise.
   *
   * @example
   * ```typescript
   * const keyboards = {
   *   en: "Back, Next",
   *   id: "Kembali, Lanjut",
   * };
   *
   * // Get specific language
   * LabelKeyboard._build("en", false, keyboards);
   * // => "Back, Next"
   *
   * // Get specific language reversed
   * LabelKeyboard._build("en", true, keyboards);
   * // => "Next, Back"
   *
   * // Get all languages
   * LabelKeyboard._build(undefined, false, keyboards);
   * // => { en: "Back, Next", id: "Kembali, Lanjut" }
   * ```
   * @internal
   */
  static _build(lang: string | undefined, reverse: boolean | undefined, obj: any): string {
    if (lang) {
      const v = obj[lang || ``]
      return reverse ? this._reverse(v) : v
    }
    return reverse ? this._reverseObj(obj) : obj
  }
}
