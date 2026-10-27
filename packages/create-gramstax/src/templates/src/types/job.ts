export interface ISummarizeRow {
  label: string
  amount: number
}

export interface ISummarizeResult {
  count: number
  total: number
  top: ISummarizeRow | null
  average: number
}
