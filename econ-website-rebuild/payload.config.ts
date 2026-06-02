import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'
import Users from './src/collections/Users'
import Categories from './src/collections/Categories'
import Cameras from './src/collections/Cameras'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname, 'src'),
    },
  },
  collections: [Users, Categories, Cameras],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  editor: lexicalEditor({}),
  secret: process.env.PAYLOAD_SECRET || 'fallback-secret',
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload-types.ts'),
  },
  upload: {
    limits: {
      fileSize: 5000000,
    },
  },
})
