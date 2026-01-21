import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Lists all existing todo items with improved formatting.
export class ListPage extends PageBase {
  async callback() {
    const items = this.crudStore.listItems(this.userId, 5)
    const count = this.crudStore.listCount(this.userId)
    const data = {
      items,
      count: count.toLocaleString(`id`)
    }
    const kb = this.inlineKeyboardT([StartPage])
    await this.edit(kb, data)
  }

  static template = `
    <base>
      ${this.kbk.menu(`default`)}
      <message>
        📝 Todo List ({{count}})

        <switch value="{~items.length == 0~}">
          <case is="true">
            <i>No todos found.</i> Create one to get started!
          </case>
          <default>
            <map src="items" join="\\n\\n">
              <b>#{{e.id}}</b> {{e.title}}
              └ {{e.description}}
            </map>
          </default>
        </switch>
      </message>
    </base>
  `
}
