import Link from 'next/link'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white text-gray-900 min-h-screen flex flex-col">
      <header className="bg-econ-dark text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">
            <span className="text-econ-red">e-con</span> Systems
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/cameras" className="hover:text-gray-300">Cameras</Link>
            <Link href="/cart" className="hover:text-gray-300">Cart</Link>
            <Link href="/admin" className="bg-econ-red px-3 py-1 rounded text-white text-xs hover:bg-red-700">
              Admin (Payload)
            </Link>
            <a href="http://localhost:9000/app" target="_blank" rel="noreferrer"
              className="border border-white px-3 py-1 rounded text-xs hover:bg-white hover:text-econ-dark">
              Commerce (Medusa)
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-econ-dark text-gray-400 text-xs text-center py-4">
        e-con Systems Demo — Powered by Payload CMS + Medusa.js
      </footer>
    </div>
  )
}
