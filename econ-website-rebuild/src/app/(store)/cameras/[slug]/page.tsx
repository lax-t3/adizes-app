import { getPayloadClient } from '@/lib/payload'
import AddToCartButton from '@/components/AddToCartButton'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
}

const featureLabels: Record<string, string> = {
  globalShutter: 'Global Shutter',
  HDR: 'HDR',
  IP67: 'IP67',
  IP69K: 'IP69K',
  autofocus: 'Autofocus',
  wideAngle: 'Wide Angle',
}

const interfaceColor: Record<string, string> = {
  'USB3.0': 'bg-econ-navy',
  'MIPI-CSI2': 'bg-econ-teal',
  'GMSL2': 'bg-econ-amber',
  'GigE': 'bg-gray-600',
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const payload = await getPayloadClient()

  const { docs } = await payload.find({
    collection: 'cameras',
    where: { slug: { equals: slug }, status: { equals: 'published' } },
    limit: 1,
  })

  const cam = docs[0] as any
  if (!cam) notFound()

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Image placeholder */}
        <div className="bg-gray-100 rounded-lg aspect-square flex items-center justify-center">
          <span className="text-gray-400 text-4xl">📷</span>
        </div>

        {/* Details */}
        <div>
          <p className="text-xs text-gray-500 font-mono mb-1">{cam.sku}</p>
          <h1 className="text-2xl font-bold mb-2">{cam.name}</h1>
          <p className="text-gray-600 mb-4">{cam.tagline}</p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className={`text-xs px-3 py-1 rounded text-white ${interfaceColor[cam.interface] || 'bg-gray-500'}`}>
              {cam.interface}
            </span>
            {(cam.features || []).map((f: string) => (
              <span key={f} className="text-xs px-3 py-1 rounded bg-gray-800 text-white">
                {featureLabels[f] || f}
              </span>
            ))}
          </div>

          {/* Specs table */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm">
            <h2 className="font-semibold mb-3 text-gray-700">Technical Specifications</h2>
            <table className="w-full">
              <tbody>
                {[
                  ['Interface', cam.interface],
                  ['Resolution', cam.resolution],
                  ['Sensor', cam.sensor],
                  ['Platforms', (cam.platforms || []).join(', ')],
                ].map(([label, value]) => (
                  value && (
                    <tr key={label} className="border-b border-gray-200 last:border-0">
                      <td className="py-2 pr-4 text-gray-500 w-32">{label}</td>
                      <td className="py-2 font-medium">{value}</td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>

          {/* Add to cart */}
          <AddToCartButton
            sku={cam.sku}
            name={cam.name}
            slug={cam.slug}
            price_usd={cam.price_usd || 0}
          />
        </div>
      </div>

      {/* Full description */}
      <div className="mt-10 border-t pt-8">
        <h2 className="font-semibold text-lg mb-3">About this camera</h2>
        <p className="text-gray-600 leading-relaxed">{cam.description}</p>
      </div>
    </div>
  )
}
