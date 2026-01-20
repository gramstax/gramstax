import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Creates a new todo item using multi-step session input.
export class CreatePage extends PageBase {
  static data = this.buildData((action: string) => [action])

  kb(baseId?: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  async callback() {
    await this.sessionTextFree({step: `title`})
    const bi = `step-title`
    await this.edit(this.kb(bi), {}, bi)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null

    const session = await this.sessionGet()
    const step = session.params?.step
    const title = session.params?.title
    if (step === `title`) {
      const title = this.msgText.trim()
      if (!title) {
        const bi = `error-title`
        return await this.reply(this.kb(bi), {}, bi)
      }

      await this.sessionTextFree({step: `description`, title})
      const bi = `step-description`
      await this.reply(this.kb(bi), {}, bi)
    } else if (step === `description`) {
      const description = this.msgText.trim()
      await this.handleCreate(title, description)
    }
  }

  private async handleCreate(title: string, description: string) {
    const item = this.crudStore.createItem(title, description)
    await this.sessionClear()
    const data = {
      id: String(item.id),
      title: item.title,
      description: item.description
    }
    const bi = `success`
    await this.reply(this.kb(bi), data, bi)
  }

  static template = `
    <base id="step-title">
      ${this.kbk.cancel()}
      <message>
        ➕ Create New Todo (Step 1/2)

        <b>Enter todo title:</b>
      </message>
    </base>

    <base id="step-description">
      ${this.kbk.cancel()}
      <message>
        ➕ Create New Todo (Step 2/2)

        <b>Enter description:</b>
      </message>
    </base>

    <base id="success">
      ${this.kbk.menu()}
      <message>
        ✅ Todo created!

        #{{id}} {{title}}
        {~description ?? "(no description)"~}
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
