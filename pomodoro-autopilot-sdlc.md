# Pomodachi — Full SDLC (Final)
*เดิมชื่อ "Pomodoro Autopilot" · repo/folder/URL ยังเป็น `pomodoro-autopilot`*

> ระบบจัดเวลาแบบ auto: brain dump งาน → ระบบจัด Pomodoro + เดินนาฬิกาเอง + เตือนเมื่อหมดเวลา โดยไม่ต้องตั้งเวลาเอง
>
> **สถานะ:** Flagship project (แทนที่ expense tracker) — ทำใน **Week 5–6** ของ 12-Week SDET Plan
> **เป้าหมายซ้อน:** Portfolio piece + ใช้ตอบสัมภาษณ์ SDET ("PM ที่เขียน production-grade automated test ได้")
>
> **อัปเดตล่าสุด (2026-06-10):** 🚀 **ใช้งานจริงบน prod ทุกวัน** (Vercel + Turso) — Round 4 เน้น **ปิด loop การใช้งานรายวัน + ประวัติ + ขัดเงา UI** · **Archive task ที่เสร็จ** (ปุ่ม 🧹 เก็บเข้าคลัง, status `archived`) + **auto จบวันเที่ยงคืน** (date rollover ผ่าน localStorage → archive done + reset timer, task ค้างยกมาวันใหม่) · **แท็บ 📊 Stats** = ประวัติรายวัน (🍅/task) + แท่งสัดส่วน + สรุป**ค่าเฉลี่ย/วัน** + **คลิกวันกางดู task ของวันนั้น** · สถิติ derive จาก **`Task.doneDate`** (วันที่ขีดฆ่า = เสร็จจริง, intrinsic → คงอยู่แม้ archive · pivot ทิ้ง DaySummary snapshot) · **edit/delete task ใน Backlog** ได้แล้ว (parity กับ Schedule) · **ลากเรียงลำดับ task** (drag-reorder, @dnd-kit — กดค้างลากบนมือถือ) · scrollbar บางกลืนธีม · **Phase 2 QA ยังไม่เริ่ม ← งานหลักที่เหลือ**
>
> *(เดิม 2026-06-09 · Round 3 — เสถียรบนมือถือ + sync ข้ามเครื่อง: ปิดมหากาพย์ timer ค้าง 00:01 (timeout + local-first + clock-skew + server-clamp + no-store + build stamp), multi-device sync (session/task/backlog/settings re-fetch on focus), finish-early, Screen Wake Lock, mobile audio unlock, cadence/advance/reorder, glass dropdown/popup/scrim, favicon 🍎)*
>
> *(เดิม 2026-06-06: deploy prod ครบ Slice 1–4 + Room + Login + UI 3 รอบ (dusk → Ember+Split → Glass/Mirror) + Backlog ปักวันได้ + switch/skip — ดู Build Log Round 1–2)*

---

## 0. Locked Decisions (สรุปย่อสำหรับอ้างอิงเร็ว)

### 0a. Technical Decisions (เดิม)

| ประเด็น | ที่ล็อกไว้ |
|---|---|
| Platform (flagship) | Web app เท่านั้น (desktop-primary) |
| Database | **Prisma + SQLite** (ไม่ใช่ Notion — Notion ขัดกับ stack) → *ภายหลังย้ายเป็น **Turso / libSQL** ซึ่ง SQLite-compatible แต่เป็น cloud (sync ข้ามเครื่องได้) — ดู Build Log* |
| นาฬิกา | เว็บเดินเอง + เตือนเอง (Web Notifications + เสียง), timestamp-based |
| Pause behavior | **Pause/Resume + Restart (Option A)** — รายละเอียดข้อ 4 |
| Interrupt | แยก flow ออกจาก pause (reschedule) |
| Line / Notion / cross-device push | **Future Work** (ไม่อยู่ใน flagship) |
| Test stack | TS · Jest · Supertest+Axios+Zod · Cypress · Playwright · GitHub Actions · Allure/Mochawesome |
| ตัดออกแล้ว (ขัด stack) | Postman, Selenium, Notion-as-DB |
| Test pyramid | 70 unit / 20 integration / 10 E2E |

### 0b. Session Decisions (ล็อกเพิ่มใน Session ล่าสุด — 2026-05-30)

