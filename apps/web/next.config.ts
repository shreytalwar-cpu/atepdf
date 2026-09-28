import type { NextConfig } from "next";
const dev = process.env.NODE_ENV !== "production";
const csp = ["default-src 'self'", `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`, "style-src 'self' 'unsafe-inline'", "img-src 'self' blob: data:", "font-src 'self'", "connect-src 'self'", "worker-src 'self' blob:", "object-src 'none'", "frame-src 'none'", "base-uri 'self'", "form-action 'none'", "frame-ancestors 'none'"].join('; ');
const config: NextConfig = {
  transpilePackages: ['react-native-web','react-native-svg','lucide-react-native','react-native-safe-area-context'],
  webpack(config) {
    config.resolve.alias = {...config.resolve.alias,'react-native$':'react-native-web'};
    config.resolve.extensions = ['.web.tsx','.web.ts','.web.js',...config.resolve.extensions];
    return config;
  },
  poweredByHeader: false, devIndicators: false,
  async headers() { return [{ source: '/:path*', headers: [
    {key:'Content-Security-Policy',value:csp},
    {key:'Referrer-Policy',value:'no-referrer'},
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
  ]}]; },
};
export default config;
