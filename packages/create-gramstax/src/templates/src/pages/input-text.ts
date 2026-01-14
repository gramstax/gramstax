import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {SessionGuard} from "~/guards/session"

export class InputTextPage extends PageBase {
  static data = this.buildData({
    intentTextCommand: `input_text`
  })

  kb(baseId?: string) {
    return this.ikb((k, a) => {
      return k.text(a[0]!, StartPage.data.callback()), {baseId}
    })
  }

  async callback() {
    await this.sessionToTextFree()
    await this.edit(this.kb())
  }

  async textCommand() {
    await this.sessionToTextFree()
    await this.reply(this.kb())
  }

  async textFree() {
    const params = await new SessionGuard(this).ensureTextFree()
    if (params === null) {
      /**
       * Return "null" if you want the bot to continue to check for suitable route for the
       * "dynamicSpecific" and "dynamic" type with the route suffix "Free" or "free" (without session), for example: textFree, animationFree, free.
       *
       * Return "undefined"/void if you want the bot to stop checking for "dynamicSpecific" and "dynamic" route types.
       *
       * Returning undefined/void indicates the success of this rule. There are only two returns allowed for all routes: null and undefined / void.
       */
      return null
    }

    const baseId = `result`
    const data = {res: this.msgText}
    await this.reply(this.kb(baseId), data, baseId)
  }

  static template = `
    <base>
      ${this.kbc.cancel()}
      <message>Please input text you want view</message>
      <message lang="it">Inserisci il testo che vuoi vedere</message>      
      <message lang="id">Tolong masukan text yang ingin anda liat</message>
    </base>
    <base id="result">
      ${this.kbc.home()}
      <message>
        Result: {{res}}

        Please input other text to see difference result
      </message>
      <message lang="it">
        Risultato: {{res}}

        Inserisci un altro testo per vedere il risultato diverso
      </message>
      <message lang="id">
        Hasil: {{res}}

        Tolong masukan text lain untuk lihat hasil yang berbeda
      </message>
    </base>
  `
}
