export type CatalogItem = {
  id: string
  name: string
  description: string
}

export type CatalogCategory = {
  id: string
  name: string
  items: CatalogItem[]
}
