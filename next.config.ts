import type { NextConfig } from "next";

// 全ページに付けるセキュリティヘッダ。
// Referrer-Policy: 受付票URL（?id= に予約IDを含む）が外部サイトへリファラとして漏れるのを防ぐ。
//   strict-origin-when-cross-origin は外部宛にはオリジンのみを送り、パスとクエリを落とす。
// Permissions-Policy: /admin/scanner がカメラを使うため camera は self を許可し、他は無効化する。
const commonSecurityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
  },
];

// フレーム埋め込みの禁止は管理画面配下だけに限定する。
// トップページ（/）はLINEミニアプリ（LIFF）から開かれるため、
// 埋め込みを一律に禁止すると受験生側の導線を壊すおそれがある。
const adminFrameHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: commonSecurityHeaders,
      },
      // `/admin/:path*` は `/admin` 自身にマッチしないため、両方を明示する
      {
        source: "/admin",
        headers: adminFrameHeaders,
      },
      {
        source: "/admin/:path*",
        headers: adminFrameHeaders,
      },
    ];
  },
};

export default nextConfig;
