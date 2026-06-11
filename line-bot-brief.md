# บรีฟสำหรับ Claude Code — VBNEXTX LINE Bot (Gemini AI)

> เป้าหมาย: LINE bot ตอบลูกค้าธุรกิจ **นายหน้าอสังหาริมทรัพย์ครบวงจร** ในนาม **"ทีมดูแลลูกค้าของ VBNEXTX"**
> โดยอ่านข้อมูลจาก FAQ (Google Sheet) แล้วตอบด้วยภาษาธรรมชาติผ่าน Gemini 3.5 Flash

## ข้อมูลที่ยืนยันแล้ว (เช็ก ณ มิ.ย. 2026)
- `gemini-3.5-flash` มีจริง · GA วันที่ 19 พ.ค. 2026 · ใช้ผ่าน Gemini API ได้
- Context window 1M tokens · max output 65,536 tokens (เราใช้แค่ 1024 พอ)
- **thinking default = medium** → เราตั้งเป็น `low` สำหรับงาน FAQ เพื่อประหยัด token + ตอบไว
- usageMetadata มี field: `thoughtsTokenCount`, `candidatesTokenCount`, และ `finishReason` อยู่ที่ `candidates[0].finishReason`

> ⚠️ SDK `@google/genai` อัปเดตบ่อย — ตอน implement ให้เช็กชื่อ param ของ thinking config (`thinkingLevel` vs `thinkingConfig.thinkingBudget`) กับ docs เวอร์ชันที่ติดตั้งจริงอีกที

---

## ส่วนที่ 1 — โครงไฟล์

```
app/
  api/
    line-webhook/
      route.ts        # รับ webhook · verify signature · จัดการ event · reply
lib/
  sheet.ts            # ดึง FAQ จาก Google Sheet (CSV) + cache ใน memory 60 วิ
  gemini.ts           # เรียก Gemini · log usage · เช็ก finishReason
  prompt.ts           # ประกอบ system prompt (faq + question)
  line.ts             # สร้าง LINE client + helper reply (optional แยกออกมาให้สะอาด)
```

หน้าที่แต่ละไฟล์:
- **`route.ts`** — entry point เดียว · รับ POST · เป็นตัวควบคุม flow ทั้งหมด
- **`sheet.ts`** — `getFaq()` คืน CSV string · มี in-memory cache `{ data, expiresAt }` อายุ 60 วิ
- **`gemini.ts`** — `askGemini(faq, question)` คืน `{ reply, finishReason, usage }`
- **`prompt.ts`** — ฟังก์ชัน `buildPrompt(faq, question)` ประกอบ XML ตามส่วนที่ 3
- **`line.ts`** — export `lineClient` + `replyText(replyToken, text)`

---

## ส่วนที่ 2 — Sheet Schema (FAQ)

Google Sheet เผยแพร่เป็น CSV public (env: `SHEET_CSV_URL`)
แถวแรกเป็น header · **3 คอลัมน์ตามลำดับ: หมวด · คำถาม · คำตอบ**

| หมวด | คำถาม | คำตอบ |
|------|-------|-------|
| เวลาทำการ | เปิดทำการกี่โมง | จันทร์–เสาร์ 9:00–18:00 น. หยุดวันอาทิตย์ |
| ค่าบริการ | ค่าบริการนายหน้าเท่าไหร่ | คิด 3% ของราคาขาย ตามมาตรฐานตลาด |
| บริการ | รับฝากขาย/ฝากเช่าไหม | รับครับ ทั้งฝากขายและฝากเช่า ฟรีค่าลงประกาศ |
| พื้นที่บริการ | ดูแลโซนไหนบ้าง | กรุงเทพฯ และปริมณฑลเป็นหลัก |

หมายเหตุการออกแบบ:
- 1 แถว = 1 คำถาม-คำตอบ · เขียน คำตอบ ให้ครบในตัวเอง (AI จะหยิบไปเรียบเรียง)
- ราคา/เวลา/ที่ตั้ง ใส่ใน Sheet เท่านั้น — บอทห้ามแต่งเอง
- จะให้ Sheet เดียวรองรับหลายภาษาในอนาคต ค่อยเพิ่มคอลัมน์ `lang`

