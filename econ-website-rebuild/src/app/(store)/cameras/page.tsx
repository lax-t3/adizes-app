import { getPayloadClient } from '@/lib/payload'
import CameraCard from '@/components/CameraCard'
import CatalogFilters from '@/components/CatalogFilters'
import { Suspense } from 'react'
import type { Where } from 'payload'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ interface?: string | string[]; feature?: string | string[]; q?: string }>
}

export default async function CatalogPage({ searchParams }: Props) {
  const sp = await searchParams
  const payload = await getPayloadClient()

  const ifaces = sp.interface ? (Array.isArray(sp.interface) ? sp.interface : [sp.interface]) : []
  const features = sp.feature ? (Array.isArray(sp.feature) ? sp.feature : [sp.feature]) : []
  const q = sp.q || ''

  // Build Payload where clause
  const where: Where = { status: { equals: 'published' } }
  if (ifaces.length > 0) where.interface = { in: ifaces }
  if (features.length > 0) where.features = { contains: features[0] } // filter by first selected feature for demo

  const { docs: cameras, totalDocs } = await payload.find({
    collection: 'cameras',
    where,
    limit: 50,
  })

  // Client-side text filter for demo search (q param)
  const filtered = q
    ? cameras.filter((c: any) =>
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.tagline?.toLowerCase().includes(q.toLowerCase()) ||
        c.description?.toLowerCase().includes(q.toLowerCase())
      )
    : cameras

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Camera Catalog</h1>
        <p className="text-gray-500 text-sm mt-1">{totalDocs} products across all categories</p>
      </div>

      {/* Search bar */}
      <form className="mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder='Search by use case, e.g. "4K global shutter IP67 outdoor robot"'
          className="w-full border border-gray-300 rounded px-4 py-2 text-sm focus:outline-none focus:border-econ-red"
        />
      </form>

      <div className="flex gap-8">
        <Suspense fallback={<div className="w-48 shrink-0" />}>
          <CatalogFilters />
        </Suspense>

        <div className="flex-1">
          {filtered.length === 0 ? (
            <p className="text-gray-500">No cameras match your filters.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((cam: any) => (
                <CameraCard
                  key={cam.id}
                  name={cam.name}
                  slug={cam.slug}
                  tagline={cam.tagline}
                  interface={cam.interface}
                  resolution={cam.resolution}
                  price_usd={cam.price_usd}
                  features={cam.features || []}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
