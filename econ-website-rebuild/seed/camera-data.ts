export type CameraData = {
  sku: string
  name: string
  slug: string
  tagline: string
  description: string
  interface: 'USB3.0' | 'MIPI-CSI2' | 'GMSL2' | 'GigE'
  resolution: string
  sensor: string
  features: string[]
  platforms: string[]
  price_usd: number
  category_slug: string
  status: 'draft' | 'published'
}

export const CAMERAS: CameraData[] = [
  {
    sku: 'See3CAM_CU135',
    name: 'See3CAM_CU135',
    slug: 'see3cam-cu135',
    tagline: '13MP USB 3.0 camera for machine vision and industrial inspection',
    description: 'The See3CAM_CU135 is a high-resolution 13MP USB 3.0 camera module built around the Sony IMX214 sensor. Designed for machine vision, barcode reading, and industrial inspection. Plug-and-play UVC compliance means zero driver installation.',
    interface: 'USB3.0',
    resolution: '13MP (4208×3120)',
    sensor: 'Sony IMX214',
    features: [],
    platforms: ['Raspberry Pi', 'AMD Xilinx'],
    price_usd: 149,
    category_slug: 'usb-cameras',
    status: 'published',
  },
  {
    sku: 'See3CAM_CU81',
    name: 'See3CAM_CU81',
    slug: 'see3cam-cu81',
    tagline: '8MP 4K wide-angle USB 3.0 camera with 120° field of view',
    description: 'The See3CAM_CU81 delivers 4K resolution at 30fps with a 120° wide-angle lens. Ideal for video conferencing, panoramic surveillance, and robotics perception tasks where wide FOV is essential.',
    interface: 'USB3.0',
    resolution: '8MP 4K (3264×2448)',
    sensor: 'Sony IMX415',
    features: ['wideAngle'],
    platforms: ['Raspberry Pi'],
    price_usd: 129,
    category_slug: 'usb-cameras',
    status: 'published',
  },
  {
    sku: 'See3CAM_130',
    name: 'See3CAM_130',
    slug: 'see3cam-130',
    tagline: '13MP autofocus USB 3.0 camera for document scanning and AR',
    description: 'The See3CAM_130 provides 13MP resolution with continuous autofocus, making it ideal for document scanning, augmented reality, and applications where sharp focus across varying distances is critical.',
    interface: 'USB3.0',
    resolution: '13MP (4208×3120)',
    sensor: 'AR1337',
    features: ['autofocus'],
    platforms: ['Raspberry Pi', 'AMD Xilinx'],
    price_usd: 169,
    category_slug: 'usb-cameras',
    status: 'published',
  },
  {
    sku: 'STURDeCAM57',
    name: 'STURDeCAM57',
    slug: 'sturdecamp57',
    tagline: '4K HDR global shutter GMSL2 camera for autonomous vehicles and outdoor robotics',
    description: 'The STURDeCAM57 is a ruggedised 4K HDR camera with Sony global shutter, rated IP67 for dust and water resistance. Built for GMSL2 serialiser links and validated on NVIDIA Jetson Orin NX. Ideal for ADAS, autonomous navigation, and any outdoor robotics application requiring zero-motion-blur capture.',
    interface: 'GMSL2',
    resolution: '4K HDR (3840×2160)',
    sensor: 'Sony IMX623',
    features: ['globalShutter', 'HDR', 'IP67'],
    platforms: ['NVIDIA Jetson Orin NX', 'NVIDIA Jetson AGX Orin'],
    price_usd: 349,
    category_slug: 'industrial-rugged',
    status: 'published',
  },
  {
    sku: 'STURDeCAM31',
    name: 'STURDeCAM31',
    slug: 'sturdecamp31',
    tagline: 'Full HD global shutter GMSL2 camera optimised for low-light outdoor environments',
    description: 'The STURDeCAM31 delivers Full HD resolution with a Sony global shutter, high sensitivity for low-light and fog conditions, and IP67 rating. Paired with GMSL2 serialisation for long-cable automotive deployments. Suited for surveillance, perimeter security, and fog-penetrating robotics vision.',
    interface: 'GMSL2',
    resolution: 'Full HD (1920×1080)',
    sensor: 'Sony IMX290',
    features: ['globalShutter', 'IP67'],
    platforms: ['NVIDIA Jetson Orin NX', 'NVIDIA Jetson AGX Orin'],
    price_usd: 299,
    category_slug: 'industrial-rugged',
    status: 'published',
  },
  {
    sku: 'NileCAM81',
    name: 'NileCAM81',
    slug: 'nilecam81',
    tagline: '8MP MIPI CSI-2 camera engineered for NVIDIA Jetson Orin platform',
    description: 'The NileCAM81 is an 8MP MIPI CSI-2 camera module purpose-built for NVIDIA Jetson Orin NX and AGX Orin. Features ISP-tuned colour science, low-light performance, and a compact board design suited for drone, robot, and embedded AI vision systems.',
    interface: 'MIPI-CSI2',
    resolution: '8MP (3840×2160)',
    sensor: 'Sony IMX415',
    features: [],
    platforms: ['NVIDIA Jetson Orin NX', 'NVIDIA Jetson AGX Orin'],
    price_usd: 199,
    category_slug: 'mipi-cameras',
    status: 'draft',
  },
  {
    sku: 'NileCAM21',
    name: 'NileCAM21',
    slug: 'nilecam21',
    tagline: '2MP HDR MIPI CSI-2 camera for NVIDIA Jetson in high-contrast scenes',
    description: 'The NileCAM21 is a 2MP HDR MIPI CSI-2 camera with wide dynamic range for challenging lighting environments. Optimised for NVIDIA Jetson Nano and Orin NX. Perfect for indoor robotics, people counting, and access control systems.',
    interface: 'MIPI-CSI2',
    resolution: '2MP (1920×1080)',
    sensor: 'Sony IMX462',
    features: ['HDR'],
    platforms: ['NVIDIA Jetson Nano', 'NVIDIA Jetson Orin NX'],
    price_usd: 129,
    category_slug: 'mipi-cameras',
    status: 'published',
  },
  {
    sku: 'e-CAM55_CUMI1335',
    name: 'e-CAM55_CUMI1335_MOD',
    slug: 'ecam55-cumi1335',
    tagline: '5MP compact MIPI CSI-2 OEM module for embedded vision systems',
    description: 'The e-CAM55_CUMI1335_MOD is a compact 5MP MIPI CSI-2 camera module designed for OEM integration in space-constrained embedded systems. Features a low-profile form factor and flexible cable routing, suited for medical devices, drones, and handheld scanners.',
    interface: 'MIPI-CSI2',
    resolution: '5MP (2592×1944)',
    sensor: 'Omnivision OV5647',
    features: [],
    platforms: ['Raspberry Pi', 'AMD Xilinx'],
    price_usd: 99,
    category_slug: 'mipi-cameras',
    status: 'published',
  },
]

export const CATEGORIES = [
  { name: 'USB Cameras', slug: 'usb-cameras', description: 'Plug-and-play USB 3.0 cameras for desktop and embedded applications' },
  { name: 'MIPI Cameras', slug: 'mipi-cameras', description: 'MIPI CSI-2 camera modules for NVIDIA Jetson, Raspberry Pi, and SoC platforms' },
  { name: 'Industrial / Rugged', slug: 'industrial-rugged', description: 'IP67-rated, global shutter cameras for automotive and outdoor robotics' },
  { name: 'Automotive / ADAS', slug: 'automotive-adas', description: 'GMSL2 serialiser cameras for ADAS and autonomous vehicle stacks' },
]
