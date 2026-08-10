/* ==========================================================================
   SOUTH STREET (سوث ستريت) - Guide / Murshid Dashboard View
   ========================================================================== */

function renderMurshidView() {
  const users = window.appStore.getUsers().filter(u => u.role === 'pilgrim');

  return `
    <div class="animate-fade-in">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
        <div>
          <h2 class="text-gold" style="font-size: 1.6rem;">لوحة المرشد الديني والمرافقة (GUIDE)</h2>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">إرسال التنبيهات الجماعية المباشرة، متابعة طواف الفوج ورعاية المعتمرين</p>
        </div>
        <button class="btn btn-gold btn-sm" onclick="sendMurshidBroadcastPrompt()">
          📢 بث تنبيه عاجل للفوج
        </button>
      </div>

      <!-- Quick Action Cards Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
        <div class="card card-gold-border text-center">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🕋</div>
          <h3 style="font-size: 1.15rem; color: #FFF; margin-bottom: 0.3rem;">عداد الطواف والسعي الجماعي</h3>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">التحكم بالعداد وتلاوة الأدوية أثناء مرافقة الفوج في المسعى والحرم</p>
          <button class="btn btn-primary" onclick="window.appController.switchTab('rituals')">
            📿 فتح عداد المناسك التفاعلي
          </button>
        </div>

        <div class="card text-center">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📍</div>
          <h3 style="font-size: 1.15rem; color: #FFF; margin-bottom: 0.3rem;">بث موقع التجمع الحالي</h3>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">إرسال إحداثيات ومكان تجمع الحافلة في قنوات التواصل الخاصة</p>
          <button class="btn btn-gold" onclick="window.chatEngine.shareLocation(); window.appController.switchTab('chat');">
            📍 إرسال الموقع للفوج الآن
          </button>
        </div>
      </div>

      <!-- Pilgrims Attendance Checklist -->
      <div class="card">
        <h3 style="font-size: 1.1rem; margin-bottom: 1rem; color: #FFF;">تفقد وجاهزية معتمري الفوج (قائمة التحضير)</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>اسم المعتمر</th>
                <th>رقم الجوال</th>
                <th>الفندق والرقم</th>
                <th>حالة التواجد</th>
                <th>إجراء سريع</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td style="font-weight: 700;">${u.name}</td>
                  <td dir="ltr" style="text-align: right;">${u.phone}</td>
                  <td style="color: #38BDF8;">${u.room || 'سويس أوتيل مكة'}</td>
                  <td><span style="color: var(--text-emerald); font-weight: bold;">جاهز في اللوبي</span></td>
                  <td>
                    <button class="btn btn-outline btn-sm" onclick="window.appController.switchTab('chat')">💬 مراسلة خاصة</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function sendMurshidBroadcastPrompt() {
  const alertText = prompt('أدخل نص التنبيه العاجل لإرساله إلى محادثة حملة مكة الجماعية:');
  if (alertText && alertText.trim().length > 0) {
    window.chatEngine.setActiveChat('group-makkah');
    window.chatEngine.sendMessage('text', `📢 تنبيه عاجل من المرشد: ${alertText}`);
    window.appController.switchTab('chat');
  }
}
