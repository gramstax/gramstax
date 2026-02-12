export type ICatalogItem = {
  id: string
  name: string
  description: string
}

export type ICatalogCategory = {
  id: string
  name: string
  items: ICatalogItem[]
}
