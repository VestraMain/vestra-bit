/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "unpdf",
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
