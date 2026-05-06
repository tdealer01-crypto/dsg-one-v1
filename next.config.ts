import type {NextConfig} from 'next';

const isTermuxLike = Boolean(
  process.env.TERMUX_VERSION ||
  process.env.PREFIX?.includes('/com.termux') ||
  process.env.HOME?.includes('/com.termux') ||
  process.env.DSG_TERMUX_DEV === 'true'
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // Android/Termux and some ephemeral CI filesystems can fail while webpack tries
    // to snapshot loader dependencies for its persistent cache. Disable that cache
    // globally for deterministic DSG builds. Next still performs normal compilation.
    config.cache = false;

    if (dev && isTermuxLike) {
      // Termux cannot watch Android root paths like /data and /. Poll only the
      // project files and ignore inaccessible system directories to stop EACCES
      // Watchpack spam while keeping local dev usable.
      config.watchOptions = {
        ...(config.watchOptions || {}),
        poll: 1000,
        aggregateTimeout: 300,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '/data/**',
          '/proc/**',
          '/sys/**',
          '/dev/**',
          '/acct/**',
          '/apex/**',
          '/mnt/**',
          '/storage/**',
        ],
      };
    }

    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify-file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
