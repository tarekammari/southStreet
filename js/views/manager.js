/* ==========================================================================
   SOUTH STREET (سوث ستريت) - Manager / Supervisor Dashboard View
   ========================================================================== */

function renderManagerView() {
  const campaigns = window.appStore.getCampaigns();
  const users = window.appStore.getUsers();

  return `
    <div class="animate-fade-in">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
        <div>
          <h2 class="text-gold" style="font-size: 1.6rem;">لوحة مسير الحملات والرحلات (MANAGER)</h2>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">إدارة الأفواج والرحلات وتوزيع الغرف والحافلات وتوليد أكواد المعتمرين</p>
        </div>
        <button class="btn btn-gold btn-sm" onclick="openCreateUserModal()">
          🔑 إصدار كود معتمر/مرشد
        </button>
      </div>

      <!-- Active Campaigns List -->
      <div style="display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 2rem;">
        ${campaigns.map(c => `
          <div class="card card-gold-border text-right">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
              <div>
                <span style="font-size: 0.78rem; background: var(--primary-deep); color: var(--gold-main); padding: 0.25rem 0.65rem; border-radius: 4px; border: 1px solid var(--gold-main);">
                  رقم الحملة: ${c.id}
                </span>
                <h3 style="font-size: 1.3rem; margin-top: 0.4rem; color: #FFF;">${c.title}</h3>
              </div>
              <span class="btn btn-primary btn-sm">${c.status}</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; font-size: 0.9rem;">
              <div>
                <span class="text-muted">🏨 فندق مكة المكرمة:</span>
                <div style="font-weight: 700; color: var(--gold-main); margin-top: 2px;">${c.makkahHotel}</div>
              </div>
              <div>
                <span class="text-muted">🕌 فندق المدينة المنورة:</span>
                <div style="font-weight: 700; color: #38BDF8; margin-top: 2px;">${c.madinahHotel}</div>
              </div>
              <div>
                <span class="text-muted">✈️ الطيران والرحلة:</span>
                <div style="font-weight: 700; color: #FFF; margin-top: 2px;">${c.flightNumber}</div>
              </div>
              <div>
                <span class="text-muted">🚌 الحافلة المخصصة:</span>
                <div style="font-weight: 700; color: var(--text-emerald); margin-top: 2px;">${c.busNumber}</div>
              </div>
            </div>

            <div style="margin-top: 1.25rem; padding-top: 0.75rem; border-top: 1px dashed var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.85rem; color: var(--text-secondary);">عدد المعتمرين المسجلين: <strong>${c.pilgrimsCount} معتمر</strong> | المرشد: <strong>${c.guideName}</strong></span>
              <button class="btn btn-outline btn-sm" onclick="window.appController.switchTab('chat')">💬 المجمّع والتواصل الخاص</button>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Pilgrims Room & Access Code Table -->
      <div class="card">
        <h3 style="font-size: 1.1rem; margin-bottom: 1rem; color: #FFF;">قائمة المعتمرين المسجلين والغرف والأكواد المسلمة</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>اسم المعتمر</th>
                <th>كود الوصول الخاص</th>
                <th>الغرفة والفندق</th>
                <th>رقم الهاتف</th>
                <th>حالة الإقران</th>
              </tr>
            </thead>
            <tbody>
              ${users.filter(u => u.role === 'pilgrim').map(p => `
                <tr>
                  <td style="font-weight: 700;">${p.name}</td>
                  <td>
                    <span style="font-family: monospace; font-weight: bold; background: rgba(6,78,59,0.5); color: var(--gold-main); padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid var(--border-gold);">
                      ${p.code}
                    </span>
                  </td>
                  <td style="color: #38BDF8;">${p.room || 'غرفة 1402 - سويس أوتيل'}</td>
                  <td dir="ltr" style="text-align: right;">${p.phone}</td>
                  <td><span style="color: var(--text-emerald); font-weight: bold;">مُقترن عبر WhatsApp App</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
