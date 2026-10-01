import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança em todas as respostas:
 *  - HSTS: o navegador só acessa por HTTPS (2 anos);
 *  - o site não pode ser aberto dentro de um iframe de outro site (contra "clickjacking");
 *  - o navegador não "adivinha" o tipo de um arquivo (nosniff);
 *  - o endereço completo não vaza para outros sites ao clicar num link;
 *  - câmera, microfone e localização ficam desligados (o sistema não usa).
 * A CSP aqui é só a parte que não quebra o Firebase nem a geração de PDFs (sem restringir scripts).
 */
const CABECALHOS_SEGURANCA = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // firebase-admin (via firebase-admin/auth -> jwks-rsa -> jose) quebra quando o
  // bundler tenta empacotá-lo; deixando externo, o Node resolve nativamente em runtime.
  serverExternalPackages: ["firebase-admin"],
  async headers() {
    return [{ source: "/:path*", headers: CABECALHOS_SEGURANCA }];
  },
};

export default nextConfig;
