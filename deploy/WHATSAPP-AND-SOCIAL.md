# WhatsApp & social media — setup and playbook

Everything here is managed from **Dashboard → واتساب والتواصل** (inbox, channels,
connection status, publishing kit). This guide covers what has to be done outside
the app.

---

## 1. What works right away (no Meta account needed)

1. Dashboard → واتساب والتواصل → **القنوات والروابط**: enter the agency WhatsApp
   number, the welcome message, and the links of your Facebook / Instagram / TikTok /
   YouTube / Telegram pages → **حفظ**.
2. The site then shows "راسلنا على واتساب" in the footer, in Sakhr's chat window,
   on every program card ("استفسر على واتساب", with the program name pre-typed) and
   on the **/links** page. Social icons appear in the footer and on /links.
3. Every program card, the guide and the About page have **share buttons**
   (WhatsApp, Facebook, Telegram, copy link, and the phone's own share sheet).
4. Shared links show a **preview card** (photo, title, description) on Facebook,
   WhatsApp, Telegram and X.

---

## 2. Sakhr answering on WhatsApp (WhatsApp Business Cloud API)

The free WhatsApp Business **app** cannot be connected to software. Use the
**Cloud API** (Meta): free to set up; conversations started by customers are free
under Meta's current pricing (check Meta's pricing page for your country).

1. **Meta Business account** — business.facebook.com → create one for the agency
   (agency name, address, website). Verify the business when Meta asks (registre de
   commerce helps).
2. **App** — developers.facebook.com → My Apps → Create app → type **Business** →
   add the **WhatsApp** product.
3. **Phone number** — WhatsApp → API Setup → add the agency number.
   - The number must **not** be active on the normal WhatsApp / WhatsApp Business
     app (delete that account first, or use a new SIM for the API).
   - Verify it by SMS or call. Set the display name ("South Street — ساوث ستريت").
4. **Permanent token** — Business Settings → Users → **System users** → add one
   (Admin) → assign the app and the WhatsApp account → **Generate token** with
   `whatsapp_business_messaging` and `whatsapp_business_management`, expiry *Never*.
5. **Webhook** — WhatsApp → Configuration → Webhook:
   - Callback URL: `https://YOUR-DOMAIN/api/whatsapp/webhook`
     (the exact URL is shown in the dashboard → الربط بواتساب).
   - Verify token: any long random text you choose.
   - Subscribe to the **messages** field.
6. **Server settings** (Vercel → Settings → Environment Variables, or `.env` on the VPS):

   ```
   WHATSAPP_TOKEN=            # the permanent token (step 4)
   WHATSAPP_PHONE_NUMBER_ID=  # API Setup → Phone number ID
   WHATSAPP_VERIFY_TOKEN=     # the text you chose in step 5
   WHATSAPP_APP_SECRET=       # App settings → Basic → App secret
   ```

   Redeploy / restart. The dashboard shows **"مربوط"**.
7. Send "السلام عليكم" to the agency number from your phone: Sakhr answers, and the
   conversation appears in **المحادثات**.

### How it behaves

- Sakhr answers programs, prices, dates, hotels, the Umrah guide and booking
  questions, understands **voice notes**, and sends links to book.
- A **client** whose phone number is on their account or booking hears their own
  booking status and remaining balance — nobody else's.
- A **team member** gets a short read-only work summary. **Nothing can be changed
  over WhatsApp** (no approvals, payments or accounts) — those stay in the app behind
  the security key, because a phone number is weaker proof than password + key.
- Writing **موظف** hands the chat to the team (Sakhr stops for that customer);
  writing **صخر** brings Sakhr back. From the inbox the team can reply, "أتولى
  المحادثة" or "إعادة صخر".
- WhatsApp rule: free-form replies are allowed for **24 hours after the customer's
  last message**. After that the customer has to write again (or you need an
  approved message template).

---

## 3. Social media playbook

### Profiles (do once)

| Network | What to set |
|---|---|
| **Facebook page** | Category *Travel agency*; cover = the program photo; **Add button → Send WhatsApp message** (connect the WhatsApp number); website = `https://YOUR-DOMAIN/links?utm_source=facebook`; turn on auto-reply "مرحباً! للرد السريع راسلونا على واتساب: …" |
| **Instagram** (professional account, linked to the Facebook page) | Bio from Dashboard → أدوات النشر (copy); link = the Instagram bio link from the kit; add **WhatsApp** contact button; highlights: البرامج · الفنادق · آراء المعتمرين · الدليل |
| **TikTok** (business account) | Bio link = TikTok link from the kit |
| **Google Business Profile** | business.google.com: address, hours, photos, phone, website → appears on Google Maps searches like "عمرة الجزائر" |

All bio links point to **/links**, which leads to WhatsApp, programs, booking and the
guide. Their `utm_source` tags tell you which network brings visitors.

### What to post (weekly rhythm)

| Day | Post | Link to |
|---|---|---|
| Sat | New / next program: photo, dates, "ابتداءً من … دج", seats left | program share link (card → share) |
| Mon | Hotel of the week: photos + distance to the Haram | /hotels |
| Wed | Short guide tip (one ritual, one dua) — reels/TikTok work best | /guide |
| Thu | Pilgrim review (with permission) or a team member intro | /about |
| Any day of travel | Live stories from Makkah / Madinah (the group guide) | — |

Every post ends with one clear action: **"راسلونا على واتساب"** (the WhatsApp
button / link) or **"احجز من الرابط في البايو"**.

### Ads (when you start paying)

- Facebook/Instagram **"Click to WhatsApp"** campaigns: the ad opens a WhatsApp chat
  directly — Sakhr answers instantly, 24/7, and hands over to the team when needed.
- Target: Algeria, age 30–65, interests Umrah / Hajj / Islam, 50–80 km around your
  branches. Start small (1 000–2 000 DZD/day), keep the ad that brings the most chats.

### Offline

Dashboard → أدوات النشر → **QR codes** (WhatsApp and /links): print them on the
office door, flyers, business cards, the bus and the pilgrims' badges.
