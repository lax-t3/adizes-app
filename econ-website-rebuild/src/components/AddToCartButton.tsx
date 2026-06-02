'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  sku: string
  name: string
  slug: string
  price_usd: number
}

export default function AddToCartButton({ sku, name, slug, price_usd }: Props) {
  const [variant, setVariant] = useState<'OEM Module' | 'Development Kit'>('OEM Module')
  const router = useRouter()

  const price = variant === 'Development Kit' ? price_usd + 150 : price_usd

  function addToCart() {
    const cart = JSON.parse(localStorage.getItem('econ-cart') || '[]')
    const existingIdx = cart.findIndex((i: any) => i.sku === sku && i.variant === variant)
    if (existingIdx >= 0) {
      cart[existingIdx].qty += 1
    } else {
      cart.push({ sku, name, slug, variant, price_usd: price, qty: 1 })
    }
    localStorage.setItem('econ-cart', JSON.stringify(cart))
    router.push('/cart')
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Variant</label>
        <select
          value={variant}
          onChange={e => setVariant(e.target.value as typeof variant)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:border-econ-red"
        >
          <option value="OEM Module">OEM Module — ${price_usd}</option>
          <option value="Development Kit">Development Kit — ${price_usd + 150}</option>
        </select>
      </div>
      <button
        onClick={addToCart}
        className="w-full bg-econ-red text-white px-4 py-3 rounded font-semibold hover:bg-red-700 transition-colors"
      >
        Add to Cart — ${price}
      </button>
    </div>
  )
}