---

## ส่วนที่ 3 — System Prompt (สำคัญสุด)

ใช้โครง XML แบบ Google official · **FAQ มาก่อน task · question อยู่ท้ายสุด** (ลดโอกาส prompt injection และให้โมเดลโฟกัสคำถามจริง)

```
<role>
คุณคือทีมดูแลลูกค้าของ VBNEXTX บริษัทนายหน้าอสังหาริมทรัพย์ที่ให้บริการครบวงจร
</role>

<constraints>
- ตอบโดยใช้ข้อมูลใน <faq> เท่านั้น ห้ามใช้ความรู้นอกเหนือจากนี้
- ห้ามแต่งหรือเดา ราคา ค่าบริการ เวลาทำการ ที่ตั้ง หรือเงื่อนไขใดๆ เด็ดขาด
- ถ้าคำถามของลูกค้าไม่มีข้อมูลใน <faq> ให้ตอบด้วยข้อความนี้คำต่อคำ:
  "เรื่องนี้ขอให้ทีมงานติดต่อกลับนะคะ รบกวนฝากเบอร์โทรหรือ LINE ไว้ได้เลยค่ะ 😊"
- โทนภาษา: สุภาพแต่อบอุ่น เข้าถึงง่าย ใช้ emoji ได้แต่ไม่เยอะ (1 ตัวต่อข้อความก็พอ)
- ความยาวคำตอบ 1–3 ประโยค กระชับ ไม่เยิ่นเย้อ
</constraints>

<output_format>
ตอบเป็นภาษาไทย ข้อความธรรมดา ห้ามใช้ markdown (ไม่มี * # - หรือ bullet)
</output_format>

<faq>
{{CSV_FROM_SHEET}}
</faq>

<question>
{{USER_MESSAGE}}
</question>
```

แนวทาง implement:
- `{{CSV_FROM_SHEET}}` = ผลจาก `getFaq()` ใส่ดิบๆ ได้เลย (โมเดลอ่าน CSV รู้เรื่อง)
- `{{USER_MESSAGE}}` = ข้อความ text ที่ลูกค้าพิมพ์มา
- ส่ง `<role>` + `<constraints>` + `<output_format>` เป็น **systemInstruction** ส่วน `<faq>` + `<question>` เป็น **contents** ก็ได้ หรือรวมเป็น prompt เดียวก็ได้ — แนะนำแยก systemInstruction ออกมาเพื่อความชัดเจน
- **default message** ต้องเก็บเป็น constant `DEFAULT_REPLY` ตัวเดียวกัน ใช้ทั้งใน prompt และใน fallback ฝั่งโค้ด (กรณี MAX_TOKENS / error)

```ts
export const DEFAULT_REPLY =
  "เรื่องนี้ขอให้ทีมงานติดต่อกลับนะคะ รบกวนฝากเบอร์โทรหรือ LINE ไว้ได้เลยค่ะ 😊";
```

---

## ส่วนที่ 4 — LINE Webhook Flow

ลำดับการทำงานใน `POST /api/line-webhook`:

1. **อ่าน raw body** — ต้องใช้ body ดิบ (string) เพื่อ verify signature ห้าม parse JSON ก่อน
   ```ts
   const body = await req.text();
   const signature = req.headers.get("x-line-signature") ?? "";
   ```
2. **Verify signature** — ใช้ `validateSignature(body, LINE_CHANNEL_SECRET, signature)` จาก `@line/bot-sdk`
   - ไม่ผ่าน → return `new Response("Invalid signature", { status: 401 })`
3. **Parse events** — `JSON.parse(body).events` · กรองเฉพาะ `type === "message"` และ `message.type === "text"`
   - event อื่น (sticker, image, follow ฯลฯ) → ข้ามไป แต่ยัง return 200
4. **ดึง FAQ** — `await getFaq()` (cache 60 วิ · ไม่ยิง Sheet ทุก request)
5. **เรียก Gemini** — `askGemini(faq, userText)` พร้อม timeout (ดูส่วนที่ 5)
   - log `finishReason`, `thoughtsTokenCount`, `candidatesTokenCount` ทุก request
   - ถ้า `finishReason === "MAX_TOKENS"` → ใช้ `DEFAULT_REPLY` แทน (กันส่งครึ่งประโยค)
