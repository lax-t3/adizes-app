import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import Users from './src/collections/Users.ts'
import Categories from './src/collections/Categories.ts'
import Cameras from './src/collections/Cameras.ts'
import { CAMERAS, CATEGORIES } from './seed/camera-data.ts'

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(process.cwd(), 'src'),
    },
  },
  collections: [Users, Categories, Cameras],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    push: process.env.NODE_ENV === 'development',
  }),
  editor: lexicalEditor({}),
  secret: process.env.PAYLOAD_SECRET || 'fallback-secret',
  typescript: {
    outputFile: path.resolve(process.cwd(), 'src/payload-types.ts'),
  },
  upload: {
    limits: {
      fileSize: 5000000,
    },
  },
  onInit: async (payload) => {
    const existing = await payload.find({ collection: 'cameras', limit: 1 })
    if (existing.docs.length > 0) {
      payload.logger.info('Already seeded, skipping.')
      return
    }

    payload.logger.info('Seeding admin user...')
    await payload.create({
      collection: 'users',
      data: { email: 'admin@econ-demo.com', password: 'Admin@1234' },
    })

    payload.logger.info('Seeding categories...')
    const categoryMap: Record<string, string> = {}
    for (const cat of CATEGORIES) {
      const created = await payload.create({ collection: 'categories', data: cat })
      categoryMap[cat.slug] = created.id as string
    }

    payload.logger.info('Seeding cameras...')
    for (const cam of CAMERAS) {
      const { category_slug, ...rest } = cam
      await payload.create({
        collection: 'cameras',
        data: { ...rest, category: categoryMap[category_slug] },
      })
      payload.logger.info(`  ✓ ${cam.sku}`)
    }
    payload.logger.info('Seed complete.')
  },
})
