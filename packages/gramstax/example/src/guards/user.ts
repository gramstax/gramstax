import { CtxCore } from "../core/ctx"

export class UserGuard extends CtxCore {
  public async ensureValid() {
    try {
      // override language_code
      const lang = await this.cacheData.get(`${this.userid}:language`)
      if (lang) {
        this.languageCode = lang
      }

      return true
    } catch (err) {
      console.log(`call error page (location:UserGuard): ${String(err)}`)
      return null
    }
  }
}
