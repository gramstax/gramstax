import {log} from "gramstax"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class GeneralStatusPage extends PageBase {
  constructorName?: string
  constructor(p: any) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, StartPage.data.callbackData())
    })
  }

  async toError(funcName: string, error: any, isUpdate = true) {
    log.errorMake(error, this.constructorName, funcName)

    await this.sessionClear()
    const kb = this.kb()
    const id = `error`
    if (isUpdate === true) {
      await this.edit(kb, {}, id)
    } else {
      await this.reply(kb, {}, id)
    }
  }

  async toErrorInputNotFound() {
    await this.reply(this.kb(), {}, `error-input-notfound`)
  }

  static template = `
    <base>
      ${this.kbc.home()}
    </base>

    <base id="error">
      <message>
        <b>❌ Error</b>

        An unexpected error occurred.
        Please try again later.
      </message>
      <message lang="id">
        <b>❌ Kesalahan</b>

        Terjadi kesalahan yang tidak diharapkan.
        Silakan coba lagi nanti.
      </message>
    </base>

    <base id="error-input-notfound">
      <message>
        <b>❌ Not Found</b>
      </message>
      <message lang="id">
        <b>❌ Tidak Ditemukan</b>
      </message>
    </base>
  `
}
