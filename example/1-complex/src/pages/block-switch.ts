import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class BlockSwitchPage extends PageBase {
  static data = this.buildData((status?: string) => [status])

  async show(status: string) {
    const kb = this.inlineKeyboardT([this.data.callback(status === `1` ? `0` : `1`), StartPage], `1`, null, {status})
    await this.edit(kb, {status})
  }

  async callback() {
    await this.show(`0`)
  }

  async callbackPayload() {
    await this.show(this.callbackDataPayload)
  }

  static template = `
    <base>
      <keyboard>
        <switch value="status">
          <case is="1">Off</case>
          <default>On</default>
        </switch>,
        ${this.kbl.back.default}
      </keyboard>
      <keyboard lang="id">
        <switch value="status">
          <case is="1">Mati</case>
          <default>Nyala</default>
        </switch>,
        ${this.kbl.back.id}
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
