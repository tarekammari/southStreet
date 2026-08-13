# Production Implementation Plan — Security Dashboard, 2FA File Key Auth & Account System

Build a state-of-the-art, production-ready **Admin Security Dashboard** (`/admin`) featuring **2-Factor Security File Key Authentication (`.key` file)**, **Real-time User Login Monitoring**, **IP & Device/PC Fingerprinting Authorization**, **Account Generator**, **AES-256 Encrypted Data Storage & Hashed Passwords**, **Pre-seeded Accounts for all User Types**, and **Sakhr AI Knowledge Base Management**.

---

## 🔑 Pre-Seeded Production Test Accounts (For Each User Type)

> [!IMPORTANT]
> The database will be initialized with pre-configured accounts for testing each role:

| # | User Role Type | Role Title (Arabic) | Email / Username | Password | Account Status | Security File Key Needed? |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **`SUPER_ADMIN`** | مدير الوكالة العام | `admin@southstreet.dz` | `Admin@2026!` | `APPROVED` | **YES** (`southstreet_admin.key`) |
| **2** | **`AGENCY_MANAGER`** | مدير البرامج والعروض | `manager@southstreet.dz` | `Manager@2026!` | `APPROVED` | **YES** (`southstreet_admin.key`) |
| **3** | **`AGENCY_AGENT`** | موظف خدمة العملاء | `agent@southstreet.dz` | `Agent@2026!` | `APPROVED` | **NO** |
| **4** | **`PILGRIM_USER`** | معتمر معتمد | `user@southstreet.dz` | `User@2026!` | `APPROVED` | **NO** |
| **5** | **`PENDING_USER`** | معتمر ينتظر الموافقة | `pending@southstreet.dz` | `Pending@2026!` | `PENDING_APPROVAL` | **NO** *(Triggers IP & PC Fingerprint queue!)* |

> [!NOTE]
> **Default Admin Security File Key**: `SOUTHSTREET-SECURE-KEY-2026-X7Y9Z`
> *(Can also be downloaded as a `.key` file directly from the login page or admin dashboard)*

---

## Architecture & Security Specifications

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                 PRODUCTION SECURITY SYSTEM (/admin)                    │
  └────────────────────────────────────────────────────────────────────────┘
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      ▼                              ▼                              ▼
┌───────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
│ 1. 2FA Security File Key  │  │ 2. Real-Time Login        │  │ 3. PC Device Fingerprint  │
│ - Mandatory for Admins    │  │ - Online Sessions Track   │  │ - IP Address Capture      │
│ - Upload southstreet.key  │  │ - Access Approval Queue   │  │ - Hardware Canvas Hash    │
└───────────────────────────┘  └───────────────────────────┘  └───────────────────────────┘
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      ▼                              ▼                              ▼
┌───────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
│ 4. Account Generator      │  │ 5. AES-256 Encryption     │  │ 6. Sakhr AI Knowledge     │
│ - Create custom roles     │  │ - Encrypted JSON Database │  │ - Dynamic Q&A Rules       │
│ - Manage 5 account types  │  │ - Salted SHA-256 Passwords│  │ - Package Prices & Hotel  │
└───────────────────────────┘  └───────────────────────────┘  └───────────────────────────┘
```

---

## Proposed Code Changes

### Core Security & Encryption Module

#### [NEW] [security.ts](file:///d:/Test/SouthStreet/lib/security.ts)
- `hashPassword(password, salt)` using SHA-256.
- `encryptData(data, secret)` and `decryptData(encryptedText, secret)` using AES-256.
- `verifyAdminFileKey(uploadedKeyContent, storedHashedKey)` for 2FA.
- `generateNewSecurityKey()` to produce downloadable `.key` file payload.
- `generateDeviceFingerprint(req)` to hash IP address, User-Agent, and hardware signatures (`FP-XXXX-XXXX`).

#### [NEW] [db.ts](file:///d:/Test/SouthStreet/lib/db.ts)
- Encrypted database reader and writer (`data/secure_db.json.enc`).
- Pre-seed with all 5 accounts, hashed default security key, and verified Sakhr AI rules.

---

### User Authentication & Approval API Layer

#### [NEW] [route.ts](file:///d:/Test/SouthStreet/app/api/admin/auth/route.ts)
- Handles 2-step login for Admins & single-step login for Users/Agents.
- Returns `PENDING_APPROVAL` status with IP & PC Device details if account requires authorization.

#### [NEW] [route.ts](file:///d:/Test/SouthStreet/app/api/admin/security-key/route.ts)
- Endpoint to regenerate Admin Security Key and trigger `.key` file download.

#### [NEW] [route.ts](file:///d:/Test/SouthStreet/app/api/admin/users/route.ts)
- `GET`: Fetch accounts, online sessions, and pending authorization requests with IP/Fingerprint.
- `POST`: Account Generation endpoint.
- `PATCH`: 1-Click Approve / Reject / Suspend user access.

---

### Sakhr AI Integration

#### [NEW] [route.ts](file:///d:/Test/SouthStreet/app/api/admin/sakhr-knowledge/route.ts)
- Admin CRUD endpoint for Sakhr AI rules and packages.

#### [MODIFY] [route.ts](file:///d:/Test/SouthStreet/app/api/ai/sakhr/route.ts)
- Connect Sakhr AI route to read active knowledge rules directly from `lib/db.ts` before triggering Gemini AI & Google Web Search.

---

### Modern Admin Dashboard UI & 2FA Login Page

#### [NEW] [page.tsx](file:///d:/Test/SouthStreet/app/admin/page.tsx)
- 2-Step Security Login Modal with File Upload (`.key`).
- Modern Glassmorphic Admin Dashboard Tabs:
  1. 📊 **Overview Stats**: Live online count, pending approval alerts, total accounts, AI rules count.
  2. 👥 **Real-Time Login & Approval Tracker**: Active sessions, pending access requests with IP Addresses and PC Device Fingerprints (`FP-9A8B-3C2D`), with 1-Click Approve/Reject.
  3. 🔑 **Security Key Manager**: View current key details, click **Regenerate & Download New Key (`southstreet_admin.key`)**.
  4. ➕ **User Account Generator**: Create staff or pilgrim accounts.
  5. 🧠 **Sakhr AI Knowledge Base**: Manage packages, pricing, hotels, documents, and Umrah rituals.

---

## Verification Plan

### Automated Verification
- Run Node.js test script to verify login and 2FA file key authorization for all 5 account types.
- Verify AES-256 database encryption integrity.

### Manual Verification
- Log in with each user type to test role permissions.
- Test pending approval login for `pending@southstreet.dz` and approve access from the Admin Dashboard using IP & PC Fingerprint tracking.
- Test regenerating & downloading the `southstreet_admin.key` file.
