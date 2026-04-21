/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ── Force a unique build ID on every deploy ───────────────────────────
  // This makes Vercel serve fresh JS/CSS chunks to ALL users automatically,
  // even those with old bundles cached — no manual cache clearing needed.
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },

  async headers() {
    return [
      {
        // ── API routes — never cache ────────────────────────────────────
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma',        value: 'no-cache' },
          { key: 'Expires',       value: '0' },
        ],
      },
      {
        // ── HTML pages — always revalidate ──────────────────────────────
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
