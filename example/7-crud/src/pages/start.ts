import {PageBase} from "~/base/page"
import {ListPage} from "./list"
import {CreatePage} from "./create"
import {UpdatePage} from "./update"
import {DeletePage} from "./delete"
import {HelpPage} from "./help"

// Main menu page for CRUD bot.
export class StartPage extends PageBase {
  async show(edit: boolean) {
    await this.sessionClear()
    const kb = this.inlineKeyboardT([ListPage, CreatePage, UpdatePage, DeletePage, HelpPage], `2`)
    if (edit) await this.edit(kb)
    else await this.reply(kb)
  }

  async textCommand() {
    await this.show(false)
  }

  async callback() {
    await this.show(true)
  }

  static template = `
    <base>
      <keyboard>List, Create, Update, Delete, Help</keyboard>
      <message>
        📋 Todo Menu

        Select a CRUD operation to manage your todos.

        - List: view all todos
        - Create: add new todo
        - Update: edit existing todo
        - Delete: remove todo
        - Help: usage guide
      </message>
    </base>
  `
}
