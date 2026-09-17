import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin (via firebase-admin/auth -> jwks-rsa -> jose) quebra quando o
  // bundler tenta empacotá-lo; deixando externo, o Node resolve nativamente em runtime.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
