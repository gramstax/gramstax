import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class GeneralErrorInputNotFoundPage extends PageBase {
  kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData())
    })
  }

  async transition(session?: boolean) {
    if (session || this.session.method) {
      await this.reply(this.kb(), undefined, `session-error`)
      await this.sessionClear()
    } else {
      await this.reply(this.kb())
    }
  }

  static template = /*jsx*/ `
    <base>
      ${this.kbc.home()}
      <message>
        <b>❌ Not Found</b>
      </message>
      <message lang="id">
        <b>❌ Tidak Ditemukan</b>
      </message>
    </base>
    <base id="session-error">
      <message>
        <b>❌ Session Error</b>

        An error occurred while processing your request.
        Your session has an error.
      </message>
      <message lang="id">
        <b>❌ Kesalahan Sesi</b>

        Terjadi kesalahan saat memproses permintaan.
        Sesi Anda bermasalh.
      </message>
    </base>
  `
}
