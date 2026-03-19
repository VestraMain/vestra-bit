/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "pdfjs-dist",
      "pdfkit",
      "canvas",
      "pdf-to-img",
      "sharp",
      "jszip",
    ],
  },
};

export default nextConfig;
