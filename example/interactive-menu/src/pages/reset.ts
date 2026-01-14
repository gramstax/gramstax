import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Reset state and return to main menu.
export class ResetPage extends PageBase {
  static data = this.buildData((payload?: string) => [payload])

  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, StartPage.data.callback())
    })
  }

  async to(isEdit = false) {
    await this.cacheState.delete(`${this.userId}:category`)
    await this.cacheState.delete(`${this.userId}:page`)
    await this.sessionClear()

    if (isEdit) {
      await this.edit(this.kb(), {}, `reset`)
      return
    }

    await this.reply(this.kb(), {}, `reset`)
  }

  async callback() {
    await this.to(true)
  }

  static template = `
    <base>
      ${this.kbc.back()}
      <message>
        State cleared. You can start fresh.
      </message>
    </base>

    <base id="reset">
      <message>
        Reset complete. Tap Back to return.
      </message>
    </base>
  `
}
