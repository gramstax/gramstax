import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Help page describing navigation rules.
export class HelpPage extends PageBase {
  static data = this.buildData((payload?: string) => [payload])

  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, StartPage.data.callback())
    })
  }

  async to(isEdit = true) {
    if (isEdit) {
      await this.edit(this.kb(), {}, `help`)
      return
    }

    await this.reply(this.kb(), {}, `help`)
  }

  async callback() {
    await this.to(true)
  }

  static template = `
    <base>
      ${this.kbc.back()}
      <message>
        Help & Navigation

        - Use inline buttons to drill into menus.
        - Use the bottom keyboard for quick actions.
        - Pagination buttons appear when lists are long.
      </message>
    </base>

    <base id="help">
      <message>
        Need a refresher? Choose Menu to start again.
      </message>
    </base>
  `
}
