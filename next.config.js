/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // better-sqlite3 is a native module (.node binary); keep it out of the
    // webpack server bundle so it's loaded via Node's require at runtime.
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
}

module.exports = nextConfig
