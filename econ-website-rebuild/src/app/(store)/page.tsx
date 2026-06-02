import { getPayloadClient } from '@/lib/payload'
import CameraCard from '@/components/CameraCard'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const payload = await getPayloadClient()
  const { docs: featured } = await payload.find({
    collection: 'cameras',
    where: { status: { equals: 'published' } },
    limit: 3,
    sort: '-createdAt',
  })

  return (
    <div>
      {/* Hero */}
      <section className="bg-econ-dark text-white py-20 px-4 text-center">
        <p className="text-econ-red text-sm font-mono uppercase tracking-widest mb-3">e-con Systems</p>
        <h1 className="text-4xl font-bold mb-2">
          From aperture to{' '}
          <em className="text-econ-amber not-italic">intelligence.</em>
        </h1>
        <p className="text-gray-400 text-lg mt-4 max-w-xl mx-auto">
          350+ camera SKUs for robotics, automotive, and machine vision — now on a modern platform.
        </p>
        <Link href="/cameras"
          className="mt-8 inline-block bg-econ-red text-white px-6 py-3 rounded font-semibold hover:bg-red-700 transition-colors">
          Browse Cameras →
        </Link>
      </section>

      {/* Featured cameras */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold mb-6">Featured Cameras</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((cam: any) => (
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
        <div className="text-center mt-10">
          <Link href="/cameras" className="text-econ-red font-semibold hover:underline">
            View all cameras →
          </Link>
        </div>
      </section>
    </div>
  )
}
