import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    // authToken ใช้สำหรับ Turso cloud — ถ้าใช้ SQLite local ไม่จำเป็น
    ...(process.env["TURSO_AUTH_TOKEN"] && {
      authToken: process.env["TURSO_AUTH_TOKEN"],
    }),
  },
});
