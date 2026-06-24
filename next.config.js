/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // node:sqlite is a built-in Node module; keep it out of the webpack server
    // bundle so it's loaded via Node's require at runtime instead of bundled.
    serverComponentsExternalPackages: ['node:sqlite'],
  },
}

module.exports = nextConfig
