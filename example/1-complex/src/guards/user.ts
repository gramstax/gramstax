import {GuardBase} from "~/base/guard"
import {StatusPage} from "~/pages/status"

export class UserGuard extends GuardBase {
  async _catch(err: Error | unknown, func: string) {
    await new StatusPage(this).berror.show(func, err)
    return null
  }

  async overrideLang() {
    try {
      // override language_code
      const lang = await this.cacheData.get(`${this.from!.id}:lang`)
      if (lang) {
        this.from!.language_code = lang as string
      }

      return true
    } catch (err) {
      return await this._catch(err, `ensureValid`)
    }
  }
}
