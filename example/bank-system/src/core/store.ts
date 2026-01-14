export type TransactionType = `deposit` | `withdraw` | `transfer-in` | `transfer-out`

export type TransactionEntry = {
  type: TransactionType
  amountHex: string
  peerId?: number
  peerName?: string
  ts: number
}

const SCALE = 1_000_000n

export class BankStore {
  private balances = new Map<number, string>()
  private histories = new Map<number, TransactionEntry[]>()
  private usernames = new Map<string, number>()

  registerUser(userId: number, username?: string) {
    const normalized = this.normalizeUsername(username)
    if (normalized) {
      this.usernames.set(normalized, userId)
    }
  }

  getUserIdByUsername(username: string) {
    return this.usernames.get(this.normalizeUsername(username) || ``)
  }

  getBalance(userId: number) {
    const hex = this.balances.get(userId) || `0`
    return this.fromHex(hex)
  }

  setBalance(userId: number, value: bigint) {
    const hex = this.toHex(value)
    this.balances.set(userId, hex)
    return hex
  }

  recordTransaction(userId: number, entry: TransactionEntry) {
    const list = this.histories.get(userId) || []
    list.unshift(entry)
    this.histories.set(userId, list.slice(0, 10))
  }

  getHistory(userId: number, limit = 5) {
    return (this.histories.get(userId) || []).slice(0, limit)
  }

  parseAmount(value: string) {
    const trimmed = value.trim()
    if (!/^[0-9]+(\.[0-9]{1,6})?$/.test(trimmed)) {
      return null
    }

    const [wholePart, fractionPart] = trimmed.split(`.`)
    const whole = wholePart || `0`
    const fraction = (fractionPart || ``).padEnd(6, `0`)
    const units = BigInt(whole) * SCALE + BigInt(fraction || `0`)
    return units
  }

  formatAmount(value: bigint) {
    const sign = value < 0n ? `-` : ``
    const abs = value < 0n ? -value : value
    const whole = abs / SCALE
    const fraction = abs % SCALE
    return `${sign}${whole}.${fraction.toString().padStart(6, `0`)}`
  }

  toHex(value: bigint) {
    return value.toString(16)
  }

  fromHex(hex: string) {
    return BigInt(`0x${hex || `0`}`)
  }

  private normalizeUsername(username?: string) {
    if (!username) return null
    return username.replace(/^@/, ``).toLowerCase()
  }
}
