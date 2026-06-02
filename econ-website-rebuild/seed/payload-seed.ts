import { getPayload } from 'payload'
import config from '../payload.config'
import { CAMERAS, CATEGORIES } from './camera-data'

async function seed() {
  const payload = await getPayload({ config })

  // Check if already seeded
  const existing = await payload.find({ collection: 'cameras', limit: 1 })
  if (existing.docs.length > 0) {
    console.log('Payload already seeded, skipping.')
    process.exit(0)
  }

  console.log('Seeding Payload admin user...')
  await payload.create({
    collection: 'users',
    data: { email: 'admin@econ-demo.com', password: 'Admin@1234' },
  })

  console.log('Seeding categories...')
  const categoryMap: Record<string, string> = {}
  for (const cat of CATEGORIES) {
    const created = await payload.create({ collection: 'categories', data: cat })
    categoryMap[cat.slug] = created.id as string
  }

  console.log('Seeding cameras...')
  for (const cam of CAMERAS) {
    const { category_slug, ...rest } = cam
    await payload.create({
      collection: 'cameras',
      data: {
        ...rest,
        category: categoryMap[category_slug],
      },
    })
    console.log(`  ✓ ${cam.sku}`)
  }

  console.log('Payload seed complete.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
