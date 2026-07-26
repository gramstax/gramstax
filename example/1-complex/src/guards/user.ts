import {GuardBase} from "~/base/guard"
import {StatusPage} from "~/pages/status"

export class UserGuard extends GuardBase {
  async _catch(err: any, func: any) {
    await new StatusPage(this).berror.show(func, err, true)
    return null
  }

  async overrideLang() {
    try {
      // override language_code
      const lang = await this.cacheData.get(`${this.from!.id}:lang`)
      if (lang) {
        this.from!.language_code = lang
      }

      return true
    } catch (err) {
      return await this._catch(err, `ensureValid`)
    }
  }
}
