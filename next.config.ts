import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  async redirects() {
    return [
      { source: '/markets', destination: '/', permanent: false },
      { source: '/trendplay', destination: 'https://www.epicaiwars.com/trends', permanent: false },
      { source: '/market/aiwars/:path*', destination: 'https://www.epicaiwars.com/trends', permanent: false },
    ];
  },
};

export default nextConfig;
