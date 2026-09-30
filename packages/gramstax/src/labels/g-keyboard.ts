/**
 * Provides static utilities for keyboard data manipulation, specifically for reversing keyboard button order.
 *
 * @remarks
 * Used as base class for user-defined keyboard data classes.
 * Provides button order manipulation for multi-language keyboards.
 *
 * @example
 * ```typescript
 * import { LabelGKeyboard } from "gramstax";
 *
 * export class KeyboardGLabel extends LabelGKeyboard {
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
 * const kbl = KeyboardGLabel
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
export class LabelGKeyboard {
  /**
   * Reverse the order of comma-separated button labels.
   *
   * @param input - Comma-separated button labels. Escaped commas (`\,`) are preserved.
   * @returns Reversed comma-separated labels.
   *
   * @example
   * ```typescript
   * const reversed = LabelGKeyboard._reverse("Back, Next, Submit");
   * // => "Submit, Next, Back"
   *
   * // Escaped commas are preserved
   * const preserved = LabelGKeyboard._reverse("Option A\\, B, Option C");
   * // => "Option C, Option A\\, B"
   * ```
   * @public
   */
  static _reverse(input: string) {
    const esc = `\u0000`
    return input
      .replace(/(?<!\\)\\,/g, esc)
      .split(/, */)
      .reverse()
      .join(`, `)
      .replace(new RegExp(esc, `g`), `\\,`)
  }

  /**
   * Reverse button order for all languages in an object.
   *
   * @param input - Object with language keys and button values. Applies {@link LabelGKeyboard._reverse} to each value.
   * @returns Object with reversed labels.
   *
   * @example
   * ```typescript
   * const reversed = LabelGKeyboard._reverseObj({
   *   en: "Back, Next",
   *   id: "Kembali, Lanjut",
   * });
   * // => { en: "Next, Back", id: "Lanjut, Kembali" }
   * ```
   * @public
   */
  static _reverseObj<T extends Record<string, string>>(input: T): T {
    return Object.keys(input).reduce((acc, key: string) => {
      const typedKey = key as keyof T
      acc[typedKey] = this._reverse(input[typedKey]!) as T[typeof typedKey]
      return acc
    }, {} as T)
  }
}
