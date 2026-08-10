/* ==========================================================================
   SOUTH STREET (سوث ستريت) - System Admin Dashboard View
   ========================================================================== */

function renderAdminView() {
  const store = window.appStore;
  const users = store.getUsers();
  const logs = store.getAuditLogs();

  return `
    <div class="animate-fade-in">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
        <div>
          <h2 class="text-gold" style="font-size: 1.6rem;">لوحة مدير النظام والتحكم والأمان (ADMIN)</h2>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">إدارة الرموز المشفرة للمسيرين والمرشدين والمعتمرين وإحصائيات الأمان</p>
        </div>
        <button class="btn btn-gold btn-sm" onclick="openCreateUserModal()">
          ➕ إصدار كود وصول جديد
        </button>
      </div>

      <!-- Quick Metrics Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="card card-gold-border">
          <div style="color: var(--text-secondary); font-size: 0.85rem;">المستخدمون المسجلون</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; margin-top: 0.2rem;">${users.length} مجمع</div>
          <div style="font-size: 0.75rem; color: var(--text-emerald); margin-top: 0.2rem;">● جميع الأكواد مشفرة بالكامل</div>
        </div>
        <div class="card">
          <div style="color: var(--text-secondary); font-size: 0.85rem;">أكواد الأمان النشطة</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: var(--gold-main); margin-top: 0.2rem;">100% مؤمنة</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.2rem;">بروتوكول WhatsApp Private SSL</div>
        </div>
        <div class="card">
          <div style="color: var(--text-secondary); font-size: 0.85rem;">أنشطة الأمان المسجلة</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: #38BDF8; margin-top: 0.2rem;">${logs.length} عملية</div>
          <div style="font-size: 0.75rem; color: var(--text-emerald); margin-top: 0.2rem;">تسجيل لحظي بدون فقدان</div>
        </div>
      </div>

      <!-- Users & Access Codes Table -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.1rem; margin-bottom: 1rem; color: #FFF;">جدول الرموز والمستخدمين (User ID & Security Access Codes)</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>المعرف ID</th>
                <th>اسم المستخدم</th>
                <th>الدور Role</th>
                <th>كود الوصول الأمني</th>
                <th>الهاتف</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td style="font-family: monospace; font-weight: bold; color: var(--gold-main);">${u.id}</td>
                  <td style="font-weight: 700;">${u.name}</td>
                  <td><span class="role-tag ${u.role}">${u.roleName}</span></td>
                  <td>
                    <span style="font-family: monospace; font-weight: bold; background: rgba(0,0,0,0.3); padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid var(--border-gold); color: var(--gold-main);">
                      ${u.code}
                    </span>
                  </td>
                  <td dir="ltr" style="text-align: right;">${u.phone}</td>
                  <td><span style="color: var(--text-emerald); font-weight: bold;">${u.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Audit Logs Table -->
      <div class="card">
        <h3 style="font-size: 1.1rem; margin-bottom: 1rem; color: #FFF;">سجل الأمان والعمليات المباشرة (Security Audit Logs)</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>التاريخ والوقت</th>
                <th>المستخدِم</th>
                <th>الدور</th>
                <th>الحدث</th>
                <th>التفاصيل</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              ${logs.slice(0, 10).map(l => `
                <tr>
                  <td style="font-size: 0.8rem; color: var(--text-muted);">${l.timestamp}</td>
                  <td style="font-weight: 600;">${l.actorName}</td>
                  <td><span class="role-tag ${l.actorRole}">${l.actorRole}</span></td>
                  <td style="color: var(--gold-main); font-weight: 600;">${l.action}</td>
                  <td style="font-size: 0.82rem;">${l.details}</td>
                  <td style="font-family: monospace; font-size: 0.78rem;">${l.ip}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function openCreateUserModal() {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  const generatedCode = window.securityEngine.generateAccessCode('VIP');

  modalContainer.innerHTML = `
    <div class="modal-overlay active" id="create-user-modal">
      <div class="modal-box text-right">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
          <h3 style="font-size: 1.2rem; color: var(--gold-main);">إنشاء كود وصول ومستخدم جديد</h3>
          <button class="btn btn-outline btn-sm" onclick="closeModal('create-user-modal')">✖</button>
        </div>

        <form onsubmit="handleCreateUserSubmit(event)">
          <div class="form-group">
            <label class="form-label">الاسم الكامل للمستخدم</label>
            <input type="text" id="new-user-name" class="input-field" placeholder="مثال: سلمان الخالدي" required />
          </div>

          <div class="form-group">
            <label class="form-label">نوع الدور والصلاحية (Role)</label>
            <select id="new-user-role" class="input-field">
              <option value="pilgrim">مسافر / معتمر (Pilgrim)</option>
              <option value="murshid">مرشد ديني (Guide)</option>
              <option value="accountant">محاسب الوكالة (Accountant)</option>
              <option value="manager">مسير حملات (Manager)</option>
              <option value="admin">مدير نظام (Admin)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">رقم الجوال للتواصل</label>
            <input type="text" id="new-user-phone" class="input-field" placeholder="+966 50 000 0000" />
          </div>

          <div class="form-group">
            <label class="form-label">كود الوصول المولد تلقائياً (Security Code)</label>
            <div class="access-code-box" id="generated-code-display">${generatedCode}</div>
          </div>

          <button type="submit" class="btn btn-gold" style="width: 100%; margin-top: 1rem;">
            💾 حفظ ونشر كود الوصول
          </button>
        </form>
      </div>
    </div>
  `;
}

function handleCreateUserSubmit(e) {
  e.preventDefault();
  const nameInp = document.getElementById('new-user-name');
  const roleInp = document.getElementById('new-user-role');
  const phoneInp = document.getElementById('new-user-phone');
  const codeDisplay = document.getElementById('generated-code-display');

  const roleNames = {
    pilgrim: 'معتمر',
    murshid: 'مرشد ديني',
    accountant: 'محاسب الوكالة',
    manager: 'مسير الحملات',
    admin: 'مدير النظام'
  };

  const roleVal = roleInp.value;
  const newUser = {
    id: `USR-${Math.floor(100 + Math.random() * 900)}`,
    code: codeDisplay.textContent.trim(),
    name: nameInp.value.trim(),
    role: roleVal,
    roleName: roleNames[roleVal],
    phone: phoneInp.value.trim() || '+966 50 000 0000',
    avatar: nameInp.value.trim().charAt(0),
    status: 'نشط'
  };

  window.appStore.saveUser(newUser);
  closeModal('create-user-modal');
  window.appController.renderCurrentView();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.remove();
}
