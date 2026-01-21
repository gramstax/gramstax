import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Updates an existing todo item using multi-step session input.
export class UpdatePage extends PageBase {
  static data = this.buildData((action: string) => [action])

  kb(baseId?: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  async callback() {
    await this.sessionTextFree({step: `id`})
    const bi = `step-id`
    const kb = this.kb(bi)
    await this.edit(kb, {}, bi)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null

    const session = await this.sessionGet()
    const spar = session?.params
    const step = spar?.step
    if (step === `id`) {
      const idStr = this.msgText.trim()
      const id = Number(idStr)
      if (!idStr || isNaN(id)) {
        const bi = `error-id`
        const kb = this.kb(bi)
        return await this.reply(kb, {}, bi)
      }

      const existing = this.crudStore.getItem(this.userId, id)
      if (!existing) {
        const bi = `error-notfound`
        const kb = this.kb(bi)
        return await this.reply(kb, {id: idStr}, bi)
      }

      await this.sessionTextFree({step: `title`, id, existing})
      const bi = `step-title`
      const kb = this.kb(bi)
      await this.reply(kb, {currentTitle: existing.title, currentDesc: existing.description}, bi)
    } else if (step === `title`) {
      const id = spar?.id as number
      const title = this.msgText.trim()
      if (!title) {
        const bi = `error-title`
        const kb = this.kb(bi)
        return await this.reply(kb)
      }

      await this.sessionTextFree({step: `description`, id, title})
      const bi = `step-description`
      const kb = this.kb(bi)
      await this.reply(kb, {newTitle: title}, bi)
    } else if (step === `description`) {
      const id = spar?.id as number
      const title = spar?.title as string
      const description = this.msgText.trim()

      const updated = this.crudStore.updateItem(this.userId, id, title, description)
      if (!updated) {
        const bi = `error-notfound`
        const kb = this.kb(bi)
        return await this.reply(kb, {id: String(id)}, bi)
      }

      await this.sessionClear()
      const bi = `success`
      const kb = this.kb(bi)
      const data = {
        id: String(updated.id),
        title: updated.title,
        description: updated.description
      }
      await this.reply(kb, data, bi)
    }
  }

  static template = `
    <base id="step-id">
      ${this.kbk.cancel()}
      <message>
        ✏️ Update Todo (Step 1/3)

        <b>Enter todo ID:</b>
      </message>
    </base>

    <base id="step-title">
      ${this.kbk.cancel()}
      <message>
        ✏️ Update Todo (Step 2/3)

        <b>Current #{{id}}:</b>
        {{currentTitle}}
        {{currentDesc}}

        <b>Enter new title:</b>
      </message>
    </base>

    <base id="step-description">
      ${this.kbk.cancel()}
      <message>
        ✏️ Update Todo (Step 3/3)

        <b>New Title:</b> {{newTitle}}

        <b>Enter new description (optional):</b>
      </message>
    </base>

    <base id="success">
      ${this.kbk.menu()}
      <message>
        ✅ Todo updated!

        #{{id}} {{title}}
        {{description}}
      </message>
    </base>

    <base id="error-id">
      ${this.kbk.cancel()}
      <message>
        ❌ Invalid ID

        Please enter a valid numeric ID or click Cancel.
      </message>
    </base>

    <base id="error-notfound">
      ${this.kbk.cancel()}
      <message>
        ❌ Todo #{{id}} Not Found

        This todo does not exist. Check the ID and try again, or click Cancel.
      </message>
    </base>

    <base id="error-title">
      ${this.kbk.cancel()}
      <message>
        ❌ Invalid Title

        Title cannot be empty. Please enter a title or click Cancel.
      </message>
    </base>
  `
}
