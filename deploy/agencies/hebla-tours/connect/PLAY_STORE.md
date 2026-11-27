# R.H Connect on Google Play

Package: `tech.southstreet.connect.hebla` · Firebase project: `rh-tours-connect`

Upload files: `Downloads\RH Connect - Google Play\`, which holds:
- the `.aab` app bundle;
- the 512×512 icon;
- the 1024×500 feature graphic.

To rebuild after a new release:

```
deploy/connect-agency-build.sh deploy/agencies/hebla-tours hebla-tours play
```

The upload key is on the VPS at `/home/builder/keys/upload-hebla.p12`, with its password in `upload-hebla-pass`. Keep a backup of both. If they are lost, Play support can reset the upload key, but that takes days.

---

## 1. Developer account (once, you)
1. Open https://play.google.com/console and sign in with the Google account that should own the app.
2. Choose the account type:
   - **Personal:** $25. A new personal account must run a **closed test with at least 12 testers for 14 days** before production.
   - **Organization:** needs a D-U-N-S number for the agency. Then there is no 12-tester rule.
3. Verify your identity (ID card) and phone. Google's checks can take a few days.

## 2. Create the app
Go to **Create app** and fill in:
- App name: **R.H Connect**
- Default language: **Arabic – ar**
- App or game: **App**
- Free or paid: **Free**
- Accept the declarations.

## 3. App content (left menu "Policy → App content")
| Item | Answer |
|---|---|
| Privacy policy | `https://hebla-tours.1zayd1.tech/privacy` |
| App access | **Some functionality is restricted.** Give a reviewer account (username + password) created on the Hebla site for Google's reviewers. |
| Ads | **No ads** |
| Content rating | Questionnaire, category **Communication**. Answer *yes* to "users can interact / exchange messages" and no to everything else. |
| Target audience | **18 and over** |
| News app | No |
| Data safety | See section 4 |
| Government app | No |
| Financial features | None |
| Health | No |
| Account deletion | Users can create accounts → URL `https://hebla-tours.1zayd1.tech/account-deletion` |
| Foreground service permissions | Tick **Phone call** and **Microphone**. Description: "Keeps an answered voice call running with the screen off, like a phone call." Google asks for a short video link: record your phone answering a call and turning the screen off, upload it to YouTube as *unlisted*, and paste the link. |
| Full-screen intent | **Calling app**: "Shows incoming voice calls from the agency full screen, over the lock screen." |

## 4. Data safety (answers)
- Collects data: **Yes**. Encrypted in transit: **Yes**. Users can request deletion: **Yes**.
- Shared with third parties: **No**. Firebase delivers notifications on our behalf, which counts as a service provider, not sharing.
- Data types (all *collected*, *not shared*, *required*, purpose **App functionality** + **Account management**):
  - Personal info: **Name**, **Email address**, **Phone number**, **User IDs**
  - Messages: **Other in-app messages**
  - Photos and videos: **Photos** (the ones the user sends)
  - Audio: **Voice or sound recordings** (voice messages). Calls are not recorded.
  - Files and docs: **Files and docs** (sent in chat)
  - App activity: **Other user-generated content**
  - Device or other IDs: **Device or other IDs** (push token)

## 5. Store listing ("Grow → Store presence → Main store listing")
**App name:** R.H Connect

**Short description (ar, ≤80):**
تواصل مع وكالة رزاق هبلة تور: رسائل ومكالمات صوتية مباشرة.

**Full description (ar):**
R.H Connect هو تطبيق التواصل الرسمي لوكالة رزاق هبلة تور (R.H Tours) للسفر والعمرة.

• رسائل فورية مع فريق الوكالة: نص، صور، ملفات ورسائل صوتية.
• مكالمات صوتية مجانية عبر الإنترنت، تظهر كمكالمة هاتفية حتى والتطبيق مغلق.
• إشعارات فورية بمستجدات رحلتك وحجزك.
• دخول آمن بحسابك في موقع الوكالة.

التطبيق لزبائن الوكالة وفريقها. سجّل الدخول بحسابك الذي تستعمله في موقع الوكالة.

**English listing (add language "English – en-US"):**
- Short: *Chat and call R.H Tours: messages and voice calls with your agency.*
- Full: *R.H Connect is the official app of R.H Tours (Rezzag Hebla Tours), the travel and Umrah agency. Chat with the agency team (text, photos, files, voice messages), make free voice calls that ring like phone calls even when the app is closed, and get instant updates about your trip and booking. For the agency's customers and staff: sign in with your account from the agency website.*

**Graphics:**
- App icon: `app-icon-512.png`
- Feature graphic: `feature-graphic-1024x500.png`
- Phone screenshots: at least **2** (PNG/JPG, 9:16). Take them on your phone in R.H Connect: the chat list, a conversation, and an incoming call screen. No personal data of real customers.

**Category:** Communication · **Contact email:** the agency email · **Website:** `https://hebla-tours.1zayd1.tech`

## 6. Release
1. **App signing:** keep **"Let Google manage and protect your app signing key"**. Our `.aab` is signed with the upload key.
2. **Testing → Closed testing → Create track.**
   - Add the testers' Gmail addresses (12+ for a personal account).
   - Upload `RHToursConnect-1.8.1-9.aab`.
   - Release name `1.8.1`; notes: «أول إصدار على Google Play».
3. Send the testers the opt-in link. They must stay opted in for 14 days.
4. Then **Production → Create release** with the same bundle, and **Send for review**. Review usually takes 1–7 days.

## 7. After it is live
- Ask Claude to set `CONNECT_ON_PLAY=1` in Hebla's `.env`. The download page then sends Android users to Google Play, with no sign-in needed to install.
- Google signs the Play app with its own key, so a phone with the website APK must **uninstall it once** before installing from Play.
- From then on, Play installs updates by itself. Inside the app, «التحقق من التحديثات» opens Play's update sheet, then «تحديث الآن» restarts into the new version.
- For each new release:
  1. Raise `versionCode` in `lib/connect/version.ts`.
  2. Run the `play` build.
  3. Upload the new `.aab` to Production.
