/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdf-parse/node", "pdfkit"],
  },
};

export default nextConfig;
