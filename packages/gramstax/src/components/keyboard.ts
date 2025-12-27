import { DataKeyboard } from "~/data/keyboard"

export class ComponentKeyboard {
  public static data: typeof DataKeyboard
  public static _process(obj: any, params: { type?: string; lang?: string; reverse?: boolean }) {
    if (!params.type) {
      params.type = `inline`
    }

    if (params.lang) {
      const v = obj[params.lang]
      return /*jsx*/ `
        <keyboard type="${params.type}" lang="${params.lang}">${params.reverse ? this.data._reverse(v) : v}</keyboard>
      `
    }
    return Object.keys(obj)
      .map((lang) => {
        const v = obj[lang]
        return /*jsx*/ `
          <keyboard type="${params.type}" lang="${lang}">${params.reverse ? this.data._reverse(v) : v}</keyboard>
        `
      })
      .join(` `)
  }

  public static _build(key: string, lang?: string, type?: string) {
    if (!this.data) {
      throw new Error(`Data not found`)
    }
    const func = (this.data as any)[key]
    if (!func) {
      throw new Error(`Function ${key} not found`)
    }
    return this._process(func.call(this.data, lang), { type, lang })
  }
}
