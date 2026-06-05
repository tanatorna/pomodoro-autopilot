# Pomodoro Autopilot — Full SDLC (Final)

> ระบบจัดเวลาแบบ auto: brain dump งาน → ระบบจัด Pomodoro + เดินนาฬิกาเอง + เตือนเมื่อหมดเวลา โดยไม่ต้องตั้งเวลาเอง
>
> **สถานะ:** Flagship project (แทนที่ expense tracker) — ทำใน **Week 5–6** ของ 12-Week SDET Plan
> **เป้าหมายซ้อน:** Portfolio piece + ใช้ตอบสัมภาษณ์ SDET ("PM ที่เขียน production-grade automated test ได้")
>
> **อัปเดตล่าสุด (2026-05-31):** 🚀 **Deploy ขึ้น prod แล้ว** (Vercel + Turso) — Product เสร็จ Slice 1–4 + enhancements · ฟีเจอร์ **Room** ครบ (แยกข้อมูล/แชร์/สร้าง/แก้รหัส/ลบ) · **Login (Google OAuth, optional)** ใช้งานได้จริงบน prod · **UI redesign 2 รอบ** (dusk → **Ember** กระดาษ/ดินเผา + layout **Split 50/50** ตาม design handoff) + responsive (มือถือใช้ได้) · ผ่านสมรภูมิ deploy (Prisma generate, Turso migrate, OAuth setup) · **Phase 2 QA ยังไม่เริ่ม ← งานหลักที่เหลือ**

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
- **Task edit / delete** — แก้ชื่อ inline + ลบ task (กัน task ที่กำลังโฟกัสไม่ให้ลบ)
- **Responsive + ธีม Ember (Split 50/50)** — ใช้บนมือถือได้ (มือถือ: timer บน + panel ล่าง · desktop: timer ซ้าย + panel ขวา)

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
| J5 | **แก้ไข/ลบ task** | hover/ดับเบิลคลิก → แก้ชื่อ inline (Enter/blur เซฟ) · 🗑 ลบ (task ที่กำลังโฟกัส **ลบไม่ได้**) · ▲▼ ปรับ priority |
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
`PomodoroApp` (layout) · `Timer` · `ScheduleMain` (task list+form) · `TaskForm` · `BacklogView` · `SettingsPanel` · `DaySummary` · `InterruptButton` · `RoomBadge` · `AccountButton`

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
│  backlog)                                    │   (integration, ~20%)
├────────────────────────────────────────────┤
│  Prisma + SQLite (เก็บ endsAt, state, log)   │ ← seed/reset ใน test
└────────────────────────────────────────────┘
   External (Line, Notion) = Future → mock เมื่อเพิ่ม
```

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

[Interrupt] = flow แยก: void ลูกปัจจุบัน + แทรก task ด่วน + reschedule ที่เหลือ
```

> PAUSED จำ origin (WORK/BREAK) ไว้เพื่อ resume กลับให้ถูก

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
| Framework | Next.js (App Router) |
| DB / ORM | Prisma + SQLite |
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

> **Build Log — ฟีเจอร์ Room (commit + push prod แล้ว · 2026-05-30):**
> - ✅ **แก้ bug 3 จุด:** (1) *infinite fetch loop* → `useMemo` ครอบ `roomHeaders`  (2) *session โหลดผิดห้อง* → effect รอจน `roomId` พร้อม  (3) *noti แจ้งเตือนเด้งรัวๆ* (ticker ยิง expire ซ้ำตอน API ช้า) → in-flight guard ใน `triggerExpire` (พิสูจน์: เด้ง 1 ครั้ง เดิม ~5)
> - ✅ **เพิ่มฟีเจอร์:** สร้างห้องใหม่ · แก้รหัสห้อง (ย้ายข้อมูล) + เช็ค code ซ้ำ live · **ลบห้อง (Stretch A — confirm 2 ชั้น → ห้องเปล่าใหม่)** · แก้ชื่อ/ลบ task · กัน task ที่โฟกัสอยู่ไม่ให้ลบ · focus คงที่ช่องหลัง Enter · timer โชว์ชื่อ task
> - ✅ **แก้ bug ที่เจอตอนทดสอบ:** DELETE task ติด FK `ScheduleSlot` (`ON DELETE RESTRICT`) → ลบ slot ก่อน · เพิ่ม `@@index([roomId])` 3 ตาราง
> - ✅ **แก้ bug หลัง login:** เปลี่ยนห้องขณะ login แล้วเด้งกลับห้องเดิม → sync `User.roomId` ทุกการเปลี่ยนห้อง (`e240b61`)
> - ✅ **UI redesign + responsive** — มือถือเดิม timer หลุดจอใช้ไม่ได้ → stack · ธีมผ่าน 2 รอบ: dusk (`65bc18a`) → **Ember + Split** (`5987f40`, design handoff) · verify ทั้ง mobile + desktop ทุก state
> - verify ผ่าน browser ทุกฟีเจอร์ + `tsc` + `build` เขียว · **ขึ้น prod จริงแล้ว**

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

*Next (จากสถานะจริง 2026-05-31): Product + Room + Login + Deploy + UI (Ember/Split) เสร็จและขึ้น prod แล้ว → เหลือ **Phase 2 QA** (Manual → E2E → Integration → Unit) ซึ่งเป็นพระเอกของ portfolio · งานเล็กค้าง: reset Google/Turso secrets, ขัดดีเทล UI เพิ่ม (เช่น toast ครอบคลุมขึ้น)*
