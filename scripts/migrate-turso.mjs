// ─────────────────────────────────────────────────────────────
// migrate-turso.mjs — sync schema ขึ้น Turso (prod) โดยไม่ทำลายข้อมูล
//
// ทำไมต้องมีสคริปต์นี้: Prisma 7 CLI (`migrate deploy`) ไม่รู้จัก scheme
// libsql:// (error P1013) และ prisma.config.ts เวอร์ชันนี้ไม่มีช่องใส่
// driver adapter สำหรับ migrate → เลย apply ผ่าน @libsql/client ตรงๆ
//
// วิธีรัน (แทน <token> ด้วย TURSO_AUTH_TOKEN จริง):
//   DATABASE_URL="libsql://....turso.io" TURSO_AUTH_TOKEN="<token>" node scripts/migrate-turso.mjs
//
// ปลอดภัย: ใช้ ADD COLUMN / CREATE TABLE IF NOT EXISTS — รันซ้ำได้ ไม่ลบข้อมูล
// ─────────────────────────────────────────────────────────────
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !url.startsWith("libsql")) {
  console.error("❌ ตั้ง DATABASE_URL ให้เป็น libsql://... ก่อน (อย่าใช้ file:./dev.db)");
  process.exit(1);
}
// token จริงเป็น JWT (ขึ้นต้น "ey", ไม่มีช่องว่าง) · ถ้าไม่ใช่ มักเป็นข้อความ error
// จาก `turso db tokens create` ตอนยังไม่ได้ login → กันส่ง token ขยะแล้วเจอ HTTP 400 งงๆ
if (!authToken || !/^ey[A-Za-z0-9_-]+\./.test(authToken.trim())) {
  console.error(
    "❌ TURSO_AUTH_TOKEN ไม่ใช่ token จริง (ควรขึ้นต้น 'ey...')\n" +
      "   มักเกิดจาก `turso db tokens create` ตอนยังไม่ได้ login → ได้ข้อความ error มาแทน token\n" +
      "   แก้: รัน `turso auth login` ก่อน  หรือ  ก๊อป TURSO_AUTH_TOKEN จาก Vercel env มาใช้ตรงๆ"
  );
  if (authToken) console.error(`   (ค่าที่ได้ตอนนี้: "${authToken.slice(0, 50)}...")`);
  process.exit(1);
}

const db = createClient({ url, authToken });

async function tableExists(name) {
  const r = await db.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    args: [name],
  });
  return r.rows.length > 0;
}
async function columnNames(table) {
  const r = await db.execute(`PRAGMA table_info("${table}")`);
  return r.rows.map((row) => row.name);
}

async function run(label, sql) {
  process.stdout.write(`→ ${label} ... `);
  await db.execute(sql);
  console.log("ok");
}

console.log(`\n🔗 เชื่อมต่อ Turso: ${url}\n`);

// 1) เพิ่มคอลัมน์ roomId ให้ 3 ตารางเดิม (ถ้ายังไม่มี)
for (const t of ["Task", "Session", "ScheduleSlot"]) {
  if (!(await tableExists(t))) {
    console.log(`⚠️  ไม่พบตาราง ${t} — ข้าม (DB อาจยังไม่ได้ init)`);
    continue;
  }
  const cols = await columnNames(t);
  if (cols.includes("roomId")) {
    console.log(`✓ ${t}.roomId มีอยู่แล้ว — ข้าม`);
  } else {
    await run(
      `ADD COLUMN ${t}.roomId`,
      `ALTER TABLE "${t}" ADD COLUMN "roomId" TEXT NOT NULL DEFAULT 'default'`
    );
  }
}

// 1.5) Task.scheduledFor (สำหรับ backlog ที่ปักวันได้)
if (await tableExists("Task")) {
  const cols = await columnNames("Task");
  if (cols.includes("scheduledFor")) {
    console.log(`✓ Task.scheduledFor มีอยู่แล้ว — ข้าม`);
  } else {
    await run("ADD COLUMN Task.scheduledFor", `ALTER TABLE "Task" ADD COLUMN "scheduledFor" DATETIME`);
  }
}

// 1.7) RoomSetting (settings ต่อห้อง — sync ข้าม device)
await run(
  "create RoomSetting",
  `CREATE TABLE IF NOT EXISTS "RoomSetting" (
    "roomId" TEXT NOT NULL PRIMARY KEY,
    "workMinutes" INTEGER NOT NULL DEFAULT 25,
    "shortBreakMinutes" INTEGER NOT NULL DEFAULT 5,
    "longBreakMinutes" INTEGER NOT NULL DEFAULT 15,
    "pomodorosPerLongBreak" INTEGER NOT NULL DEFAULT 4,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`
);

// 1.8) DaySummary (สถิติยอดรายวัน — snapshot ตอนปิดวัน)
await run(
  "create DaySummary",
  `CREATE TABLE IF NOT EXISTS "DaySummary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" TEXT NOT NULL DEFAULT 'default',
    "date" TEXT NOT NULL,
    "totalPomodoros" INTEGER NOT NULL DEFAULT 0,
    "tasksDone" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`
);
await run(
  "unique DaySummary(roomId,date)",
  `CREATE UNIQUE INDEX IF NOT EXISTS "DaySummary_roomId_date_key" ON "DaySummary"("roomId", "date")`
);
await run("index DaySummary.roomId", `CREATE INDEX IF NOT EXISTS "DaySummary_roomId_idx" ON "DaySummary"("roomId")`);

// 2) index บน roomId
await run("index Task.roomId", `CREATE INDEX IF NOT EXISTS "Task_roomId_idx" ON "Task"("roomId")`);
await run("index Session.roomId", `CREATE INDEX IF NOT EXISTS "Session_roomId_idx" ON "Session"("roomId")`);
await run("index ScheduleSlot.roomId", `CREATE INDEX IF NOT EXISTS "ScheduleSlot_roomId_idx" ON "ScheduleSlot"("roomId")`);

// 3) ตาราง Auth.js (User + Account)
await run(
  "create User",
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "roomId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`
);
await run("unique User.email", `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`);
await run(
  "create Account",
  `CREATE TABLE IF NOT EXISTS "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    PRIMARY KEY ("provider", "providerAccountId"),
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`
);

console.log("\n✅ Turso schema ตรงกับโค้ดแล้ว — prod พร้อมใช้งาน\n");
