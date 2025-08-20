/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { forceSwcTransforms: true },

  // ปิด i18n และจัดการ /en,/th ด้วย redirects
  async redirects() {
    return [
      { source: '/en', destination: '/', permanent: false },
      { source: '/th', destination: '/', permanent: false },
      { source: '/en/:path*', destination: '/:path*', permanent: false },
      { source: '/th/:path*', destination: '/:path*', permanent: false },
    ];
  },

  webpack: (config) => {
    config.module.rules.push({
      test: /\.(woff|woff2|eot|ttf|otf)$/i,
      type: 'asset/resource',
    });
    return config;
  },
};
module.exports = nextConfig;
