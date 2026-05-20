export type StockStatus = `available` | `out-of-stock`

export type Product = {
  id: string
  name: string
  service: string
  duration: string
  accountType: string
  stockStatus: StockStatus
  stockCount: number
  price: number
  currency: `IDR`
  description: string
  benefits: string[]
  deliveryEstimate: string
}

export type ProductPage = {
  items: Product[]
  page: number
  totalPages: number
  totalItems: number
  hasPrev: boolean
  hasNext: boolean
}

export type CartState = Record<string, number>

export type CartSummaryItem = {
  product: Product
  quantity: number
  total: number
}

export type CartSummary = {
  items: CartSummaryItem[]
  subtotal: number
  isEmpty: boolean
}

export type OrderStatus = `pending` | `done` | `failed`

export type OrderRecord = {
  id: string
  items: CartSummaryItem[]
  subtotal: number
  contact: string
  notes: string
  paymentMethod: `QRIS`
  support: string
  createdAt: string
  status: OrderStatus
  deadlineMinutes: number
  deadlineAt: string
  qrisImageUrl: string
}

export class ProductCatalog {
  static pageSize = 4

  static products: Product[] = [
    {
      id: `netflix-premium-1m`,
      name: `Netflix Premium`,
      service: `Netflix`,
      duration: `1 month`,
      accountType: `Shared premium slot`,
      stockStatus: `available`,
      stockCount: 12,
      price: 79000,
      currency: `IDR`,
      description: `Premium entertainment access for movies, series, and family streaming.`,
      benefits: [`Ultra HD support`, `Shared premium profile`, `Fast manual delivery`],
      deliveryEstimate: `5-15 minutes after payment confirmation`
    },
    {
      id: `spotify-family-1m`,
      name: `Spotify Family`,
      service: `Spotify`,
      duration: `1 month`,
      accountType: `Family invitation slot`,
      stockStatus: `available`,
      stockCount: 8,
      price: 35000,
      currency: `IDR`,
      description: `Music subscription slot for ad-free listening and offline playback.`,
      benefits: [`Ad-free music`, `Offline playback`, `Family invite delivery`],
      deliveryEstimate: `10-30 minutes after payment confirmation`
    },
    {
      id: `youtube-premium-1m`,
      name: `YouTube Premium`,
      service: `YouTube`,
      duration: `1 month`,
      accountType: `Family invitation slot`,
      stockStatus: `available`,
      stockCount: 10,
      price: 45000,
      currency: `IDR`,
      description: `Ad-free YouTube and YouTube Music access for daily entertainment.`,
      benefits: [`No ads`, `Background play`, `YouTube Music included`],
      deliveryEstimate: `10-30 minutes after payment confirmation`
    },
    {
      id: `disney-family-1m`,
      name: `Disney+ Hotstar`,
      service: `Disney+`,
      duration: `1 month`,
      accountType: `Shared profile`,
      stockStatus: `out-of-stock`,
      stockCount: 0,
      price: 39000,
      currency: `IDR`,
      description: `Family entertainment package for Disney, Marvel, Pixar, and Star Wars fans.`,
      benefits: [`Shared profile`, `Family catalog`, `Renewal reminder`],
      deliveryEstimate: `Currently unavailable`
    },
    {
      id: `canva-pro-1m`,
      name: `Canva Pro`,
      service: `Canva`,
      duration: `1 month`,
      accountType: `Team invitation slot`,
      stockStatus: `available`,
      stockCount: 15,
      price: 25000,
      currency: `IDR`,
      description: `Design tool access for social media, presentations, and marketing assets.`,
      benefits: [`Pro templates`, `Brand assets`, `Team invite delivery`],
      deliveryEstimate: `5-20 minutes after payment confirmation`
    },
    {
      id: `vpn-plus-1m`,
      name: `VPN Plus`,
      service: `VPN`,
      duration: `1 month`,
      accountType: `Private account`,
      stockStatus: `available`,
      stockCount: 9,
      price: 30000,
      currency: `IDR`,
      description: `Private VPN access for safer browsing and region-flexible streaming.`,
      benefits: [`Private account`, `Multi-region servers`, `Setup guidance`],
      deliveryEstimate: `5-15 minutes after payment confirmation`
    },
    {
      id: `prime-video-1m`,
      name: `Prime Video`,
      service: `Prime Video`,
      duration: `1 month`,
      accountType: `Shared profile`,
      stockStatus: `available`,
      stockCount: 6,
      price: 32000,
      currency: `IDR`,
      description: `Streaming access for movies, shows, and selected Amazon originals.`,
      benefits: [`Shared profile`, `HD streaming`, `Fast delivery`],
      deliveryEstimate: `10-30 minutes after payment confirmation`
    },
    {
      id: `viu-premium-1m`,
      name: `Viu Premium`,
      service: `Viu`,
      duration: `1 month`,
      accountType: `Private account`,
      stockStatus: `available`,
      stockCount: 20,
      price: 18000,
      currency: `IDR`,
      description: `Asian drama and variety-show premium access with practical pricing.`,
      benefits: [`Premium catalog`, `Private login`, `Renewal support`],
      deliveryEstimate: `5-15 minutes after payment confirmation`
    }
  ]

