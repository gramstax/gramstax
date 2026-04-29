import {Env} from "~/env"

export interface Product {
  id: number
  title: string
  description: string
  price: number
  discountPercentage: number
  rating: number
  stock: number
  brand: string
  category: string
  thumbnail: string
  images: string[]
}

export interface ProductsResponse {
  products: Product[]
  total: number
  skip: number
  limit: number
}

export interface Category {
  slug: string
  name: string
  url: string
}

class Api {
  private baseUrl = Env.DUMMYJSON_BASE_URL

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`)
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }
    return response.json() as Promise<T>
  }

  async getProducts(skip = 0, limit = 10): Promise<ProductsResponse> {
    return this.fetch<ProductsResponse>(`/products?skip=${skip}&limit=${limit}`)
  }

  async getProduct(id: number): Promise<Product> {
    return this.fetch<Product>(`/products/${id}`)
  }

  async searchProducts(query: string, skip = 0, limit = 10): Promise<ProductsResponse> {
    return this.fetch<ProductsResponse>(`/products/search?q=${encodeURIComponent(query)}&skip=${skip}&limit=${limit}`)
  }

  async getCategories(): Promise<string[]> {
    return this.fetch<string[]>(`/products/categories`)
  }

  async getProductsByCategory(category: string, skip = 0, limit = 10): Promise<ProductsResponse> {
    return this.fetch<ProductsResponse>(`/products/category/${encodeURIComponent(category)}?skip=${skip}&limit=${limit}`)
  }
}

export const ApiService = new Api()