6. **Reply** — `client.replyMessage({ replyToken, messages: [{ type: "text", text: reply }] })`
   - reply token ใช้ได้ครั้งเดียว · LINE คาดหวังให้ตอบไว
7. **Return 200** — ตอบ `new Response("OK", { status: 200 })` เสมอเมื่อจัดการ event เสร็จ

ข้อควรระวังบน Vercel:
- ตั้ง `export const maxDuration = 15;` (หรือ 30 ตามแพ็กเกจ) ใน route — กัน function ถูกตัดก่อน Gemini ตอบ
- รวมเวลา fetch sheet + Gemini ควรจบใน ~8 วิ (Flash + thinking low เร็วพอ) เผื่อ buffer ก่อนชน reply token
- ใช้ `runtime = "nodejs"` (ไม่ใช่ edge) เพราะ `@line/bot-sdk` ใช้ Node crypto

---

## ส่วนที่ 5 — Error Handling

หลักการใหญ่: **เกือบทุกกรณี return 200 ให้ LINE** เพื่อไม่ให้ LINE retry รัวๆ หรือปิด webhook อัตโนมัติ (ยกเว้น signature ผิด → 401)

| สถานการณ์ | จัดการอย่างไร |
|-----------|---------------|
| **Sheet ดึงไม่ได้** (network/timeout) | ใช้ cache เก่าถ้ามี (serve stale) · ถ้าไม่มี cache เลย → reply `DEFAULT_REPLY` + log error · return 200 |
| **Gemini timeout** | ใช้ `AbortController` ตั้ง ~8 วิ · timeout → reply `DEFAULT_REPLY` · log |
| **finishReason = MAX_TOKENS** | reply `DEFAULT_REPLY` (อย่าส่งข้อความที่ถูกตัดกลางทาง) |
| **Gemini ตอบว่าง / error อื่น** | reply `DEFAULT_REPLY` · log error |
| **LINE replyMessage ล้มเหลว** | log error · return 200 (อย่า throw — ป้องกัน 500 ที่ทำให้ LINE retry) |
| **Signature ไม่ผ่าน** | return 401 ทันที ไม่ประมวลผลต่อ |

ตัวอย่าง timeout wrapper สำหรับ Gemini:
```ts
const controller = new AbortController();
const t = setTimeout(() => controller.abort(), 8000);
try {
  const res = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 1.0,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingLevel: "low" }, // <- ลด thinking สำหรับ FAQ (เช็กชื่อ param กับ SDK)
      abortSignal: controller.signal,
    },
  });
  return res;
} catch (e) {
  // timeout หรือ error -> ใช้ DEFAULT_REPLY
} finally {
  clearTimeout(t);
}
```

Log format แนะนำ (ค้น Vercel logs ง่าย):
```ts
console.log(JSON.stringify({
  tag: "gemini",
  finishReason,
  thoughtsTokenCount: usage?.thoughtsTokenCount,
  candidatesTokenCount: usage?.candidatesTokenCount,
}));
```

---

## Environment Variables (มีครบแล้ว 4 ตัว)
```
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
GEMINI_API_KEY=
SHEET_CSV_URL=
```

## Checklist ส่งงาน
- [ ] webhook ตอบ 200 ภายในเวลา · reply ถึงลูกค้าจริง
- [ ] verify signature ทำงาน (ลองยิง request ปลอม → 401)
- [ ] FAQ cache 60 วิ (ไม่ยิง Sheet ทุกข้อความ)
- [ ] log finishReason + token counts ครบทุก request
- [ ] MAX_TOKENS / timeout / sheet fail → ตอบ DEFAULT_REPLY ไม่พัง
- [ ] คำถามนอก FAQ → ตอบ default message ส่งต่อทีม

---

**ข้อมูลบริษัท:** VBNEXTX — นายหน้าอสังหาริมทรัพย์ที่เหนือกว่าด้วยบริการครบวงจร · https://www.vbeyond.co.th/