| ประเด็น | ที่ล็อกไว้ |
|---|---|
| เป้าหมายผลิตภัณฑ์ | ใช้งานได้จริงในชีวิตประจำวัน แทน Pomodoro app เดิม |
| Build approach | **Product first, QA second** — สร้าง product ให้ใช้ได้ก่อน แล้วค่อยเพิ่ม test layer |
| Build strategy | **Top-down vertical slice** — ทำ 1 feature ให้ครบ end-to-end ก่อน แล้วขยาย |
| Slice แรก | Brain dump + Task list + Timer + Notification ในหน้าเดียว |
| Architecture | Engine = pure functions ก่อน → API → React Hook → UI ครอบ |
| Persistence | DB ตั้งแต่ slice แรก — state ไม่หายตอน refresh |
| TimerState shape | `{ state, origin, remainingMs }` — origin เป็น field แยก (ไม่ embed ทั้ง state) |
| completedPomodoros | อยู่ใน `TimerState` — self-contained, ไม่ผ่าน parameter |
| UI style | *(เดิม: dark warm-focus #111/amber)* → ปัจจุบัน **Ember** (กระดาษ/ดินเผา สว่าง, accent terracotta `#c15f3c`) + layout **Split 50/50** ตาม design handoff |
| UI components | **shadcn/ui** + Tailwind |
| Test tools deferred | Jest · Supertest · Cypress · Playwright · GitHub Actions → เพิ่มใน QA phase |
| QA approach | เริ่มจาก manual → E2E (top-down pyramid) → integration → unit |

---

## 1. Product Scope

### IN — Flagship (Week 5–6)
- **Brain dump** — พิมพ์ task ทั้งหมด (ตอนเย็น/ก่อนนอน) ในเว็บ
- **Morning review** — ปรับ/จัดลำดับ priority ตอนเช้า
- **Auto-schedule** — จัด task เป็น Pomodoro slots อัตโนมัติ (หัวใจ logic)
- **Auto-clock** — เว็บเดินนาฬิกาเอง, auto-advance ทั้งวัน
- **Alert / Notification** — Web Notification API + เสียง เมื่อ timer ถึง 0 (ทั้ง WORK หมดและ BREAK หมด)
- **Pause / Resume / Restart** — ตามข้อ 4
- **Interrupt → reschedule** — งานด่วนแทรก จัด schedule ที่เหลือใหม่
- **Backlog** — task ค้างย้ายข้ามวัน + งานอนาคต park ไว้
- **Work + Personal tasks** — AI แทรก "reward pomodoro" — ❌ *ยังไม่ได้ทำ (deferred)*

### เพิ่มภายหลัง — build + deploy แล้ว (นอกแผน flagship เดิม)
- **Configurable durations** — ตั้งเวลา WORK/BREAK/LONG_BREAK เองได้ (แท็บ Settings)
- **Room** — แยกข้อมูลต่อผู้ใช้ + แชร์ห้องผ่านลิงก์ (สร้าง / แก้รหัส+เช็คซ้ำ / เข้าห้องอื่น / ลบห้อง)
- **Login (optional Google sign-in)** — claim ห้อง + เข้าถึงข้ามเครื่อง (ไม่บังคับ login)
- **Task edit / delete** — แก้ชื่อ + จำนวน 🍅 inline · ลบ task (กัน task ที่กำลังโฟกัสไม่ให้ลบ) · **ใช้ได้ทั้ง Schedule + Backlog** (UI/handler ชุดเดียวกัน, handler reload ทั้งสอง list)
- **Task picker ตอน IDLE (C2)** — preview "ถัดไป · &lt;task&gt;" + ปุ่ม "เปลี่ยน" ก่อนกดเริ่ม
- **Switch/Skip task กลางลูก** — คลิก "เริ่ม" task อื่นใน list = switch · ปุ่ม "⏭ ข้าม" ใน timer = ไป next pending (ลูกที่ทิ้งไม่นับ, confirm 2 ชั้น)
- **Defer to Backlog + scheduledFor** — task ใน Schedule กดปุ่ม 📥 ย้ายไป Backlog · Backlog ปักวันได้ (native date picker, แยก 2 section: มีกำหนด/ยังไม่กำหนด) · auto-promote ตอนถึงวันที่ปัก
- **Responsive + ธีม Ember + Glass/Mirror UI** — มือถือ stack · desktop Split **60:40** (timer ซ้าย, panel ขวาเต็มความสูง) บนพื้นรูปอินทีเรีย
- **Finish early (จบ task ก่อนเวลา)** — ปุ่ม "✓ เสร็จ task นี้" ขณะ WORK · นับลูกที่กำลังทำให้ task เดิม **เต็มลูก (ไม่มีเศษ)** + mark done · เวลาที่เหลือเดินต่อให้ task ถัดไป (โชว์ "(ต่อเวลา)")
- **Multi-device sync** — กลับมา focus หน้าจอ (`visibilitychange→visible`) = re-fetch session + task list + backlog + settings จาก server เสมอ → 2 เครื่องเห็นตรงกัน · settings เก็บ **per-room ที่ server** (`RoomSetting` + `/api/settings`), localStorage เป็นแค่ cache
- **Screen Wake Lock + mobile audio** — จอไม่ดับระหว่างโฟกัส (Wake Lock API) · ปลดล็อกเสียง alarm บนมือถือด้วย AudioContext singleton ที่ prime ตอน user gesture (start/resume/switch/skip)
- **Sync-error toast** — session API ล้มเหลว = เด้ง toast แทนเงียบๆ (ไม่ปล่อยให้ timer ค้างแบบไม่รู้สาเหตุ)
- **Archive task ที่เสร็จ + auto จบวันเที่ยงคืน** — ปุ่ม 🧹 เก็บ task ที่เสร็จเข้าคลัง (status `archived`, ซ่อนจาก Schedule แต่เก็บใน DB) · ข้ามวันแล้วเปิดแอป = auto archive + reset timer, task ค้างยกมาวันใหม่
- **Dashboard สถิติรายวัน** — แท็บ 📊 Stats: ยอด 🍅/task รายวัน + แท่งสัดส่วน + สรุปค่าเฉลี่ย/วัน · คลิกวัน → กางดู task ของวันนั้น (derive จาก `Task.doneDate` = วันที่ขีดฆ่า/เสร็จจริง)

### OUT — Future Work (เขียนเป็น Roadmap ใน README)
- Line Bot notification (แก้ปัญหา mobile-background reliability)
- Notion sync
- Cross-device PWA + Service Worker push
- auto-void-on-long-pause (optional)
- AI reward pomodoro (personal task)

### Daily Journey (flagship, web-based)
```
เย็น   → brain dump task ในเว็บ
เช้า   → review + ปรับ priority → ระบบ generate schedule
ทั้งวัน → เว็บเดินนาฬิกาเอง: WORK 25:00 → เตือน → BREAK 5:00 → เตือน → ลูกถัดไป
        ครบ 4 รอบ → LONG_BREAK 15–30:00
แทรก   → กรอกงานด่วน → ระบบจัด schedule ที่เหลือใหม่
จบวัน  → สรุป + task ค้าง → ย้าย Backlog
```
> ข้อจำกัดที่ document ไว้: นาฬิกาเตือนได้ชัวร์เมื่อ tab เปิด/focus และ catch-up ถูกต้องเมื่อกลับมาที่ tab; กรณีมือถือล็อกจอ background = known limitation → แก้ด้วย Line integration ใน Roadmap (เป็น interview story)

---

### 1.1 User Journeys & Use-Cases — สำหรับ Design Handoff (อัปเดต 2026-05-31)

> สะท้อน **แอปจริงที่ deploy แล้ว** ครบทุกฟีเจอร์ปัจจุบัน · ใช้เป็นฐานออกแบบ UI/flow/states · ธีมปัจจุบัน = **Ember** (กระดาษ/ดินเผา terracotta) + layout **Split 50/50** (ตาม design handoff `design_handoff_ember_split`)

#### 🗺️ A. โครงหน้าจอ (Single-page)
แอปเป็น **หน้าเดียว** ประกอบด้วย 4 โซน:
1. **Header** — โลโก้ · ป้ายห้อง 🔑 (dropdown จัดการห้อง) · ปุ่ม/avatar บัญชี 👤
2. **Timer (hero)** — badge สถานะ · ชื่อ task ที่ทำอยู่ · วงแหวนนับถอยหลัง · ปุ่มควบคุม
3. **Side panel** — 3 แท็บ: **Schedule** (เพิ่ม+รายการ task), **Backlog**, **Settings**
4. **Interrupt FAB** — ปุ่มลอยมุมขวาล่าง (โผล่ตอน WORK/PAUSED)

**Responsive:**
- **Desktop (≥768px):** sidebar ซ้าย + timer กลาง
- **Mobile (<768px):** stack แนวตั้ง — timer อยู่บนสุด, panel เลื่อนลงล่าง

#### 🚶 B. User Journeys (ทุก flow ที่ทำได้จริง)
| # | Journey | ขั้นตอน |
|---|---|---|
| J1 | **Brain dump → จัดตาราง** | พิมพ์ task + จำนวน 🍅 → กดเพิ่ม (cursor อยู่ช่องเดิม พิมพ์ต่อได้) → ระบบ auto-schedule |
| J2 | **โฟกัส/พักอัตโนมัติ** | กด "เริ่ม"/"เลือก" task → WORK 25:00 → หมดเวลา (เสียง+noti) → BREAK อัตโนมัติ → task ถัดไป → ครบ 4 รอบ = LONG_BREAK |
| J3 | **Pause / Resume / Restart** | หยุดชั่วคราว → เดินต่อ(ลูกเดิม) · เริ่มใหม่(reset 25:00 ไม่นับ) |
| J4 | **แทรกงานด่วน** | กด Interrupt FAB → กรอกงาน → void ลูกปัจจุบัน + จัด schedule ใหม่ + เริ่มงานด่วนทันที |
| J5 | **แก้ไข/ลบ/จัดลำดับ task** | แก้ชื่อ+🍅 inline (ดับเบิลคลิก/✎) + 🗑 ลบ → **ทำได้ทั้ง Schedule + Backlog** (task ที่กำลังโฟกัส **ลบไม่ได้**) · จัดลำดับ (Schedule เท่านั้น): ▲▼ ทีละ 1 หรือ **กดค้าง+ลากการ์ด** (drag-reorder) · Backlog เรียงตามวันที่ปัก |
| J6 | **จบวัน** | "จบวัน → ย้าย Backlog" → task ค้างไป Backlog + สรุปยอด 🍅 · Backlog: ดึง task กลับมาทำได้ |
| J7 | **ตั้งค่าเวลา** | แท็บ Settings → ปรับ WORK/BREAK/LONG_BREAK (number + ปุ่ม ±) |
| J8 | **Room (จัดการห้อง)** | 🔑 → **แก้รหัสห้อง** (เช็คซ้ำ live: ✓ว่าง/✗มีคนใช้) · **+ สร้างห้องใหม่** · **เข้าห้องอื่น** (ใส่ code) · **ลบห้อง** (confirm 2 ชั้น → ห้องเปล่าใหม่) · **copy link** แชร์ |
| J9 | **Login (optional)** | กด Sign in → Google → avatar โผล่ · กด avatar → "ใช้ห้องนี้กับบัญชี" (claim) → login เครื่องอื่นเจอห้องเดิม · Sign out |

#### 🎨 C. States ที่ต้องออกแบบ (designer checklist)
- **Timer:** IDLE "พร้อมเริ่ม" / WORK "โฟกัส 🍅" / SHORT_BREAK "พักสั้น ☕" / LONG_BREAK "พักยาว 🛋️" / PAUSED "หยุดพัก ⏸" / loading "--:--"
- **Task item:** ปกติ / **active** (ไฮไลต์ terracotta tint + จุดกะพริบ) / **done** (rank=✓ sage, ขีดฆ่า) / **editing** (inline input) / hover (โผล่ปุ่ม ✎ 🗑)
- **Task list:** ว่าง ("ยังไม่มี task — พิมพ์ด้านบน 👆") / มีรายการ
- **Room dropdown:** ปัจจุบัน(+แก้รหัส+copy) / สร้างใหม่ / เข้าห้องอื่น / danger zone ลบ(idle→confirm) · rename: checking/available/taken/invalid
- **Account:** signed-out (ปุ่ม Sign in) / signed-in (avatar + dropdown: email, claim, sign out) / claimed vs not
- **Feedback:** เสียง + Web Notification ตอนหมดเวลา · confirm dialogs · summary จบวัน
- **Error/edge:** ห้องว่าง · network error · OAuth error (Testing mode = เฉพาะ test users)

#### 🧩 D. Component → ไฟล์ (อ้างอิงให้ designer/dev คุยกัน)
`PomodoroApp` (layout) · `Timer` · `ScheduleMain` (task list+form+สรุปวันนี้) · `TaskForm` · `BacklogView` · `StatsView` (สถิติรายวัน) · `SettingsPanel` · `InterruptButton` · `RoomBadge` · `AccountButton`
> *(สรุปวันนี้ย้ายเข้า `ScheduleMain` footer แล้ว — component `DaySummary.tsx` เก่าถูกลบทิ้ง 2026-06-10)*

#### 🌙 E. Visual ปัจจุบัน + จุดที่อยากให้ designer ช่วยขัด
- **ธีม Ember:** พื้นหลังกระดาษอุ่น (`.ember-bg` ครีม→ดินเผา) + `.paper-panel` (กระจกฝ้าบางๆ) + accent **terracotta `#c15f3c`** · break: sage/teal · ฟอนต์ Newsreader (serif/timer) + IBM Plex Sans Thai
- **Token:** map เข้า shadcn CSS variables (`--background`, `--primary`, `--card`, `--border`, `--muted-foreground`…) + Ember extras (`--ink-soft`, `--faint`, `--success`, `--break-long`, `--ring-track`) ใน `globals.css`
- **micro-interactions:** dropdown `pm-pop`, toast `pm-toast`, ring 1s linear, ปุ่ม/การ์ด ~0.15s · ทุก panel เข้าธีมครบแล้ว (Backlog/Settings/dropdown polish เสร็จ)

---

## 2. Architecture (4 Testable Layers)

```
┌────────────────────────────────────────────┐
│  Web UI + Notification (Web API + sound)     │ ← Cypress + Playwright (E2E)
├────────────────────────────────────────────┤
│  Pomodoro Engine = Finite State Machine      │ ← Jest (หัวใจ unit, ~70%)
│  IDLE · WORK · SHORT_BREAK · LONG_BREAK ·    │
│  PAUSED   (pure functions, no I/O)           │
├────────────────────────────────────────────┤
│  API Routes (tasks / schedule / session /    │ ← Supertest + Axios + Zod
│  backlog / settings / stats / room / auth)   │   (integration, ~20%)
├────────────────────────────────────────────┤
│  Prisma + Turso/libSQL (state, settings,     │ ← seed/reset ใน test
│  rooms, tasks · local: file SQLite)          │
└────────────────────────────────────────────┘
   External (Line, Notion) = Future → mock เมื่อเพิ่ม
```

> **Models:** `Session` (endsAt/state/completedPomodoros/currentTaskId) · `Task` (estimatedPomodoros/completedPomodoros/status/scheduledFor/priority) · `ScheduleSlot` · `RoomSetting` (work/short/long/perLong นาที, per-room) · `User`/`Account` (auth) — ทุกตาราง scope ด้วย `roomId` + `@@index([roomId])` · **สถิติรายวันไม่มีตารางแยก — derive จาก `Task.doneDate`** (groupBy)
> **Client sync layer (Round 3):** `usePomodoro` = local-first engine (optimistic `tick()` + clock-offset + `Promise.race` timeout) · `useSettings(roomHeaders)` = server-source-of-truth + localStorage cache · re-fetch on `visibilitychange→visible` (session + tasks + backlog + settings)

**หลักการ timer:** เก็บ `endsAt` (timestamp) ไม่ใช่นับ tick → คำนวณ `remaining` จากเวลาจริงทุก tick และตอน `visibilitychange`/refocus เพื่อ catch-up ให้ถูกแม้ tab ถูก throttle

---

## 3. Pomodoro Engine — State Machine

```
IDLE ──start──▶ WORK
WORK ──timer 0──▶ SHORT_BREAK   (ถ้า cycle < 4)
WORK ──timer 0──▶ LONG_BREAK    (ถ้าเป็นลูกที่ 4)
WORK ──pause──▶ PAUSED(from WORK)
WORK ──restart──▶ WORK          (reset 25:00, partial ไม่นับ)

SHORT_BREAK ──timer 0──▶ WORK   (ลูก/งานถัดไป)
SHORT_BREAK ──skip──▶ WORK
BREAK ──pause──▶ PAUSED(from BREAK)

LONG_BREAK ──timer 0──▶ WORK | DONE (ถ้า schedule หมด)

PAUSED ──resume──▶ (กลับ state เดิม, remaining คงเดิม)
PAUSED ──restart──▶ WORK        (reset 25:00, partial ไม่นับ)

WORK ──switch(taskId)──▶ WORK   (void ลูกปัจจุบัน + start WORK ใหม่ผูก task อื่น)
WORK ──skip──▶ WORK | IDLE      (void ลูก in-flight + ไป next pending · ลูกที่เสร็จแล้วเก็บไว้)
WORK ──finishEarly──▶ WORK | IDLE (credit ลูก in-flight ให้ task เต็มลูก→done · เวลาที่เหลือเดินต่อให้ task ถัดไป)

[Interrupt] = flow แยก: void ลูกปัจจุบัน + แทรก task ด่วน + reschedule ที่เหลือ
```

> PAUSED จำ origin (WORK/BREAK) ไว้เพื่อ resume กลับให้ถูก
>
> **Session actions ที่ implement จริง (`/api/session` POST):** `start` · `pause` · `resume` · `restart` · `expire` · `switch` · `skip` · `finishEarly` · `clampDuration`
>
> **พฤติกรรมสำคัญที่เพิ่มจาก use-case จริง (Round 3):**
> - **นับ pomodoro:** `expire` (WORK→BREAK) เพิ่ม `task.completedPomodoros++` + mark `done` เมื่อครบ estimated + ปิด ScheduleSlot
> - **Advance-to-next:** BREAK→WORK ถ้า task เดิม `done` แล้ว → เลื่อนไป next pending (priority desc, id asc) · หมดคิว → IDLE (ไม่เดิน WORK ลอยๆ บน task ที่ขีดฆ่า)
> - **Cadence reset:** `start` reset `completedPomodoros: 0` ต่อ session → จังหวะ long break (`% POMODOROS_PER_LONG_BREAK`) ไม่สะสมข้ามวัน
> - **Server-clamp expire:** `effectiveNow = max(nowMs, endsAt)` → server ขยับเสมอเมื่อ client บอกหมด แม้นาฬิกา server ช้า (กัน reconcile ย้อนกลับ → ค้าง)
> - **clampDuration:** หด phase ที่กำลังเดินยาวเกิน setting (เช่น break เก่าก่อน settings-sync) ให้ตรงค่า · no-op ถ้าเหลือ ≤ duration

---

## 4. Acceptance Criteria — Timer Engine (ภาษาคน → ฐาน unit test)

```gherkin
Rule: pomodoro "นับว่าสำเร็จ" เมื่อเดินถึง 0 เท่านั้น
      - pause → resume → ยังนับ (ลูกเดิม)
      - restart → ลูกที่ทิ้ง ไม่นับ

Scenario: Auto-transition work → break
  Given WORK เดินถึง 0
  When เป็นลูกที่ 1–3 ของ cycle
  Then เข้า SHORT_BREAK 05:00 อัตโนมัติ + ยิง notification
  And completedPomodoros += 1

Scenario: ลูกที่ 4 → long break
  Given WORK ลูกที่ 4 เดินถึง 0
  Then เข้า LONG_BREAK + reset cycle counter

Scenario: Auto-advance ไป task ถัดไป
  Given BREAK เดินถึง 0 และยังมี task ใน schedule
  Then เริ่ม WORK ลูกถัดไปอัตโนมัติ (ไม่ต้องกด)

Scenario: Catch-up หลัง tab ถูก throttle
  Given WORK endsAt = T และผู้ใช้สลับไป tab อื่น
  When กลับมาที่ tab ตอนเวลาเลย T แล้ว
  Then แสดงสถานะ "หมดเวลา" ทันที + transition ถูกต้อง

Scenario: Pause ระหว่างทำงาน
  Given WORK เหลือ 18:00
  When กด Pause
  Then เวลาหยุดนิ่งที่ 18:00, state = PAUSED

Scenario: Resume (ลูกเดิม)
  Given PAUSED ที่ 18:00
  When กด Resume
  Then endsAt = now + 18:00, เดินต่อจาก 18:00, ยังเป็นลูกเดิม

Scenario: Restart (ลูกใหม่)
  Given PAUSED ที่ 18:00
  When กด Restart
  Then reset 25:00, endsAt = now + 25:00
  And ความคืบหน้าเดิม "ไม่ถูกนับ"

Scenario: รีโหลดหน้าระหว่าง pause
  Given PAUSED ที่ 18:00
  When รีโหลด
  Then state ยังเป็น PAUSED ที่ 18:00 (persist จาก DB)

Scenario: Interrupt (flow แยก)
  Given WORK กำลังเดิน
  When กรอกงานด่วน + เลือก "แทรกเลย"
  Then ลูกปัจจุบัน void + task ด่วนถูกแทรก + schedule ที่เหลือถูกจัดใหม่
```

---

## 5. Tech Stack (Locked — ตรงกับ Learning Plan, ไม่มี conflict)

| ส่วน | เครื่องมือ |
|---|---|
| Language | TypeScript (Node.js) |
| Framework | Next.js (App Router) + React 19 |
| DB / ORM | Prisma + **SQLite (local) / Turso libSQL (prod)** via adapter |
| UI / libs | Tailwind v4 · Auth.js v5 (Google OAuth) · **@dnd-kit** (drag-reorder) · Web Audio/Notification/Wake Lock APIs |
| Unit | Jest (+ fake timers) |
| Integration / API | Supertest + Axios + Zod |
| E2E | Cypress **และ** Playwright |
| CI/CD | GitHub Actions |
| Reporting | Allure หรือ Mochawesome |
| VCS | Git + GitHub |

---

## 6. Test Strategy

### Pyramid 70 / 20 / 10
- **70% Unit (Jest):** Pomodoro Engine FSM, scheduling algorithm, priority sort, time math, reschedule, reward-insertion → pure functions
- **20% Integration (Supertest + Zod):** API endpoints + Zod schema validation; mock external เมื่อมี
- **10% E2E (Cypress + Playwright):** critical journeys

### Test Quadrants
```
Q1 Unit + Integration      (automation)  ← เน้น
Q2 Functional / UX         (manual เบา ๆ)
Q3 Exploratory / UAT       (manual)
Q4 Performance / Security  (k6 / axe — Week 7)
```

### Time-Testing Showcase (จุดขายในสัมภาษณ์)
- **Jest:** `jest.useFakeTimers()` + `jest.setSystemTime()` → เทส FSM แบบ deterministic
- **Cypress:** `cy.clock()` + `cy.tick()` → กรอ 25 นาทีใน ms (signature feature)
- **Playwright:** `page.clock` → กรอเวลา + เทส notification permission ข้าม browser

### Test ที่ครอบคลุม
Test plan (create+review) · Test case · **Test script** · E2E (process/tools/framework) · Testing technique · **Test automation (เน้น)** · Manual (เบา) · Test report · Desk check/demo ต่อ sprint · Functional + **Non-functional** (perf/usability/reliability/security) · Risk-based · Negative · Exploratory · Regression · Cross-browser · **Traceability matrix** · AI-assisted test generation

---

## 7. SDLC Stages (Agile / Iterative — 2026)

> 2026 SDLC = iterative + AI-assisted; feedback จากรอบก่อนป้อนรอบถัดไป

### Stage 1 — PM/BA  ·  *Claude Chat + Notion*
PRD · User Persona · User Journey Map · User Stories · MoSCoW · **Functional + Non-functional Requirements**

### Stage 2 — System Design  ·  *FigJam + Notion*
Architecture diagram (4 layers + FSM) · Prisma data model · API design · UX flow · Notification strategy · Technical Decision Log

### Stage 3 — QA Planning  ·  *FigJam + Notion*
Test Strategy · **Test Pyramid** + **Test Quadrants** · Risk Assessment · Test Environment · Entry/Exit Criteria · Test Cases + **Test Scripts** · Acceptance Criteria (ข้อ 4) · **Traceability Matrix** · Bug Template · AI-assisted test-case generation

### Stage 4 — Development (Build = Week 5–6, iterative)

> **Updated approach (2026-05-30):** Product first, QA second — build vertical slices ให้ใช้ได้จริงก่อน แล้วค่อยเพิ่ม test layer

**Phase 1 — Product (Vertical Slices)** — ✅ **เสร็จครบ Slice 1–4** (commit `e1e2863`)
```
Slice 1 ✅ Timer + Brain dump + Task list + Notification (1 หน้า ใช้งานได้จริง)
  ① engine/types.ts          — State enum + TimerState shape
  ② engine/timeMath.ts       — endsAt, remaining, catch-up
  ③ engine/transitions.ts    — FSM transition pure functions
  ④ engine/index.ts          — barrel export
  ⑤ api/tasks/route.ts       — GET list + POST create
  ⑥ api/session/route.ts     — GET state + POST action
  ⑦ hooks/usePomodoro.ts     — React hook (ticker + API bridge)
  ⑧ components/Timer.tsx     — countdown + state badge
  ⑨ components/TaskList.tsx  — รายการ task
  ⑩ components/BrainDump.tsx — input form
  ⑪ app/page.tsx             — layout รวม

Slice 2 ✅ Auto-schedule + Morning review   → engine/scheduler.ts, api/schedule
Slice 3 ✅ Interrupt + Reschedule           → api/interrupt, InterruptButton
Slice 4 ✅ Backlog + End-of-day summary      → api/backlog, BacklogView, DaySummary
```

**Phase 1.5 — Enhancements หลัง Slice** (ทำเพิ่มจริง — นอกแผนเดิม)
| commit | สิ่งที่เพิ่ม |
|---|---|
| `557c124` | ย้าย DB จาก local SQLite → **Turso cloud (libSQL)** — SQLite-compatible, sync ข้ามเครื่องได้ |
| `4010b5d` | เสียงเตือน (alarm) + ตั้งค่าระยะเวลา WORK/BREAK ได้เอง (`SettingsPanel`, `useSettings`, `lib/sound`) |
| `af43c01`, `e2ce31f` | UI ตั้งเวลา: slider → number input + ปุ่ม ± (step=1) |
| `59a7c2b` | รวมแท็บ Tasks + Schedule → แท็บเดียว (4→3 แท็บ, `ScheduleMain`) |
| `5e3ef05` | ช่อง estimated pomodoros + แยก intent "เพิ่ม task วันนี้" vs "เก็บเข้า backlog" |
| `f7745e3`..`5940208` | ฟีเจอร์ **Room**: แยกข้อมูลต่อผู้ใช้ผ่าน `X-Room-Id` + แชร์ผ่านลิงก์ + สร้าง/แก้รหัส/เข้าห้อง/**ลบห้อง** + เช็ค code ซ้ำ (`lib/room`, `useRoom`, `RoomBadge`, `api/room`, roomId ใน schema/ทุก API + `@@index`) · UX: แก้ชื่อ/ลบ task, focus คงหลัง Enter, timer โชว์ task ที่ทำอยู่ |
| `c809c7b` | **Login (optional Google sign-in)** — Auth.js v5 + Google + Prisma adapter (`auth.ts`, `api/auth/*`, `api/room/claim`, `Providers`, `AccountButton`) + `User`/`Account` models · claim ห้อง + sync ข้ามเครื่อง |
| `314dd66`, `8ac37e6` | **Deploy fixes:** `prisma generate` ใน build/postinstall (แก้ Vercel build) + สคริปต์ migrate Turso ผ่าน libsql (`scripts/migrate-turso.mjs`) |
| `e240b61` | **Fix:** เปลี่ยนห้องขณะ login → บัญชีตามไปห้องใหม่ ไม่เด้งกลับ (rename อัปเดต `User.roomId`; create/join/delete เรียก claim) |
| `65bc18a` | **UI redesign #1** — ธีม deep-cozy-dusk (glassmorphism) + **responsive** (มือถือ stack) |
| `5987f40` | **UI redesign #2 — Ember + Split (design handoff)** — ธีมกระดาษ/ดินเผา (terracotta) + layout Split 50/50 + ฟอนต์ Newsreader/IBM Plex Sans Thai + Timer serif/badge outline/dots · presentation-only |
| *(post-handoff)* | **Polish:** เลิก `window.location.reload()` ใน endDay/interrupt → re-fetch (`usePomodoro.refresh`) ไม่กระพริบ + **toast** feedback + dropdown `pm-pop` animation |
| `8f91b5e` | **Timer ring เดินหน้า** — เปลี่ยนจาก deplete (เต็ม→หาย) เป็น forward-fill (ว่าง→เต็ม) ตามเวลาที่ผ่านไป |
| `b372f73`, `e802b26`, `316653b` | **UI redesign #3 — Glass/Mirror UI** — พื้นหลังรูปอินทีเรีย (`/public/bg-interior.jpg`) + frosted-glass panel · ratio **60:40** (timer ซ้าย, panel ขวาเต็มความสูงถึงขอบบน) · โลโก้ลอยมุมซ้าย, room/account อยู่หัว panel ขวา · timer/header กลืนกับพื้นรูป (radial scrim แทนการ์ดกระจก) |
| `4d226de`, `64fff2e`, `545a9a2` | **Readability fixes บน glass:** empty-state + Reset settings + Backlog hint สีจางเกิน → `ink-soft` · room/account dropdown โปร่งเกิน ตัวอักษรทะลุ → override paper-panel เป็น 96% opacity · เอา `overflow-hidden` ออกจาก aside กัน dropdown clip · Thai ใน Newsreader heading → fallback ไป IBM Plex Sans Thai (กลืนกับ body) |
| `fc5206e` | **C2 task picker ตอน IDLE** — preview "ถัดไป · &lt;task&gt; [เปลี่ยน]" + dropdown เลือก task หรือ "ไม่ผูก task" ก่อนกดเริ่มโฟกัส |
| `8d88e29` | **Rename:** logo + browser title "Pomodoro Autopilot" → **Pomodachi** (folder/repo คงเดิม) |
| `8fed4e5`, `2ba7785` | **Task UX:** TaskForm stack 2 แถว (input บน · stepper+ปุ่ม ล่าง) เพื่อรับชื่อยาว · task item ใน Schedule + Backlog เปลี่ยนเป็น 2-row layout (title wrap หลายบรรทัด · controls ชิดขวา row 2) ไม่ตัด `...` อีก |
| `98c1468` | **Switch/Skip task กลางลูก:** คลิก "เริ่ม" task อื่นใน list ขณะ WORK/PAUSED = switch · ปุ่ม "⏭ ข้าม task นี้" ใน Timer = skip ไป next pending · ทั้งคู่ confirm 2 ชั้น (ลูกที่ทิ้งไม่นับ) · `api/session` action `switch`/`skip` void slot ปัจจุบัน + start WORK ใหม่ |
| `a2e31c0` | **แก้ pomodoros ตอน edit task** — โหมด edit แสดง stepper `− 1🍅 +` คู่กับ input ชื่อ · commit ทั้งคู่ตอน blur · regenerate schedule ถ้าจำนวนเปลี่ยน |
| `e868cec` | **Backlog ปักวันได้** — `Task.scheduledFor: DateTime?` + native `<input type="date">` เฉพาะใน Backlog · Backlog แยก 2 section "📅 มีกำหนด" / "🌙 ยังไม่กำหนด" · GET tasks/backlog auto-promote `scheduledFor ≤ today` → pending · Schedule task มีปุ่ม "→ Backlog" สำหรับเลื่อนออกจากวันนี้ |
| `cfb90e4` | **เสียง alarm ใหม่** — marimba do-mi-sol (C5-E5-G5) ซ้ำ 2 รอบ ~1.66s · triangle wave warm + compressor · ไม่น่าตกใจ |
| `abbbf20` | **Fix:** infinite alarm loop ตอนเน็ตตัด → alarm `endsAt`-keyed idempotency (alarm 1 ครั้ง/ลูก ไม่ว่า API retry กี่รอบ) |
| **— Round 3 (2026-06-09): stability บนมือถือ + sync ข้ามเครื่อง —** | |
| `bb138ad` | **Fix:** นับ pomodoro ที่ทำเสร็จเข้า task ที่ active — `expire` เพิ่ม `task.completedPomodoros++` + mark `done` เมื่อครบ estimated + ปิด ScheduleSlot (เดิมไม่เคยเพิ่ม → task ไม่เคยเปลี่ยนสถานะ) |
| `9b409f2` | **Fix:** ลูกศร reorder ▲▼ ทำงานแม้ priority เท่ากัน → neighbor-swap + reassign priority ให้ต่างกันชัดเจน (เดิม priority±1 floor 0 พัง) |
| `7c72f27` | **Fix:** เมื่อ task ที่เพิ่งจบเป็น done → เลื่อนไป task ถัดไป (BREAK→WORK advance past done task → next pending หรือ IDLE ถ้าหมดคิว) |
| `fcf0920` | **Fix:** dialog switch-task โชว์เวลาโฟกัสตาม setting จริง ไม่ hardcode 25:00 |
| `722481a`, `c93a46e`, `b4f4452` | **Glass dropdown/modal:** scrim-frost เต็มจอหลัง overlay (`backdrop-blur` + คลิกปิด) · room/account dropdown เป็น glass แท้ (opacity 0.78 + blur 32px) · light page-frost + bump legibility |
| `c4a65a2` | **Favicon 🍎** — `src/app/icon.svg` (emoji) แทน favicon.ico ของ Next.js + notify icon = `/icon.svg` |
| `f37e2c1` | **Fix:** timeout session requests (AbortController + `Promise.race` hard timeout 8s) → connection ตายค้างไม่ freeze timer (กัน `res.json()` แขวน) |
| `a6fe725`, `7db21fa` | **Screen Wake Lock** ขณะ timer เดิน (`wakeLockRef`) + chip สถานะ wake-lock (ภายหลังเหลือแค่ ⚠️ ตอน fail) |
| `dd0df7e` | **Fix:** ปลดล็อกเสียงบนมือถือ — AudioContext ที่สร้างนอก user gesture จะ suspended → singleton + `primeAudio()` (resume + silent blip) ตอน gesture |
| `16a0b94` | **Feat:** session-sync ล้มเหลว → toast แทนเงียบๆ (`syncError`) |
| `b12b4d3`, `4a304d0`, `709ec79` | **มหากาพย์ stuck-timer (1):** advance optimistically ตอน expire ไม่รอ server · ชดเชย client/server clock skew (`serverNow` offset) · server honor client expire แม้นาฬิกา server ช้า (`effectiveNow = max(nowMs, endsAt)`) |
| `0a2f0e4` | **Fix:** เลิก cache HTML document (`Cache-Control: no-store` บน `/`) + build-version stamp (`NEXT_PUBLIC_BUILD_ID` จาก git SHA) — แก้ stale bundle บนมือถือ |
| `e2bdab6`, `e36e019`, `d9aa607` | (ชั่วคราว) `?debug=1` overlay + live debug readout บนเครื่องจริง เพื่อ diagnose stuck-timer → ลบออกเมื่อปิดเคส |
| `f9fd9c9` | **Fix (ปิดเคส):** local-first timer advance — optimistic `tick()` รันนอก `expiringRef` guard, network sync แยกต่างหาก → display ไม่เคยถูก block ด้วย expire request ที่ค้าง |
| `16a4495`, `25cf6ed` | **Fix:** จบ task สุดท้าย → IDLE + ลบ task ที่ done ได้ · start task ได้เมื่อ timer ค้างในสถานะ running/paused-ไม่มี-task (route ผ่าน `switch`) |
| `f5cc971` | **Fix:** center empty-state ของ Backlog ให้ตรงกับ Schedule |
| `f5906de`, `71c9d1e` | **Fix:** reset cadence long-break ต่อ session (`start` reset `completedPomodoros: 0`) → ไม่เจอ long break เซอร์ไพรส์ · summary ใช้ผลรวม `completedPomodoros` ราย task · (doc) skip เก็บลูกที่ทำเสร็จไว้ void แค่ลูก in-flight |
| `6f81d39`, `84aafd6` | **Feat finish-early:** action `finishEarly` (credit ลูก in-flight ให้ A เต็มลูก → done → `currentTaskId=null` คงนาฬิกาเดิม) · เลื่อนปุ่ม "✓ เสร็จ task นี้" เป็น primary แทน "เริ่มใหม่" ขณะ WORK |
| `1ed464c`, `a27075c`, `f4066b4` | **Glass urgent-popup:** frost หน้าจอด้านหลัง + opaque-glass (กันตัวอักษรทะลุ) + ปุ่ม trigger คมเหนือ scrim (`z-50`) |
| `c31851a`→`65b478c` | **(revert)** ลอง glass UI polish variant A (frosted cards/edge-highlight/floaty shadow) แล้ว user เลือก revert ทั้งก้อน |
| `b3c25c3`, `428fe9e`, `4e193cb`, `67fbfad` | **ปุ่ม timer:** PAUSED คง "เริ่มใหม่" (เสร็จ-task แทนเฉพาะ WORK) · 2 ปุ่มหลักสีตัวอักษรเดียวกัน + glassier · skip กลับเป็น linear text link ไร้ขอบ อ่านง่ายทุกพื้นหลัง (+hover) · แก้ hover ปุ่ม glass ที่หาย (Tailwind v4 ไม่ emit plain class → ใช้ arbitrary utilities) |
| `42778ed` | **Fix:** ไม่โชว์ task ที่ done เป็น timer ที่ active (client optimistic lag) → self-heal `currentTask=null` + refresh |
| `78eabb5`, `b6e652c` | **Multi-device sync:** re-fetch session + task list + backlog เมื่อ device กลับมา focus (`visibilitychange`) แก้ drift ข้ามเครื่อง |
| `f24d4c2`, `a27df8f` | **Settings sync per-room:** `RoomSetting` model + `GET/PATCH /api/settings` (clamp ค่า) · `useSettings(roomHeaders)` server-as-source-of-truth, localStorage แค่ cache · migrate-turso validate token เป็น JWT จริง |
| `96dc1a2` | **Fix:** phase ที่กำลังเดินยาวเกิน setting (เช่น break 11:21 เมื่อ setting=5) → action `clampDuration` หดให้ตรง setting · self-heal effect ใน client เรียกเมื่อ `remainingMs > duration+1500` · no-op ถ้าเหลือ ≤ duration |
| `(2026-06-10)` | **Feat: Archive task ที่เสร็จ + auto จบวันเที่ยงคืน** — status ใหม่ `archived` (zero migration, status เป็น String) · GET /api/tasks กรอง archived+backlog ออก · `POST /api/tasks/archive` (bulk done→archived, `updatedAt` = เวลาเก็บ → raw data เผื่อทำ stat รายวัน) · ปุ่ม "🧹 เก็บ task ที่เสร็จเข้าคลัง (N)" โผล่เมื่อมี task done · **auto จบวันเที่ยงคืน:** detect date rollover ผ่าน localStorage `pomodachi:lastDate:<roomId>` (on load + visibility) → archive done + reset timer · task ค้าง/รันคงเป็น pending ยกมาวันใหม่ · idempotent (ไม่ทำซ้ำในวันเดียว, ไม่ archive ตอน load แรก) |
| `(2026-06-10)` | **Feat: Dashboard สถิติรายวัน (Phase 3)** — แท็บที่ 4 "📊 Stats" (`StatsView`) แสดงยอดรายวัน (🍅/✓task) + แท่งสัดส่วน + วันที่ไทย + สรุป**ค่าเฉลี่ย/วัน** (baseline ตัวเอง — มีความหมายกว่า total) · **คลิก card วัน → กาง accordion ดู task ของวันนั้น** (lazy-load + cache, `GET /api/stats/day?date=`) · `GET /api/stats` = `groupBy(doneDate)` · *(เดิมลองทำด้วย `DaySummary` snapshot + `archivedDate` แต่ pivot ทิ้ง — ดู row ถัดไป)* |
| `(2026-06-10)` | **Refactor: สถิติ derive จาก `Task.doneDate` (วันเสร็จจริง)** — แทน DaySummary snapshot · stamp `doneDate` (local YYYY-MM-DD) ตอน **ขีดฆ่า** (task → done) ใน `/api/session` 2 จุด: `expire` ใช้ local date ของ `endsAt` (เวลาลูกจบจริง — ทน process หลังเที่ยงคืน) · `finishEarly` ใช้ now · client ส่ง `doneDate` มากับ body · **วันเสร็จ intrinsic กับ task → คงอยู่แม้ archive ทีหลัง** (task เสร็จวันนี้ เคลียร์พรุ่งนี้ ยังนับเป็นวันนี้) · ถอด `DaySummary` model/table + `archivedDate` + snapshot/increment/date-passing ทิ้ง (โค้ดสั้นลง) · drop ตาราง DaySummary บน prod · migrate-turso เพิ่ม `Task.doneDate` (รัน prod แล้ว ✅) |
| `d1481d3` | **Stats: total → ค่าเฉลี่ย/วัน** — สรุปแสดง 🍅 เฉลี่ย/วัน + task เฉลี่ย/วัน + จำนวนวัน (baseline ตัวเอง ไว้เทียบ/ตั้งเป้า · total โตเรื่อยๆ ไม่บอกอะไร) |
| `2920a23` | **Style: scrollbar บางกลืนธีม** — global plain CSS (WebKit pseudo-element + Firefox `scrollbar-width/color`) · track ใส, thumb terracotta-brown โปร่งโค้งมน · ครอบทุก scroll area |
| `897c508` | **Feat: edit/delete task ใน Backlog** — เพิ่ม inline edit (ชื่อ + stepper 🍅) + ปุ่ม 🗑 ใน BacklogView (parity กับ Schedule, reuse `handleEditTask`/`handleDeleteTask`) · handler reload ทั้ง tasks+backlog → sync 2 list |
| `(2026-06-10)` | **Feat: ลากเรียงลำดับ task (drag-reorder)** — `@dnd-kit` ใน ScheduleMain · กดค้าง/ลากการ์ด active เลื่อนตำแหน่งได้ (ย้าย #10→#1 ครั้งเดียว แทนกด ▲ 9 ที) · sensors: MouseSensor(distance 8) + TouchSensor(delay 220ms = long-press, ปัดเร็ว=scroll) + Keyboard · done tasks ปักล่างนิ่ง · optimistic order state (sync เมื่อชุด id เปลี่ยน) · drop → `onReorder` reassign priority (len..1) PATCH เฉพาะที่เปลี่ยน · เก็บปุ่ม ▲▼ ไว้ (ปุ่มไม่ชน drag เพราะ activation constraint) |

> **Build Log — ฟีเจอร์ Room (commit + push prod แล้ว · 2026-05-30):**
> - ✅ **แก้ bug 3 จุด:** (1) *infinite fetch loop* → `useMemo` ครอบ `roomHeaders`  (2) *session โหลดผิดห้อง* → effect รอจน `roomId` พร้อม  (3) *noti แจ้งเตือนเด้งรัวๆ* (ticker ยิง expire ซ้ำตอน API ช้า) → in-flight guard ใน `triggerExpire` (พิสูจน์: เด้ง 1 ครั้ง เดิม ~5)
> - ✅ **เพิ่มฟีเจอร์:** สร้างห้องใหม่ · แก้รหัสห้อง (ย้ายข้อมูล) + เช็ค code ซ้ำ live · **ลบห้อง (Stretch A — confirm 2 ชั้น → ห้องเปล่าใหม่)** · แก้ชื่อ/ลบ task · กัน task ที่โฟกัสอยู่ไม่ให้ลบ · focus คงที่ช่องหลัง Enter · timer โชว์ชื่อ task
> - ✅ **แก้ bug ที่เจอตอนทดสอบ:** DELETE task ติด FK `ScheduleSlot` (`ON DELETE RESTRICT`) → ลบ slot ก่อน · เพิ่ม `@@index([roomId])` 3 ตาราง
> - ✅ **แก้ bug หลัง login:** เปลี่ยนห้องขณะ login แล้วเด้งกลับห้องเดิม → sync `User.roomId` ทุกการเปลี่ยนห้อง (`e240b61`)
> - ✅ **UI redesign + responsive** — มือถือเดิม timer หลุดจอใช้ไม่ได้ → stack · ธีมผ่าน 2 รอบ: dusk (`65bc18a`) → **Ember + Split** (`5987f40`, design handoff) · verify ทั้ง mobile + desktop ทุก state
> - verify ผ่าน browser ทุกฟีเจอร์ + `tsc` + `build` เขียว · **ขึ้น prod จริงแล้ว**

> **Build Log — Round 2 (UI redesign #3 + Backlog + post-deploy bugs · 2026-06-06):**
> - ✅ **แก้ bug 5 จุดที่เจอบน prod:** (4) *Thai chars หลุดจาก Plex Thai* (Newsreader ไม่มี glyph ไทย → fallback ไป Sukhumvit) → ใส่ font stack `var(--font-heading), var(--font-sans), system-ui` ที่ heading inline 3 จุด · (5) *room/account dropdown โปร่งเกิน* → override opacity 0.96 + เอา `aside overflow-hidden` ออก (dropdown clip ที่ขอบซ้าย panel) · (6) *empty-state ตัวอักษรจาง* → ink-soft · (7) *input รับชื่อยาวไม่ได้* → stack form + task item 2-row + tooltip · (8) **infinite alarm loop ตอนเน็ตตัด** → API fail → state ไม่อัปเดต → ticker tick ถัดมา trigger ซ้ำทุก 1 วิ · แก้ด้วย `endsAt`-keyed idempotency ใน `triggerExpire` (alarm 1 ครั้ง/ลูก แม้ API retry หลายรอบ — verified: 1 alarm vs เดิม 6/6sec)
> - ✅ **เพิ่มฟีเจอร์รอบสอง:** UI Glass/Mirror + photo bg + 60:40 split + panel เต็มขอบบน · C2 task picker ตอน IDLE · rename → Pomodachi · switch/skip task กลางลูก · แก้ pomodoros inline · **Backlog ปักวันได้** (scheduledFor + auto-promote) · marimba alarm + idempotency · timer ring forward-fill
> - verify ผ่าน browser ทุก scenario (รวม simulated offline) + `tsc` + `build` เขียว · ทุก commit push prod แล้ว

> **Build Log — Round 3 (stability บนมือถือ + multi-device sync · 2026-06-09):**
> *รอบนี้ต่างจาก 2 รอบแรก — ไม่ใช่ฟีเจอร์ใหม่ แต่เป็น bug ที่โผล่จาก **การใช้จริงทุกวันบนมือถือ + หลายเครื่อง** เป็น story การ debug production ที่ดีที่สุดสำหรับสัมภาษณ์ SDET*
>
> - 🏔 **มหากาพย์ "timer ค้างที่ 00:01 บนมือถือ"** (หลายเครื่อง หลายรอบ) — อาการ: เปิดเว็บทิ้งไว้/จอล็อค กลับมาเวลาโฟกัสหมดแล้วแต่ระบบค้าง ขยับไม่ได้ · ใช้ **build stamp + on-device debug overlay** (`t248 WORK 0s exp:127/1 BUSY pending`) ขุดจน root cause **5 ชั้น**:
>   1. **ไม่มี request timeout** → `expiringRef` ค้างเมื่อ network แขวน → เพิ่ม timeout (`f37e2c1`)
>   2. **AbortController ไม่ reject `res.json()` ที่แขวน** → ใช้ `Promise.race([fetch, timeout])` hard-timeout (`f9fd9c9`)
>   3. **display รอ server ก่อนค่อยขยับ** → optimistic **local-first** advance นอก guard (`b12b4d3`, `f9fd9c9`)
>   4. **client/server clock skew** → server คืน WORK เดิม → client reconcile ย้อนกลับ → ค้าง · แก้ด้วย `serverNow` offset (`4a304d0`) + server-clamp `effectiveNow = max(nowMs, endsAt)` ให้ server ขยับเสมอเมื่อ client บอกหมด (`709ec79`)
>   5. **มือถือเสิร์ฟ bundle เก่าจาก cache** (incognito ใช้ได้) → `no-store` บน HTML + build stamp ยืนยันเวอร์ชัน (`0a2f0e4`)
>   → ผล: local-first optimistic + Promise.race timeout = timer เดินหน้าได้แม้ network ตาย/ช้า/นาฬิกาเหลื่อม ทุกเวอร์ชัน client
> - 🔄 **Multi-device sync (trilogy):** กลับมา focus = re-fetch **session** (`78eabb5`) + **task list & backlog** (`b6e652c`) + **settings** (`f24d4c2`) → 2 เครื่องเห็น state/คิว/setting ตรงกัน · settings ย้ายจาก localStorage-only → **server per-room** (`RoomSetting` + `/api/settings`, localStorage แค่ cache)
> - ⏱ **clampDuration** (`96dc1a2`) — break ที่สร้างด้วย setting เก่า (ก่อน sync) เดินยาวเกิน → หดให้ตรง setting อัตโนมัติ (self-heal client + server action, no-op ถ้าปกติ)
> - ✓ **Finish-early** (`6f81d39`, `84aafd6`) — จบ task ก่อนเวลา, นับลูกให้ task เดิมเต็มลูก (ไม่มีเศษ ตาม decision "นับให้ A") + ปุ่มเลื่อนเป็น primary
> - 🔊📱 **Mobile reliability:** Screen Wake Lock (`a6fe725`) + ปลดล็อกเสียงด้วย AudioContext singleton prime-on-gesture (`dd0df7e`) + sync-error toast (`16a0b94`) + favicon 🍎 (`c4a65a2`)
> - 🐛 **Bug จาก use-case จริง:** pomodoro ไม่นับเข้า task (`bb138ad`) · timer ไม่ advance เมื่อ task done (`7c72f27`, `42778ed`) · reorder priority เท่ากันพัง (`9b409f2`) · long break เซอร์ไพรส์เพราะ cadence สะสม (`f5906de`) · จบ task สุดท้ายแล้วยังกดเริ่ม/ลบไม่ได้ (`16a4495`, `25cf6ed`)
> - 🎨 **Glass polish:** dropdown/popup/modal เป็น glass แท้ (0.78/blur32) + scrim-frost เต็มจอ + z-index trigger (`722481a`..`f4066b4`) · ปุ่ม timer สีตัวอักษรเดียวกัน + skip เป็น linear link อ่านง่ายทุกพื้นหลัง · ลอง variant A glass cards แล้ว **revert** (`c31851a`→`65b478c`)
> - verify ทุก scenario บน browser preview + on-device (มือถือจริง, จอล็อค, เน็ตตัด, 2 เครื่องพร้อมกัน) · `tsc` + `build` เขียว · ทุก commit push prod แล้ว · **ยืนยัน RoomSetting migration ขึ้น prod สำเร็จ** (GET/PATCH /api/settings ทำงานบน prod)

**Room — Known Limitations & Stretch Goals** (ตัดสินใจ 2026-05-30)

| หัวข้อ | สถานะ / แนวทาง |
|---|---|
| **ห้องร้างไม่ถูกลบอัตโนมัติ** | **Known Limitation (รับไว้)** — ห้องที่เคยมีข้อมูลแล้วเลิกใช้จะค้างใน DB · ห้องที่เปิดแต่ไม่เคยมี action = ว่างจริง ไม่กินที่ (สร้างแบบ lazy) · ขนาด ~KB/ห้อง จึงยังไม่กระทบ scope flagship → **เลือกแนวทาง A: ไม่ทำ auto-cleanup ตอนนี้** |
| **Access เป็น capability-based** | ใครรู้ code ก็เข้าได้ ไม่มี auth — ตั้งใจให้แชร์ง่าย · ระวังอย่าตั้ง code สั้น/เดาง่าย (document ใน README) |
| **Stretch A: ปุ่ม "ลบห้องนี้"** — ✅ **ทำแล้ว (commit `5940208`)** | เจ้าของห้องลบเองได้ตรงจุด ไม่ต้องมี background job · `DELETE /api/room` + confirm 2 ชั้น (เตือนกู้ไม่ได้ + เตือนห้องแชร์) |
| **Stretch A — ลบแล้วไปไหนต่อ** — ✅ **ทำตามนี้** | **ลบเสร็จ → ห้องเปล่าใหม่เสมอ · ไม่กลับห้องเก่า ไม่มี room-history** เพราะ user จำ code เก่าไม่ได้ + action ทำลายข้อมูลต้องชัดเจน · โมเดล "โน้ตใช้เสร็จฉีกทิ้ง" → ทางเดียวที่เก็บห้องไว้คือ copy link |
| **Stretch B (Week 7): TTL auto-cleanup** | cron ลบห้องที่ `Session.updatedAt` เงียบเกิน N วัน · logic "ห้อง stale?" เป็น **pure function (unit-test ได้)** + cleanup endpoint (**integration-test ได้**) — ตรงกับ Week 7 stretch ของแผนพอดี |

**Auth / Login — Optional Sign-in** (✅ ทำแล้ว — Google OAuth via Auth.js v5 · 2026-05-30)

| หัวข้อ | แนวทาง |
|---|---|
| **รูปแบบที่เลือก** | **Optional sign-in** — แอปยังใช้แบบ anonymous + room code ได้ตามเดิม (zero-friction, ไม่มีกำแพง signup) แต่ "sign in เพื่อ claim ห้อง" ได้ → เข้าถึงข้อมูลจากเครื่องไหนก็ได้โดยไม่ต้องจำ code |
| **เหตุผล** | ไม่ over-engineer (ข้อมูล pomodoro ไม่ sensitive) · รักษา UX เปิด-แล้วใช้ · ได้ identity ถาวรเมื่อต้องการ · **คุณค่าต่อ portfolio/SDET สูง** (auth = ขุมทรัพย์การเทสต์: login/logout, protected route, token expiry, negative + security tests) |
| **สถานะ** | ✅ **ใช้งานได้จริงบน prod** (login Google สำเร็จ, claim ห้อง + sync ข้ามเครื่องทำงาน) · กลไก: Auth.js v5 + Google + Prisma adapter (JWT strategy → ไม่ต้องมี Auth Session table, เลี่ยงชน `Session` ของ pomodoro) · `User.roomId` = ห้องที่ claim · ปุ่ม Sign in/out + claim ห้อง + auto-switch ไปห้องบัญชี |
| **Setup ที่ทำไปแล้ว** | สร้าง Google OAuth client (External, Testing mode) + redirect URIs (localhost + prod) · ตั้ง 5 env ใน Vercel (`AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `DATABASE_URL`, `TURSO_AUTH_TOKEN`) · migrate Turso ผ่านสคริปต์ |
| **TODO ความปลอดภัย** | ⚠️ reset Google client secret + Turso token (เคยโผล่ระหว่าง setup) · Google OAuth ยัง Testing mode (login ได้เฉพาะ test users — publish ทีหลังถ้าจะเปิดสาธารณะ) |

**Deploy / Ops — บทเรียนจาก deploy จริง (2026-05-31)** — รวมปัญหาที่เจอตอนขึ้น Vercel + Turso (story ดีตอนสัมภาษณ์ "debug production")

| ปัญหา | อาการ | วิธีแก้ |
|---|---|---|
| Prisma client ไม่ถูก generate บน Vercel | `Module not found: @/generated/prisma/client` ตอน build | `src/generated/prisma` ถูก gitignore → เพิ่ม `prisma generate` ใน `build` + `postinstall` |
| Prisma migrate ใช้กับ Turso ไม่ได้ | `P1013: scheme ... not recognized` (libsql://) | CLI ไม่รองรับ libsql + config v7 ไม่มีช่อง adapter → apply schema ผ่าน `@libsql/client` (`scripts/migrate-turso.mjs`, idempotent) |
| `DATABASE_URL` ไม่ได้ตั้งใน Vercel | `Unable to open ./dev.db: 14` (fallback ไป SQLite local บน serverless) | ตั้ง `DATABASE_URL` (libsql) + `TURSO_AUTH_TOKEN` ใน Vercel env → ทุกฟีเจอร์ DB กลับมาทำงาน |
| Auth callback error | "problem with the server configuration" | ต้องตั้ง `AUTH_SECRET` + Google creds ใน Vercel (ไม่ใช่แค่ local) + redeploy |
| Google `redirect_uri_mismatch` | Error 400 ตอนเลือกบัญชี | ใส่ redirect URI ให้ตรงเป๊ะใน **Authorized redirect URIs** (ไม่ใช่ JavaScript origins), ห้าม `//`/`/` ท้าย |
| Dev runtime cache เก่าหลัง `prisma generate` | `Unknown argument scheduledFor` แม้ regenerate client แล้ว | **restart Next dev server** — runtime keep stale client ใน memory, regenerate file system อย่างเดียวไม่พอ |
| Migration ใหม่ที่ local ไม่ตามขึ้น prod | runtime queries error หลัง deploy (เช่น POST /api/tasks → 500) | **ทุก migration ใหม่ต้องรัน `node scripts/migrate-turso.mjs`** กับ Turso prod แยก · ไม่ต้อง redeploy (schema sync อย่างเดียว) |
| Alarm loop ตอนเน็ตตัด | Production alert เด้งรัวๆ จนเน็ตกลับ | ticker เห็น expired + fetch fail → state ไม่อัปเดต → loop · แก้ด้วย **idempotency key (`endsAt`)** ใน `triggerExpire` — alarm 1 ครั้ง/ลูก แม้ API retry หลายรอบ |
| **Timer ค้างที่ 00:01 บนมือถือ** (2026-06-09) | เปิดทิ้งไว้/จอล็อค กลับมาเวลาหมดแล้วแต่ค้าง กดไม่ขยับ | root cause 5 ชั้น: no timeout, `res.json()` แขวน (AbortController ไม่ช่วย), display รอ server, clock skew, stale bundle · แก้: **local-first optimistic + `Promise.race` hard-timeout + clock-offset + server-clamp `max(now,endsAt)` + `no-store` HTML + build stamp** |
| **Stale bundle บนมือถือ** | clear cache แล้วเสียงมา แต่จอยังค้าง (incognito ปกติ) | browser cache HTML เก่า → ตั้ง `Cache-Control: no-store` บน `/` + `NEXT_PUBLIC_BUILD_ID` (git SHA) โชว์มุมจอ เพื่อยืนยันเวอร์ชันที่รันจริงระหว่าง debug |
| **Tailwind v4 ไม่ emit plain class ที่เพิ่งเพิ่ม** | ปุ่ม glass สูญ hover · `.glass-btn` ไม่อยู่ใน CSSOM (`.paper-panel` อยู่) | v4 (`@theme inline`) ไม่ scan plain CSS class ใหม่ใน globals.css เสมอ → ใช้ **arbitrary-value utilities** (`bg-[rgba(...)] hover:bg-[...] backdrop-blur-[18px] shadow-[...]`) ที่ emit ชัวร์ + รองรับ `:hover` (inline style override ด้วย hover ไม่ได้) |
| **แก้ globals.css แล้ว dev ไม่ apply (stale CSS)** | เพิ่ม `::-webkit-scrollbar` rule แล้ว CSS ที่ serve ไม่มี (ยืนยันด้วย fetch href .css → ไม่เจอ `webkit-scrollbar` แต่มี `paper-panel` เก่า) | Turbopack dev cache CSS ไม่ invalidate globals.css เสมอ → **restart `next dev` (+ `rm -rf .next`)** แล้วค่อยเช็ก · plain global CSS (เช่น pseudo-element) emit ปกติหลัง restart — ไม่ใช่ปัญหา v4 |
| **migrate-turso HTTP 400** | `node scripts/migrate-turso.mjs` ตอบ 400 | `turso db tokens create` คืน string error "You are not logged in..." (88 ตัว ไม่ใช่ JWT) มาเป็น token → แก้: `turso auth login` ก่อน + เพิ่ม **JWT-format guard** ในสคริปต์ (`/^ey[A-Za-z0-9_-]+\./`) ให้ error ชัดแทนการยิง garbage |
| **Settings ไม่ตรงกันข้ามเครื่อง** | เครื่อง A ตั้ง 25/5 เครื่อง B เห็นค่าอื่น | settings เดิมอยู่ localStorage (per-device) → ย้ายเป็น **server per-room** (`RoomSetting` + `/api/settings`) · ต้องรัน migrate-turso เพิ่มตาราง RoomSetting บน prod (ทำแล้ว ✅) |

> **Env ที่ prod ต้องมี (5 ตัว):** `AUTH_SECRET` · `AUTH_GOOGLE_ID` · `AUTH_GOOGLE_SECRET` · `DATABASE_URL` (libsql) · `TURSO_AUTH_TOKEN`
> **บทเรียนหลัก:** local เขียว ≠ prod เขียว — env, build step, และ DB migration ของ prod เป็นคนละชุดที่ต้องจัดการแยก

**Phase 2 — QA (Top-down pyramid)** — ⬜ **ยังไม่เริ่ม** (test deps ยังไม่ถูกติดตั้งใน `package.json`)
```
Manual testing → E2E (Cypress + Playwright) → Integration (Supertest+Zod) → Unit (Jest)
GitHub Actions CI + Allure report
```
> 👉 นี่คือ **พระเอกของ portfolio สาย SDET** — ส่วนที่เหลือต้องทำหลังปิดงาน Room

> *(แทนที่แผน Week 5–6 แบบ bottom-up เดิม — ตามการตัดสินใจใน session 2026-05-30)*

### Stage 5 — QA Execution  ·  *Notion + FigJam*
Test Execution Report · Bug Reports (severity/STR/expected-vs-actual) · Regression · **Exploratory** · **Performance (เบื้องต้น)** · **Negative** · Cross-browser matrix · Test Coverage map · Traceability update

### Stage 6 — Deploy  ·  *Vercel + Turso*
✅ **Deploy แล้ว (product-first)** — ขึ้น prod ก่อน QA ตามแนวทาง build-product-first · ดูปัญหา/วิธีแก้ใน **Deploy / Ops** (Stage 4) · *ยังเหลือ: CI เขียว + Exit criteria + Release Notes ทำในช่วง QA*

### Stage 7 — Feedback & Iterate
Usage Log (Pomodoro stats) · Retrospective · Backlog Grooming · Next Iteration Planning (กลับ Stage 1)

### Stage 8 — Portfolio Documentation
Project Overview · QA Artifacts Summary · Skills Demonstrated · Lessons Learned · SDLC Process Showcase (FigJam timeline)

---

## 8. Timeline & Alignment กับ 12-Week SDET Plan

| Week | บทบาทของโปรเจคนี้ |
|---|---|
| 1–4 | ใช้สกิลที่เรียน (TS/Jest, API, Cypress, Playwright) เป็น input |
| **5–6** | **สร้าง flagship + test ครบ 4 layer (pyramid 70/20/10)** |
| 7 | Stretch: เลือก 2 จาก plan → แนะนำ **axe (a11y)** + **k6 (perf)** |
| 8 | ใช้ repo นี้เป็นฐานหา OSS PR (Cypress/Playwright/plugin) |
| 9–12 | ใช้เป็น portfolio centerpiece ตอนสมัคร + ตอบสัมภาษณ์ |

### ตรงกับ AI Usage Rule
- **Plan first** → acceptance criteria (ข้อ 4) เขียนก่อนแตะ code ✅
- **Modify ≥30%** → scheduling/FSM logic ซับซ้อนพอให้แก้เองจริง
- **Break on purpose** → unit layer มี edge case ให้พังเพียบ
- **Whiteboard 10 นาที** → architecture 4 layer + FSM วาดได้ (เหตุผลที่ตัด Line/Notion)

---

## 9. Risk Register (ย่อ)

| Risk | ระดับ | Mitigation |
|---|---|---|
| Timer ไม่แม่นตอน tab background | สูง | timestamp-based + catch-up on refocus; document limitation |
| Scope creep (Line/Notion ไหลกลับ) | สูง | ยึดเส้น IN/OUT ข้อ 1 อย่างเคร่ง |
| Resume คำนวณ endsAt ผิด (time drift) | กลาง | unit test คู่ resume/restart + break-on-purpose |
| 2 สัปดาห์ไม่พอ | กลาง | feature core เท่านั้น, ความลึกอยู่ที่ test |

---

## 10. Definition of Done (Flagship)
- [ ] ครบ 4 layer, pyramid ~70/20/10
- [ ] Acceptance criteria ข้อ 4 ผ่านเป็น automated test ทั้งหมด
- [ ] GitHub Actions รัน 4 layer เขียว
- [ ] Allure/Mochawesome report generate ได้
- [ ] Cross-browser (Chromium/Firefox/WebKit) ผ่าน
- [ ] README + Known Limitations + Roadmap (Line/Notion)
- [ ] Traceability matrix: Requirement → Test → Bug → Fix
- [x] **Deploy บน Vercel + Turso + smoke test** (login/room/timer ใช้งานได้บน prod) ✅

---

*Next (จากสถานะจริง 2026-06-10): Pomodachi ใช้งานจริงบน prod ทุกวัน — Round 4 ปิด loop รายวัน (archive + auto จบวันเที่ยงคืน), เพิ่มประวัติ (แท็บ Stats: ค่าเฉลี่ย/วัน + คลิกดู task รายวัน, derive จาก `Task.doneDate`), backlog edit/delete, scrollbar เนียน → **ฟีเจอร์ product ครบวง + เสถียรพอใช้จริง** · ก้าวต่อไปคือ **Phase 2 QA** (Manual → E2E → Integration → Unit + CI + Allure) — พระเอกของ portfolio SDET, ยังไม่เริ่ม · งานเล็กค้าง: reset Google/Turso secrets (เคยโผล่ตอน setup), publish OAuth ออกจาก Testing mode (เมื่อพร้อมเปิดสาธารณะ), Stretch B (TTL auto-cleanup ห้องร้าง)*

> **บทเรียน Round 3 (เพิ่มสำหรับสัมภาษณ์):** local เขียว ≠ prod เขียว ≠ **มือถือจริงใช้ได้** — bug ที่หนักสุดมาจาก device/network/clock จริง ไม่ใช่ logic · เครื่องมือที่ปิดเคสได้: build stamp ยืนยันเวอร์ชัน + on-device debug overlay + การแยก optimistic-display ออกจาก network-sync (local-first) · sync ข้ามเครื่องที่ถูกคือ "server เป็น source of truth, re-fetch on focus" ไม่ใช่ push realtime (over-engineer สำหรับ scope นี้)
