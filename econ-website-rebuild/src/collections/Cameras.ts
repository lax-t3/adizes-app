import type { CollectionConfig } from 'payload'

const Cameras: CollectionConfig = {
  slug: 'cameras',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'sku', type: 'text', required: true, unique: true },
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'URL-friendly identifier, e.g. see3cam-cu135' },
    },
    { name: 'tagline', type: 'text' },
    { name: 'description', type: 'textarea' },
    {
      name: 'interface',
      type: 'select',
      options: ['USB3.0', 'MIPI-CSI2', 'GMSL2', 'GigE'],
      required: true,
    },
    { name: 'resolution', type: 'text' },
    { name: 'sensor', type: 'text' },
    {
      name: 'features',
      type: 'select',
      hasMany: true,
      options: ['globalShutter', 'HDR', 'IP67', 'IP69K', 'autofocus', 'wideAngle'],
    },
    {
      name: 'platforms',
      type: 'select',
      hasMany: true,
      options: [
        'NVIDIA Jetson Orin NX',
        'NVIDIA Jetson AGX Orin',
        'NVIDIA Jetson Nano',
        'Raspberry Pi',
        'AMD Xilinx',
      ],
    },
    { name: 'price_usd', type: 'number' },
    { name: 'medusa_product_id', type: 'text' },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
    },
    {
      name: 'status',
      type: 'select',
      options: ['draft', 'published'],
      defaultValue: 'draft',
      required: true,
    },
  ],
}

export default Cameras
