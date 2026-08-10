/* ==========================================================================
   SOUTH STREET (سوث ستريت) - Pilgrim / Traveller Dashboard View
   ========================================================================== */

function renderPilgrimView() {
  const session = window.appStore.getSession() || {
    name: 'محمد عبد الله الشمري',
    code: 'PILGRIM-101',
    group: 'حملة سوث ستريت الكبرى',
    room: 'غرفة 1402 - سويس أوتيل مكة'
  };

  return `
    <div class="animate-fade-in">
      <!-- Welcome Header Banner -->
      <div class="card card-gold-border" style="background: linear-gradient(135deg, rgba(6,78,59,0.9), rgba(15,23,42,0.95)); margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div>
            <span style="font-size: 0.8rem; background: var(--gold-dark); color: #0F172A; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 4px;">
              عمرة مقبولة وذنب مغفور
            </span>
            <h2 style="font-size: 1.6rem; color: #FFF; margin-top: 0.4rem;">مرحباً بك، ${session.name}</h2>
            <p style="color: var(--text-secondary); font-size: 0.88rem;">كود الوصول المسجل الخاص بك: <strong style="color: var(--gold-main); font-family: monospace;">${session.code}</strong></p>
          </div>
          <button class="btn btn-danger btn-sm" onclick="triggerPilgrimSOS()">
            🚨 زر الاستغاثة والطوارئ (SOS)
          </button>
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="card text-center" style="cursor: pointer;" onclick="window.appController.switchTab('rituals')">
          <div style="font-size: 2.2rem; margin-bottom: 0.3rem;">📿</div>
          <h3 style="font-size: 1.1rem; color: var(--gold-main);">دليل عداد طواف وسعي العمرة</h3>
          <p style="font-size: 0.82rem; color: var(--text-secondary);">تسجيل الأشواط السبعة وقراءة الأدعية المأثورة لكل شوط</p>
        </div>

        <div class="card text-center" style="cursor: pointer;" onclick="window.appController.switchTab('chat')">
          <div style="font-size: 2.2rem; margin-bottom: 0.3rem;">💬</div>
          <h3 style="font-size: 1.1rem; color: var(--text-emerald);">تواصل WhatsApp الخاص مع المرشد</h3>
          <p style="font-size: 0.82rem; color: var(--text-secondary);">تواصل مباشر مع الشيخ المرشد وأفراد الفوج</p>
        </div>
      </div>

      <!-- Itinerary & Ticket Cards Grid -->
      <h3 style="font-size: 1.2rem; color: #FFF; margin-bottom: 1rem;">تفاصيل حجوزات ورحلة سوث ستريت</h3>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
        <!-- Hotel Makkah Card -->
        <div class="card">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="font-size: 1.8rem;">🕋</div>
            <div>
              <h4 style="color: var(--gold-main); font-size: 1.05rem;">إقامة مكة المكرمة</h4>
              <p style="font-size: 0.8rem; color: var(--text-secondary);">سويس أوتيل المقام - مكة المكرمة</p>
            </div>
          </div>
          <div style="font-size: 0.88rem; display: flex; flex-direction: column; gap: 0.4rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-subtle);">
            <div>🏢 رقم الغرفة: <strong style="color: #FFF;">${session.room || '1402 - الدور 14'}</strong></div>
            <div>📍 الموقع: ألمجمع السكني مقابل أبواب الملك عبد العزيز رقم 1</div>
            <div style="color: var(--text-emerald); font-size: 0.8rem; font-weight: bold; margin-top: 0.2rem;">● متاح واي فاي مجاني بالفندق</div>
          </div>
        </div>

        <!-- Hotel Madinah Card -->
        <div class="card">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="font-size: 1.8rem;">🕌</div>
            <div>
              <h4 style="color: #38BDF8; font-size: 1.05rem;">إقامة المدينة المنورة</h4>
              <p style="font-size: 0.8rem; color: var(--text-secondary);">فندق أوبروي المدينة المنورة</p>
            </div>
          </div>
          <div style="font-size: 0.88rem; display: flex; flex-direction: column; gap: 0.4rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-subtle);">
            <div>🏢 رقم الغرفة: <strong style="color: #FFF;">608 - المطل على الروضة</strong></div>
            <div>📍 الموقع: المنطقة المركزية الشمالية</div>
            <div style="color: var(--text-emerald); font-size: 0.8rem; font-weight: bold; margin-top: 0.2rem;">● الانطلاق بعد 4 أيام</div>
          </div>
        </div>

        <!-- Flight Ticket Card -->
        <div class="card">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="font-size: 1.8rem;">✈️</div>
            <div>
              <h4 style="color: #FFF; font-size: 1.05rem;">تذكرة الطيران المؤكدة</h4>
              <p style="font-size: 0.8rem; color: var(--text-secondary);">الخطوط الجوية العربية السعودية</p>
            </div>
          </div>
          <div style="font-size: 0.88rem; display: flex; flex-direction: column; gap: 0.4rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-subtle);">
            <div>رقم الرحلة: <strong style="color: var(--gold-main); font-family: monospace;">SV-382</strong></div>
            <div>مسار الرحلة: <strong style="color: #FFF;">الرياض ➔ مطار الملك عبد العزيز بجدة</strong></div>
            <div>رقم المقعد: <strong style="color: #38BDF8;">18B - الدرجة السياحية الفاخرة</strong></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function triggerPilgrimSOS() {
  const confirmSOS = confirm('هل تريد إرسال نداء استغاثة SOS عاجل بموقعك الحالي إلى المرشد والمدير العام؟');
  if (confirmSOS) {
    const session = window.appStore.getSession() || { name: 'المعتمر' };
    window.chatEngine.setActiveChat('group-makkah');
    window.chatEngine.sendMessage('location', `🚨 نداء طوارئ واستغاثة عاجل من المعتمر (${session.name})! يرجى تقديم المساعدة فوراً.`, {
      name: 'موقع الاستغاثة - الحرم المكي',
      coords: '21.4192, 39.8258'
    });
    window.appController.switchTab('chat');
    alert('تم إرسال نداء الاستغاثة بنجاح إلى الشيخ المرشد وإدارة وكالة سوث ستريت!');
  }
}
