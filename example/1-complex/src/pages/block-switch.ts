import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class BlockSwitchPage extends PageBase {
  static data = this.buildData((status?: string) => [status])

  kb(status: string) {
    return this.inlineKeyboard(
      (k, a) => {
        return k //
          .text(a[0]!, this.data.callback(status === `1` ? `0` : `1`))
          .row()
          .text(a[1]!, StartPage.data.callback())
      },
      {data: {status}}
    )
  }

  async core(status: string) {
    await this.edit(this.kb(status), {status})
  }

  async callback() {
    await this.core(`0`)
  }

  async callbackPayload() {
    await this.core(this.callbackDataPayload)
  }

  static template = `
    <base>
      <keyboard>
        <switch value="status">
          <case is="1">Off</case>
          <default>On</default>
        </switch>,
        ${this.kbl.back(`default`)}
      </keyboard>
      <keyboard lang="id">
        <switch value="status">
          <case is="1">Mati</case>
          <default>Nyala</default>
        </switch>,
        ${this.kbl.back(`id`)}
      </keyboard>

      <message>
        <b>Switch data directly in template</b>

        <switch value="status">
          <case is="1">Active</case>
          <default>Inactive</default>
        </switch>
      </message>
      <message lang="id">
        <b>Pemetaan data langsung di template</b>

        <switch value="status">
          <case is="1">Aktif</case>
          <default>Tidak Aktif</default>
        </switch>
      </message>
    </base>
  `
}
