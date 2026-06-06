import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],

  // build version → โชว์บนจอ (ยืนยันว่า client โหลด bundle เวอร์ชันไหน)
  env: {
    NEXT_PUBLIC_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
  },

  // กัน browser cache HTML → ทุกครั้งที่โหลดได้ chunk JS ล่าสุดเสมอ (แก้ bundle เก่าค้างบนมือถือ)
  // ไม่แตะ /_next/static/* (hashed assets ยัง cache ยาวได้ตามปกติ)
  async headers() {
    return [
      {
        source: "/",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
