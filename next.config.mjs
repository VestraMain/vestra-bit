/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "pdf-parse",
      "pdf-parse/node",
      "pdfkit",
      "canvas",
      "pdf-to-img",
      "sharp",
      "jszip",
    ],
  },
};

export default nextConfig;
