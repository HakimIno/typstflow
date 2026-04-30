import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @ts-ignore - ปิด Warning เรื่อง Root โดยใช้ Absolute Path
  turbopack: {
    root: path.resolve('.'),
  },

  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    if (isServer) {
      config.output.webassemblyModuleFilename = 'static/wasm/[modulehash].wasm';
    }

    return config;
  },
};

export default nextConfig;
