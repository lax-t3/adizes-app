import { CAMERAS, CATEGORIES } from './camera-data'

const BASE_URL = process.env.MEDUSA_BACKEND_INTERNAL_URL || 'http://medusa:9000'
const ADMIN_EMAIL = process.env.MEDUSA_ADMIN_EMAIL || 'admin@econ-demo.com'
const ADMIN_PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD || 'Admin@1234'

async function getAdminToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login failed: ${await res.text()}`)
  const { token } = await res.json()
  return token
}

async function adminFetch(token: string, path: string, method = 'GET', body?: object) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${path} failed (${res.status}): ${text}`)
  }
  return res.json()
}

async function seed() {
  // Check if already seeded
  const existing = await fetch(`${BASE_URL}/store/products`).then(r => r.json())
  if (existing?.products?.length > 0) {
    console.log('Medusa already seeded, skipping.')
    process.exit(0)
  }

  console.log('Logging in to Medusa admin...')
  const token = await getAdminToken()

  // Create a default region (required for pricing)
  console.log('Creating region...')
  const { region } = await adminFetch(token, '/admin/regions', 'POST', {
    name: 'India',
    currency_code: 'usd',
    countries: ['in'],
  })

  // Create a default sales channel
  console.log('Creating sales channel...')
  const { sales_channel } = await adminFetch(token, '/admin/sales-channels', 'POST', {
    name: 'e-con Storefront',
    description: 'Main storefront sales channel',
  })

  // Create product categories
  console.log('Creating product categories...')
  const catMap: Record<string, string> = {}
  for (const cat of CATEGORIES) {
    const { product_category } = await adminFetch(token, '/admin/product-categories', 'POST', {
      name: cat.name,
      handle: cat.slug,
      description: cat.description,
      is_active: true,
    })
    catMap[cat.slug] = product_category.id
  }

  // Create products
  console.log('Creating products...')
  for (const cam of CAMERAS) {
    const { product } = await adminFetch(token, '/admin/products', 'POST', {
      title: cam.name,
      handle: cam.slug,
      description: cam.description,
      status: cam.status === 'published' ? 'published' : 'draft',
      sales_channels: [{ id: sales_channel.id }],
      categories: catMap[cam.category_slug] ? [{ id: catMap[cam.category_slug] }] : [],
      options: [{ title: 'Type', values: ['OEM Module', 'Development Kit'] }],
      variants: [
        {
          title: 'OEM Module',
          sku: `${cam.sku}-OEM`,
          options: { Type: 'OEM Module' },
          prices: [{ amount: cam.price_usd * 100, currency_code: 'usd', region_id: region.id }],
          manage_inventory: false,
        },
        {
          title: 'Development Kit',
          sku: `${cam.sku}-DEVKIT`,
          options: { Type: 'Development Kit' },
          prices: [{ amount: (cam.price_usd + 150) * 100, currency_code: 'usd', region_id: region.id }],
          manage_inventory: false,
        },
      ],
    })
    console.log(`  ✓ ${cam.sku} (${product.id})`)
  }

  console.log('Medusa seed complete.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Medusa seed failed:', err)
  process.exit(1)
})
