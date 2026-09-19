import type { NextConfig } from "next";

const config: NextConfig = {
  // Fully static site: `next build` writes plain files to ./out. No server runtime.
  output: "export",
  reactStrictMode: true,
  // The image optimizer needs a server; the app uses no <Image> anyway.
  images: { unoptimized: true },
};

export default config;
