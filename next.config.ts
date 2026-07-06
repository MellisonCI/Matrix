import type { NextConfig } from 'next'

// No `output: 'standalone'` here -- that mode is for self-hosted/Docker
// deployments. Vercel packages Next.js itself and, in this project, treating
// the build as if it needed a standalone Node server output caused Vercel to
// look for (and fail to find) a "public" static-site output directory.
const nextConfig: NextConfig = {}

export default nextConfig
