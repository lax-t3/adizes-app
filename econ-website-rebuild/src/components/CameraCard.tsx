import Link from 'next/link'

type Props = {
  name: string
  slug: string
  tagline: string
  interface: string
  resolution: string
  price_usd: number
  features?: string[]
}

const interfaceColors: Record<string, string> = {
  'USB3.0': 'bg-econ-navy text-white',
  'MIPI-CSI2': 'bg-econ-teal text-white',
  'GMSL2': 'bg-econ-amber text-white',
  'GigE': 'bg-gray-600 text-white',
}

export default function CameraCard({ name, slug, tagline, interface: iface, resolution, price_usd, features = [] }: Props) {
  return (
    <Link href={`/cameras/${slug}`} className="block border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div className="bg-gray-100 h-40 flex items-center justify-center">
        <span className="text-gray-400 text-sm">📷 {name}</span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-semibold text-gray-900 text-sm">{name}</h3>
          <span className="text-econ-red font-bold text-sm">${price_usd}</span>
        </div>
        <p className="text-gray-500 text-xs mb-3 line-clamp-2">{tagline}</p>
        <div className="flex flex-wrap gap-1">
          <span className={`text-xs px-2 py-0.5 rounded ${interfaceColors[iface] || 'bg-gray-200'}`}>
            {iface}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{resolution}</span>
          {features.includes('IP67') && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-white">IP67</span>
          )}
          {features.includes('globalShutter') && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-white">Global Shutter</span>
          )}
        </div>
      </div>
    </Link>
  )
}
