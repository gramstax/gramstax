import {GuardBase} from "~/base/guard"
import {GeneralStatusPage} from "~/pages/general-status"

export class UserGuard extends GuardBase {
  async _catch(err: any, func: any) {
    await new GeneralStatusPage(this).berror.show(func, err, true)
    return null
  }

  async overrideLang() {
    try {
      // override language_code
      const lang = await this.cacheData.get(`${this.userId}:lang`)
      if (lang) {
        this.userLanguage = lang
      }

      return true
    } catch (err) {
      return await this._catch(err, `ensureValid`)
    }
  }
}
