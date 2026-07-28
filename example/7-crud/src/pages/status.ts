import {LogHe} from "~/helpers/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class StatusPage extends PageBase {
  constructorName?: string

  constructor(p: any) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  berror = {
    show: async (funcName: string, error: any, isEdit = true) => {
      LogHe.errorMake(error, this.constructorName, funcName)

      await this.clearSession()
      const kb = this.inlineKeyboardT([StartPage])
      const da = {isNotFound: false}
      await this.renderAuto(kb, da, null, null, isEdit)
    }
  }
  berrorInputNotFound = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage])
      const da = {isNotFound: true}
      await this.render(kb, da)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.home()}
      <g-message>
        {~isNotFound ? "🔎 Route not found" : "❌ Something went wrong"~}

        {~isNotFound ? "Use Home to return to the main menu and try a different action." : "Please try again in a moment, or return Home if the issue persists."~}
      </g-message>
    </g-base>
  `
}
