export class HelperComponentKeyboard {
  public static _reverse(input: string) {
    return input
      .split(/(?<!\\), */)
      .reverse()
      .join(`, `)
  }

  public static _build(type: string, lang: string | undefined, reverse: boolean, obj: any): string {
    if (lang) {
      return reverse ? this._reverse(obj[lang]) : obj[lang]
    }
    return Object.keys(obj)
      .map((lang) => {
        return /*jsx*/ `
          <keyboard type="${type}" lang="${lang}">${reverse ? this._reverse(obj[lang]) : obj[lang]}</keyboard>
        `
      })
      .join(` `)
  }
}
