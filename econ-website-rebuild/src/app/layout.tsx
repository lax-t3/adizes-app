import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'e-con Systems — Camera Catalog',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning: browser extensions (Grammarly, LanguageTool)
          inject data-gr-* / data-new-gr-* attributes into <body> before React
          hydrates, causing a benign hydration mismatch. This suppresses it. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
