const { execSync } = require('child_process')

const BUILD_ID = `build-${Date.now()}`

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  generateBuildId: async () => BUILD_ID,
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
  async rewrites() {
    return []
  },
}

module.exports = nextConfig
