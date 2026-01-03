import {GuardBase} from "~/base/guard"
import {GeneralErrorPage} from "~/pages/general-error"

export class UserGuard extends GuardBase {
  async ensureValid() {
    try {
      // override language_code
      const lang = await this.cacheData.get(`${this.userId}:lang`)
      if (lang) {
        this.userLanguage = lang
      }

      return true
    } catch (err) {
      await new GeneralErrorPage(this).transition(`ensureValid`, err, true)
      return null
    }
  }
}
