/* ==========================================================================
   SOUTH STREET (سوث ستريت) - Login & Code Connection View
   ========================================================================== */

function renderLoginView() {
  return `
    <div style="max-width: 460px; margin: 2rem auto; text-align: center;" class="animate-fade-in">
      <div style="margin-bottom: 1.5rem;">
        <div class="brand-logo-icon" style="width: 72px; height: 72px; font-size: 2.2rem; margin: 0 auto 1rem; border-radius: 20px;">🕋</div>
        <h2 style="font-size: 1.8rem; margin-bottom: 0.3rem;" class="text-gold">وكالة سوث ستريت للسياحة والعمرة</h2>
        <p style="color: var(--text-secondary); font-size: 0.92rem;">SOUTH STREET Travel Agency & Umrah Portal</p>
      </div>

      <div class="card card-gold-border text-right" style="padding: 1.75rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.1rem; color: #FFF;">إقران الاتصال والوصول الآمن</h3>
          <span style="font-size: 0.75rem; background: rgba(16, 185, 129, 0.2); color: var(--text-emerald); padding: 0.2rem 0.5rem; border-radius: 4px;">مشفر AES-256</span>
        </div>

        <div id="login-alert" style="display: none; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.85rem;" class="btn-danger"></div>

        <div class="form-group">
          <label class="form-label">الاسم الكامل أو معرف المستخدم (اخترت من الوكالة)</label>
          <input type="text" id="login-name" class="input-field" placeholder="مثال: محمد عبد الله أو USR-005" autocomplete="off" />
        </div>

        <div class="form-group">
          <label class="form-label">كود الوصول والرمز الخاص (Access Security Code)</label>
          <input type="text" id="login-code" class="input-field" placeholder="مثال: PILGRIM-101 أو ADMIN-2026" style="letter-spacing: 2px; text-transform: uppercase; font-weight: 700;" autocomplete="off" />
        </div>

        <button type="button" class="btn btn-gold" style="width: 100%; margin-top: 0.5rem; font-size: 1.05rem;" onclick="handleLoginSubmit()">
          🔐 إقران الجهاز والاتصال بالتطبيق
        </button>

        <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px dashed var(--border-subtle); text-align: center;">
          <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.75rem;">رموز الوصول التجريبية السريعة للأدوار الخمسة:</p>
          <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; justify-content: center;">
            <button class="btn btn-outline btn-sm" onclick="quickFillCode('ADMIN-2026', 'د. عبد الرحمن العتيبي')">👑 مدير ADMIN</button>
            <button class="btn btn-outline btn-sm" onclick="quickFillCode('MANAGER-99', 'الأستاذ طارق السعيد')">💼 مسير MANAGER</button>
            <button class="btn btn-outline btn-sm" onclick="quickFillCode('GUIDE-777', 'الشيخ أحمد بن علي')">👳 مرشد GUIDE</button>
            <button class="btn btn-outline btn-sm" onclick="quickFillCode('ACC-404', 'الأستاذ ياسين الفاسي')">💰 محاسب ACC</button>
            <button class="btn btn-outline btn-sm" onclick="quickFillCode('PILGRIM-101', 'محمد عبد الله الشمري')">🕋 معتمر PILGRIM</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function quickFillCode(code, name) {
  const codeInp = document.getElementById('login-code');
  const nameInp = document.getElementById('login-name');
  if (codeInp) codeInp.value = code;
  if (nameInp) nameInp.value = name;
  handleLoginSubmit();
}

function handleLoginSubmit() {
  const codeInp = document.getElementById('login-code');
  const nameInp = document.getElementById('login-name');
  const alertEl = document.getElementById('login-alert');

  const code = codeInp ? codeInp.value : '';
  const name = nameInp ? nameInp.value : '';

  const res = window.securityEngine.authenticate(name, code);
  if (!res.success) {
    if (alertEl) {
      alertEl.textContent = res.message;
      alertEl.style.display = 'block';
    }
  } else {
    if (alertEl) alertEl.style.display = 'none';
    window.appController.onLoginSuccess(res.user);
  }
}
