import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Help page with updated usage guide reflecting multi-step input flow.
export class HelpPage extends PageBase {
  async callback() {
    const kb = this.inlineKeyboardT([StartPage])
    await this.edit(kb)
  }

  static template = `
    <base>
      ${this.kbk.menu(`default`)}
      <message>
        ℹ️ Help & Usage

        <b>Commands</b>
        /start or /menu - Open main menu

        <b>CRUD Operations</b>
        <u>List</u> - View all todo items
        <u>Create</u> - Add a new todo (2-step input)
        <u>Update</u> - Edit an existing todo (3-step input)
        <u>Delete</u> - Remove a todo (select from inline keyboard)

        <b>Input Flows</b>
        <code>Create:</code>
        Step 1: Enter title
        Step 2: Enter description (optional)
        Click "Cancel" at any step to abort.

        <code>Update:</code>
        Step 1: Enter todo ID
        Step 2: Enter new title
        Step 3: Enter new description (optional)
        Click "Cancel" at any step to abort.

        <code>Delete:</code>
        - Click "Delete" to see inline keyboard with all todos
        - Click a todo button to delete it
        - No manual ID input required.

        <b>Notes</b>
        - Data is stored in LMDB database (database/ folder)
        - Changes persist across bot restarts
        - Use "Cancel" button to abort any operation
      </message>
    </base>
  `
}
