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
    // With NODE_ENV=production Medusa defaults the admin session cookie to
    // { secure: true, sameSite: 'none' }, which the browser refuses to send over
    // plain HTTP localhost → admin login succeeds but /admin/users/me returns 401.
    // cookieOptions is spread last over the session cookie, so this overrides it.
    cookieOptions: {
      secure: false,
      sameSite: 'lax',
    },
  },
  admin: {
    disable: false,
  },
})
