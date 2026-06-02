'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const INTERFACES = ['USB3.0', 'MIPI-CSI2', 'GMSL2', 'GigE']
const FEATURES = [
  { value: 'globalShutter', label: 'Global Shutter' },
  { value: 'HDR', label: 'HDR' },
  { value: 'IP67', label: 'IP67' },
  { value: 'autofocus', label: 'Autofocus' },
  { value: 'wideAngle', label: 'Wide Angle' },
]

export default function CatalogFilters() {
  const router = useRouter()
  const params = useSearchParams()

  const activeInterfaces = params.getAll('interface')
  const activeFeatures = params.getAll('feature')

  function toggle(key: string, value: string) {
    const current = new URLSearchParams(params.toString())
    const values = current.getAll(key)
    if (values.includes(value)) {
      current.delete(key)
      values.filter(v => v !== value).forEach(v => current.append(key, v))
    } else {
      current.append(key, value)
    }
    router.push(`/cameras?${current.toString()}`)
  }

  return (
    <aside className="w-48 shrink-0">
      <div className="mb-6">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 mb-3">Interface</h3>
        {INTERFACES.map(iface => (
          <label key={iface} className="flex items-center gap-2 mb-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={activeInterfaces.includes(iface)}
              onChange={() => toggle('interface', iface)}
              className="accent-econ-red"
            />
            {iface}
          </label>
        ))}
      </div>
      <div>
        <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 mb-3">Features</h3>
        {FEATURES.map(f => (
          <label key={f.value} className="flex items-center gap-2 mb-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={activeFeatures.includes(f.value)}
              onChange={() => toggle('feature', f.value)}
              className="accent-econ-red"
            />
            {f.label}
          </label>
        ))}
      </div>
    </aside>
  )
}
