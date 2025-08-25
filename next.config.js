/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    forceSwcTransforms: true,
  },

  // จัดการเส้นทาง /en และ /th ให้ตัด prefix ออกเสมอ
  async redirects() {
    return [
      { source: '/en', destination: '/', permanent: false },
      { source: '/th', destination: '/', permanent: false },
      { source: '/en/:path*', destination: '/:path*', permanent: false },
      { source: '/th/:path*', destination: '/:path*', permanent: false },
    ];
  },

  // เพิ่ม headers เพื่อป้องกัน caching
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
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
