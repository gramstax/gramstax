import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class BlockSwitchPage extends PageBase {
  public static data = this.buildData((status?: string) => status)
  
  public kb(status: string) {
    return this.inlineKeyboard(
      (kb, arr) => {
        return kb //
          .text(arr[0]!, this.data.callbackData(status === `1` ? `0` : `1`))
          .row()
          .text(arr[1]!, StartPage.data.callbackData())
      },
      { data: { status } }
    )
  }

  public async internal(status: string) {
    await this.edit(this.kb(status), { status })
  }

  public async callback() {
    await this.internal(`0`)
  }

  public async callbackPayload() {
    await this.internal(this.callbackDataPayload)
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard>
        <switch value="status">
          <case is="1">Off</case>
          <default>On</default>
        </switch>,
        ${this.kbd.back(`default`)}
      </keyboard>
      <keyboard lang="id">
        <switch value="status">
          <case is="1">Mati</case>
          <default>Nyala</default>
        </switch>,
        ${this.kbd.back(`id`)}
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
