/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false
  },
  images: {
    // CDNs públicos de los supers que servimos como hotlink. Whitelist explícita.
    remotePatterns: [
      { protocol: 'https', hostname: '**.disco.com.ar' },
      { protocol: 'https', hostname: '**.jumbo.com.ar' },
      { protocol: 'https', hostname: '**.vea.com.ar' },
      { protocol: 'https', hostname: '**.masonline.com.ar' },
      { protocol: 'https', hostname: '**.carrefour.com.ar' },
      { protocol: 'https', hostname: '**.dinoonline.com.ar' },
      { protocol: 'https', hostname: '**.supermami.com.ar' },
      { protocol: 'https', hostname: 'statics.dinoonline.com.ar' },
      { protocol: 'https', hostname: '**.vtexassets.com' },
      { protocol: 'https', hostname: '**.vteximg.com.br' }
    ]
  }
};

export default nextConfig;
