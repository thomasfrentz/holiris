/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Un seul domaine pour Google : tout renvoie vers https://holiris.fr
  async redirects() {
    return [
      { source: '/:path*', has: [{ type: 'host', value: 'holiris.vercel.app' }], destination: 'https://holiris.fr/:path*', permanent: true },
      // La landing est servie sur "/" : évite une page en double
      { source: '/landing', destination: '/', permanent: true },
    ]
  },
};

export default nextConfig;
