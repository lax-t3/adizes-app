'use client'

import { useState, useCallback } from 'react'
import CartLineItems from '@/components/CartLineItems'

type CartItem = { sku: string; name: string; slug: string; variant: string; price_usd: number; qty: number }

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [submitted, setSubmitted] = useState(false)

  const handleCartChange = useCallback((items: CartItem[]) => setCartItems(items), [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    console.log('Quote request:', {
      company: form.get('company'),
      email: form.get('email'),
      message: form.get('message'),
      items: cartItems,
    })
    localStorage.removeItem('econ-cart')
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-2">Quote request received!</h1>
        <p className="text-gray-600">The e-con Systems sales team will be in touch within 24 hours.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Your Cart</h1>

      <CartLineItems onCartChange={handleCartChange} />

      {cartItems.length > 0 && (
        <form onSubmit={handleSubmit} className="mt-8 border-t pt-8 space-y-4">
          <h2 className="font-semibold text-lg">Request a Quote</h2>
          <p className="text-gray-500 text-sm">
            e-con Systems processes all orders via a dedicated sales team.
            Fill in your details and we'll follow up with pricing and availability.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Company Name</label>
            <input name="company" required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-econ-red"
              placeholder="ACME Robotics Pvt. Ltd." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input name="email" type="email" required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-econ-red"
              placeholder="engineer@company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Message (optional)</label>
            <textarea name="message" rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-econ-red"
              placeholder="Quantities, application details, delivery timeline..." />
          </div>
          <button type="submit"
            className="w-full bg-econ-red text-white px-4 py-3 rounded font-semibold hover:bg-red-700 transition-colors">
            Submit Quote Request →
          </button>
        </form>
      )}
    </div>
  )
}
