import { defineConfig } from '@medusajs/framework/utils'

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: '*',
      adminCors: '*',
      authCors: '*',
      jwtSecret: process.env.JWT_SECRET || 'econ-demo-jwt',
      cookieSecret: process.env.COOKIE_SECRET || 'econ-demo-cookie',
    },
  },
  admin: {
    disable: false,
  },
})
