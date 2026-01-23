import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Creates a new item in cache.
export class CreatePage extends PageBase {
  kb(baseId?: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  async callback() {
    await this.sessionTextFree({step: `title`})
    const bi = `form-title`
    await this.edit(this.kb(`${bi}-kb`), {}, bi)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null
    await this.sessionGet()
    await this.handleCreate(this.msgText)
  }

  private async handleCreate(input?: string) {
    const stepRaw = (this.session?.params as {step?: string; title?: string} | undefined)?.step
    const step = stepRaw === `description` ? `description` : `title`
    const value = input?.trim()
    const biInv = `invalid`
    if (!value) {
      await this.sessionTextFree({step})
      return await this.reply(this.kb(`${biInv}-kb`), {}, biInv)
    }

    if (step === `title`) {
      await this.sessionTextFree({step: `description`, title: value})
      const bi = `form-description`
      return await this.reply(this.kb(`${bi}-kb`), {title: value}, bi)
    }

    const title = (this.session?.params as {title?: string} | undefined)?.title
    if (!title) {
      await this.sessionTextFree({step: `title`})
      return await this.reply(this.kb(`${biInv}-kb`), {}, biInv)
    }

    const item = this.crudStore.createItem(this.userId, title, value)
    await this.sessionClear()
    const bi = `success`
    await this.reply(this.kb(`${bi}-kb`), {id: item.id, title: item.title, description: item.description, status: item.status}, bi)
  }

  static template = `
    <base id="form-title">
      <message>
        ✏️ Create a new item

        Send the title for the item.
        Example: Coffee Beans
      </message>
    </base>

    <base id="form-description">
      <message>
        ✅ Title saved: {{title}}

        Now send the description.
        Example: Medium roast, 250g
      </message>
    </base>

    <base id="success">
      <message>
        ✅ Item created (#{{id}})

        🏷️ Title: {{title}}
        📝 Description: {{description}}
        📌 Status: {{status}}
      </message>
    </base>

    <base id="invalid">
      <message>
        ⚠️ Invalid input.

        Please send a non-empty value.
      </message>
    </base>

    <base id="form-title-kb">
      <keyboard>${this.kbl.cancel.default}</keyboard>
    </base>

    <base id="form-description-kb">
      <keyboard>${this.kbl.cancel.default}</keyboard>
    </base>

    <base id="success-kb">
      <keyboard>${this.kbl.home.default}</keyboard>
    </base>

    <base id="invalid-kb">
      <keyboard>${this.kbl.cancel.default}</keyboard>
    </base>
  `
}
