/**
 * Keyboard label definitions — base classes for keyboard data.
 *
 * @remarks
 * Provides {@link LabelKeyboard} which serves as the base class for
 * user-defined keyboard data. The `label()` static method extracts
 * button labels for use by the block keyboard builder.
 *
 * @public
 */

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
 *   static home = {
 *     id: "Rumah",
 *     en: "Home"
 *   }
 *   static backNext = {
 *     id: "Kembali, Lanjut",
 *     en: "Back, Next"
 *   }
 *   static oneTwo = this._reverseObj({
 *     id: "Satu, Dua",
 *     en: "One, Two"
 *   })
 *   static threeFour = {
 *     id: this._reverse("Tiga, Empat"),
 *     en: "Three, Four"
 *   }
 * }
 *
 * const kbl = KeyboardLabel
 * kbl.home.id // => "Rumah"
 * kbl.backNext.id // => "Kembali, Lanjut"
 * kbl.oneTwo.id // => "Dua, Satu"
 * kbl.oneTwo.en // => "Two, One"
 * kbl.threeFour.id // => "Empat, Tiga"
 * kbl.threeFour.en // => "Three, Four"
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
   * @public
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
   * @public
   */
  static _reverseObj<T extends Record<any, any>>(input: T): T {
    return Object.keys(input).reduce((acc: any, key: string) => {
      acc[key] = this._reverse(input[key])
      return acc
    }, {})
  }
}
