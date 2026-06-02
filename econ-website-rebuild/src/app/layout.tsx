import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'e-con Systems — Camera Catalog',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
