import type {CatalogCategory} from "./catalog.d"

export class CatalogMock {
  // Sample catalog data used for menus and pagination.
  static list: CatalogCategory[] = [
    {
      id: `tools`,
      name: `Tools`,
      items: [
        {id: `tool-1`, name: `Focus Timer`, description: `A 25-minute focus timer.`},
        {id: `tool-2`, name: `Habit Tracker`, description: `Track daily habits with streaks.`},
        {id: `tool-3`, name: `Note Inbox`, description: `Capture ideas quickly.`},
        {id: `tool-4`, name: `Budget Sheet`, description: `Plan monthly budgets.`},
        {id: `tool-5`, name: `Reading List`, description: `Keep your reading queue.`},
        {id: `tool-6`, name: `Workout Plan`, description: `Structured exercise routines.`}
      ]
    },
    {
      id: `guides`,
      name: `Guides`,
      items: [
        {id: `guide-1`, name: `Onboarding`, description: `Start here to learn the bot.`},
        {id: `guide-2`, name: `Shortcuts`, description: `Tips to move faster.`},
        {id: `guide-3`, name: `Automation`, description: `Automate repetitive tasks.`},
        {id: `guide-4`, name: `Accessibility`, description: `Inclusive workflows and tips.`}
      ]
    },
    {
      id: `news`,
      name: `Updates`,
      items: [
        {id: `news-1`, name: `Version 1.2`, description: `New navigation experience.`},
        {id: `news-2`, name: `Version 1.3`, description: `Smarter quick actions.`},
        {id: `news-3`, name: `Version 1.4`, description: `Expanded integrations.`}
      ]
    }
  ]

  static menuItems = CatalogMock.list.flatMap((category) => category.items.map((item) => ({id: item.id, name: item.name, category: category.name})))
  static getCategoryById(categoryId: string) {
    return this.list.find((category) => category.id === categoryId)
  }
  static getItemById(categoryId: string, itemId: string) {
    const category = this.getCategoryById(categoryId)
    return category?.items.find((item) => item.id === itemId)
  }
}
