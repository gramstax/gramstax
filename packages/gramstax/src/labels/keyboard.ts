export class LabelKeyboard {
  static _reverse(input: string) {
    return input
      .split(/(?<!\\), */)
      .reverse()
      .join(`, `)
  }

  static _reverseObj(input: any) {
    return Object.keys(input).reduce((acc: any, key: string) => {
      acc[key] = this._reverse(input[key])
      return acc
    }, {})
  }

  static _build(lang: string | undefined, reverse: boolean | undefined, obj: any): string {
    if (lang) {
      const v = obj[lang || ``]
      return reverse ? this._reverse(v) : v
    }
    return reverse ? this._reverseObj(obj) : obj
  }
}
