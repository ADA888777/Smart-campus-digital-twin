# Smart Campus Network — Digital Twin & Dashboard

النسخة الرقمية للشبكة ولوحة المتابعة، تغطي المراحل 18 إلى 22 من المشروع:
التوأم الرقمي، لوحة المتابعة، حالة الأمن، تحليل الأعطال، والأتمتة.

البيانات كلها مأخوذة من ملف Packet Tracer الفعلي: نفس الأجهزة، ونفس أرقام
المنافذ، ونفس خطة العنونة و الـDHCP Pools.

> توضيح مهم: هذا المشروع توأم رقمي، أي نموذج برمجي للشبكة المرسومة في Packet Tracer.
> الطوبولوجيا وأرقام المنافذ وخطة العنونة منسوخة يدويًا إلى lib/topology.js، ولا يوجد
> أي اتصال مباشر بـPacket Tracer ولا أي قراءة بيانات منه أثناء التشغيل.
>
> قيم Latency وPacket Loss وAvailability كلها simulated metrics يولّدها محرّك التوأم
> من حالة الأجهزة داخل النموذج، وليست قياسات حقيقية من Packet Tracer أو من أجهزة فعلية.
>
> سيناريو الجهاز غير المصرّح به يضع UNKNOWN-01 كجهاز Unauthorized ويطبّق قرار Zero Trust
> بالرفض DENY داخل التوأم فقط، دون أن يفصل أي جهاز في Packet Tracer.
>
> في مسار Detect - Analyze - Decide - Action - Alert تُنفَّذ خطوة Action على التوأم نفسه:
> تتغيّر حالة الأجهزة والروابط في النموذج ويُفتح التنبيه، ولا يتعدّل أي شيء خارج المشروع.
>
> زر Restore يعيد الروابط والأجهزة والتنبيهات وسجلات الأعطال والـautomation والـmetrics
> والجهاز غير المصرّح به إلى الوضع الطبيعي، ولذلك كل سيناريو مستقل عن الذي قبله.

---

## التشغيل

```bash
node server.js
```

ثم افتحي <http://localhost:3000>

لا توجد أي مكتبات خارجية — Node.js 18 أو أحدث فقط، بدون `npm install`.

---

## ما الذي يفعله

| المرحلة | أين تجدينها |
|---|---|
| 18 — Digital Twin | `lib/topology.js` + `lib/store.js` — الجداول الستة: devices, links, events, metrics, alerts, scenarios |
| 19 — Dashboard | `public/` — حالة الشبكة، الأجهزة، التنبيهات |
| 20 — Dashboard Security | قسم Security Status: authorized / unauthorized / high risk / blocked |
| 21 — Fault Analysis | `lib/engine.js` → `RULES` — المشكلة، الأجهزة المتأثرة، الأثر، السبب المحتمل، التوصية |
| 22 — Automation | `lib/engine.js` → `runWorkflow` — Detect → Analyze → Decide → Action → Alert |

### السيناريوهات

خمسة أزرار في اللوحة، وكل ضغطة تكتب Event وAlert وسجل Fault وAutomation run:

- **Break the core link to SW-USERS** — يُسقط الرابط `CORE-SW Fa0/3 ↔ SW-USERS Fa0/1`
- **Take SW-USERS offline** — يوقف السويتش نفسه
- **Push traffic past the threshold** — يرفع Latency وPacket Loss ويحوّل الحالة إلى Warning
- **Join an unregistered device** — يُدخل جهازًا غير مسجّل على شبكة الضيوف، فيُرفض بمبدأ الثقة الصفرية
- **Restore the network** — يعيد كل شيء إلى وضعه الطبيعي

الأثر ليس ثابتًا مكتوبًا مسبقًا: النظام يحسب أي الأجهزة فقدت الاتصال بالفعل
عبر تتبّع المسار من الـCore، فإيقاف SW-USERS يُخرج أربعة أجهزة معه تلقائيًا.

---

## الواجهة البرمجية

| الطريقة | المسار | الوظيفة |
|---|---|---|
| GET | `/api/state` | كل شيء دفعة واحدة: الحالة، الأجهزة، الروابط، الأحداث، التنبيهات، الأمن |
| GET | `/api/devices` | الأجهزة |
| GET | `/api/links` | الروابط مع أرقام المنافذ |
| GET | `/api/events` | سجل الأحداث |
| GET | `/api/alerts` | التنبيهات |
| GET | `/api/metrics` | قياسات Latency وPacket Loss وAvailability |
| GET | `/api/scenarios` | سجل السيناريوهات وتحليلها |
| GET | `/api/security` | ملخص حالة الأمن |
| POST | `/api/scenario/:kind` | تشغيل سيناريو: `link-failure`, `device-failure`, `high-traffic`, `unauthorized-device`, `restore` |
| POST | `/api/poll` | أخذ قراءة جديدة للمؤشرات |
| POST | `/api/reset` | إعادة القاعدة إلى حالتها الأولى |

---

## الملفات

```
server.js            خادم HTTP بدون مكتبات + الواجهة البرمجية
lib/topology.js      الأجهزة والروابط وأرقام المنافذ وخطة الـVLANs
lib/store.js         تخزين الجداول الستة في data/twin.json
lib/engine.js        حساب الوصول، تحليل الأعطال، الأتمتة، السيناريوهات
schema.sql           مخطط SQL لنفس الجداول
public/              لوحة المتابعة
data/twin.json       الحالة الحالية (تُنشأ تلقائيًا)
```

---

## للمبرمج

التخزين الآن في ملف JSON عشان يشتغل المشروع فورًا بدون إعداد. للانتقال إلى
قاعدة بيانات حقيقية: نفّذ `schema.sql` واستبدل الدوال داخل `lib/store.js`
فقط — `lib/engine.js` و`server.js` و`public/` لا تحتاج أي تعديل.

الحقول القابلة للتعديل بسهولة:

- إضافة جهاز أو رابط: `lib/topology.js`
- تغيير قواعد السبب والتوصية: ثابت `RULES` في `lib/engine.js`
- تغيير حساب الأثر: دالة `severityFor` في `lib/engine.js`
- تغيير قائمة الأجهزة المصرّح بها: `REGISTRY` في `lib/topology.js`

> ملاحظة: رابط `ROUTER0 ↔ CORE-SW` مسجّل هنا على `Gi0/0 ↔ Fa0/1`. هذا الرقم
> لم يظهر في لقطات Packet Tracer، فالمطلوب تأكيده وتعديله في `lib/topology.js`.
