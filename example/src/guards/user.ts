import { CtxCore } from "../core/ctx"

export class UserGuard extends CtxCore {
  public async ensureValid() {
    try {
      // override language_code
      const lang = await this.cacheData.get(`${this.userId}:language`)
      if (lang) {
        this.userLanguage = lang
      }

      return true
    } catch (err) {
      console.log(`call error page (location:UserGuard): ${String(err)}`)
      return null
    }
  }
}
