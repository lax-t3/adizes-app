'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type CartItem = {
  sku: string
  name: string
  slug: string
  variant: string
  price_usd: number
  qty: number
}

type Props = {
  onCartChange: (items: CartItem[]) => void
}

export default function CartLineItems({ onCartChange }: Props) {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    const cart = JSON.parse(localStorage.getItem('econ-cart') || '[]')
    setItems(cart)
    onCartChange(cart)
  }, [onCartChange])

  function remove(sku: string, variant: string) {
    const updated = items.filter(i => !(i.sku === sku && i.variant === variant))
    localStorage.setItem('econ-cart', JSON.stringify(updated))
    setItems(updated)
    onCartChange(updated)
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Your cart is empty.</p>
        <Link href="/cameras" className="text-econ-red hover:underline font-semibold">Browse cameras →</Link>
      </div>
    )
  }

  const total = items.reduce((sum, i) => sum + i.price_usd * i.qty, 0)

  return (
    <div>
      {items.map(item => (
        <div key={`${item.sku}-${item.variant}`}
          className="flex justify-between items-center py-4 border-b border-gray-100">
          <div>
            <Link href={`/cameras/${item.slug}`} className="font-semibold text-sm hover:text-econ-red">
              {item.name}
            </Link>
            <p className="text-gray-500 text-xs mt-0.5">{item.variant} × {item.qty}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-bold text-econ-red">${item.price_usd * item.qty}</span>
            <button onClick={() => remove(item.sku, item.variant)}
              className="text-gray-400 hover:text-red-500 text-sm">✕</button>
          </div>
        </div>
      ))}
      <div className="flex justify-between py-4 font-bold">
        <span>Total</span>
        <span className="text-econ-red">${total}</span>
      </div>
    </div>
  )
}
