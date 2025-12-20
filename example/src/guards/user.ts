import { GuardBase } from "~/base"
import { GeneralErrorPage } from "~/pages/general-error"

export class UserGuard extends GuardBase {
  public async ensureValid() {
    try {
      // override language_code
      const lang = await this.cacheData.get(`${this.userId}:lang`)
      if (lang) {
        this.userLanguage = lang
      }

      return true
    } catch (err) {
      await new GeneralErrorPage(this).transition(this.constructor.name, `ensureValid`, err, true)
      return null
    }
  }
}