  static getPage(page: number): ProductPage {
    const totalPages = Math.max(Math.ceil(this.products.length / this.pageSize), 1)
    const safePage = Math.min(Math.max(Math.trunc(page || 0), 0), totalPages - 1)
    const start = safePage * this.pageSize
    const items = this.products.slice(start, start + this.pageSize)

    return {
      items,
      page: safePage,
      totalPages,
      totalItems: this.products.length,
      hasPrev: safePage > 0,
      hasNext: safePage < totalPages - 1
    }
  }

  static getById(productId: string): Product | null {
    return this.products.find((product) => product.id === productId) ?? null
  }

  static formatPrice(value: number): string {
    return `Rp ${value.toLocaleString(`id-ID`)}`
  }

  static stockLabel(product: Product): string {
    return product.stockStatus === `available` ? `✅ Available` : `⛔ Out of stock`
  }

  static detailStockLabel(product: Product): string {
    return product.stockCount > 0 ? `✅ ${product.stockCount} available` : `⛔ Out of stock`
  }
}

export class CartStore {
  static addItem(cart: CartState, productId: string): CartState {
    const product = ProductCatalog.getById(productId)
    if (!product || product.stockStatus !== `available`) {
      return {...cart}
    }

    return {...cart, [productId]: (cart[productId] ?? 0) + 1}
  }

  static decreaseItem(cart: CartState, productId: string): CartState {
    const current = cart[productId] ?? 0
    if (current <= 1) {
      return {...cart, [productId]: current > 0 ? 1 : 0}
    }

    return {...cart, [productId]: current - 1}
  }

  static removeItem(cart: CartState, productId: string): CartState {
    const next = {...cart}
    delete next[productId]
    return next
  }

  static clear(): CartState {
    return {}
  }

  static getSummary(cart: CartState): CartSummary {
    const items = Object.entries(cart)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => {
        const product = ProductCatalog.getById(productId)
        if (!product) {
          return null
        }

        return {product, quantity, total: product.price * quantity}
      })
      .filter((item): item is CartSummaryItem => item !== null)

    const subtotal = items.reduce((sum, item) => sum + item.total, 0)
    return {items, subtotal, isEmpty: items.length === 0}
  }
}

export class OrderStore {
  static deadlineMinutes = 15

  static createOrderId(userId: number | string): string {
    const safeUserId = String(userId).slice(-4).padStart(4, `0`)
    return `SUB-${safeUserId}-${Date.now().toString(36).toUpperCase()}`
  }

  static createQrisImageUrl(orderId: string): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=QRIS-${orderId}`
  }

  static statusLabel(status: OrderStatus): string {
    if (status === `done`) {
      return `✅ Success`
    }

    if (status === `failed`) {
      return `❌ Failed`
    }

    return `⏳ Pending`
  }

  static createOrder(params: {userId: number | string; summary: CartSummary; contact: string; notes: string; support: string; now?: Date}): OrderRecord {
    const now = params.now ?? new Date()
    const deadlineAt = new Date(now.getTime() + this.deadlineMinutes * 60 * 1000)
    const id = this.createOrderId(params.userId)

    return {
      id,
      items: params.summary.items,
      subtotal: params.summary.subtotal,
      contact: params.contact,
      notes: params.notes,
      paymentMethod: `QRIS`,
      support: params.support,
      createdAt: now.toISOString(),
      status: `pending`,
      deadlineMinutes: this.deadlineMinutes,
      deadlineAt: deadlineAt.toISOString(),
      qrisImageUrl: this.createQrisImageUrl(id)
    }
  }

  static formatCart(summary: CartSummary): string {
    if (summary.isEmpty) {
      return `No items in cart.`
    }

    return summary.items.map((item, index) => `${index + 1}. ${item.product.name} x${item.quantity} — ${ProductCatalog.formatPrice(item.total)}`).join(`\n`)
  }
}

export class OrderHistoryStore {
  static addOrder(history: OrderRecord[], order: OrderRecord): OrderRecord[] {
    return [order, ...history].slice(0, 10)
  }

  static refreshStatuses(history: OrderRecord[], now = new Date()): OrderRecord[] {
    return history.map((order) => {
      if (order.status !== `pending`) {
        return order
      }

      const deadlineAt = new Date(order.deadlineAt)
      if (deadlineAt.getTime() > now.getTime()) {
        return order
      }

      return {...order, status: `failed`}
    })
  }

  static formatHistory(history: OrderRecord[]): string {
    if (history.length === 0) {
      return `No orders yet.`
    }

    return history.map((order, index) => `${index + 1}. ${order.id} — ${ProductCatalog.formatPrice(order.subtotal)} — ${order.paymentMethod} — ${OrderStore.statusLabel(order.status)}`).join(`\n`)
  }
}
