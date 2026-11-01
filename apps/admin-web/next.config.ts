import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // packages/shared is TypeScript source (with `.ts` import paths, for Deno).
  transpilePackages: ['@petsitter/shared'],
  // npm workspaces hoist node_modules to the repo root.
  turbopack: { root: path.join(__dirname, '../..') },
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
