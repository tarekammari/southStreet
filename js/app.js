/* ==========================================================================
   SOUTH STREET (سوث ستريت) - Main App Controller & PWA Lifecycle Router
   ========================================================================== */

class AppController {
  constructor() {
    this.activeTab = 'home';
    this.deferredPrompt = null;
  }

  init() {
    console.log('[AppController] Initializing South Street PWA');
    this.registerServiceWorker();
    this.initPwaInstallPrompt();
    this.bindNavigation();
    this.renderCurrentView();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('[Service Worker] Registered successfully', reg.scope))
          .catch(err => console.log('[Service Worker] Registration failed:', err));
      });
    }
  }

  initPwaInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.style.display = 'flex';
    });
  }

  triggerPwaInstall() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted PWA installation');
        }
        this.deferredPrompt = null;
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.style.display = 'none';
      });
    } else {
      alert('لتثبيت تطبيق سوث ستريت على أندرويد:\n1. انقر على قائمة المتصفح (⋮)\n2. اختر "الإضافة إلى الشاشة الرئيسية" أو "تثبيت التطبيق"');
    }
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    // Update bottom nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-tab') === tabName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    this.renderCurrentView();
  }

  renderCurrentView() {
    const session = window.appStore.getSession();

    // Render User Header Profile
    this.renderHeaderProfile(session);

    const mainContainer = document.getElementById('main-view-container');
    if (!mainContainer) return;

    if (this.activeTab === 'chat') {
      mainContainer.innerHTML = this.renderChatModule();
      window.chatEngine.initChatUI();
    } else if (this.activeTab === 'rituals') {
      mainContainer.innerHTML = this.renderRitualsModule();
      window.umrahEngine.updateUI();
    } else {
      // Home / Dashboard tab
      if (!session) {
        mainContainer.innerHTML = renderLoginView();
      } else {
        switch (session.role) {
          case 'admin':
            mainContainer.innerHTML = renderAdminView();
            break;
          case 'manager':
            mainContainer.innerHTML = renderManagerView();
            break;
          case 'murshid':
            mainContainer.innerHTML = renderMurshidView();
            break;
          case 'accountant':
            mainContainer.innerHTML = renderAccountantView();
            break;
          case 'pilgrim':
          default:
            mainContainer.innerHTML = renderPilgrimView();
            break;
        }
      }
    }
  }

  renderHeaderProfile(session) {
    const profileContainer = document.getElementById('user-header-profile');
    if (!profileContainer) return;

    if (!session) {
      profileContainer.innerHTML = `
        <span style="font-size: 0.82rem; color: var(--gold-main); font-weight: bold;">بروتوكول الأمان غير مقترن</span>
      `;
    } else {
      profileContainer.innerHTML = `
        <div class="user-profile-badge" onclick="window.appController.showRoleDemoSelector()">
          <div class="user-avatar">${session.avatar || 'س'}</div>
          <div style="display: flex; flex-direction: column; text-align: right;">
            <span style="font-size: 0.85rem; font-weight: 700; color: #FFF;">${session.name}</span>
            <span class="role-tag ${session.role}">${session.roleName || session.role}</span>
          </div>
        </div>
        <button class="btn btn-outline btn-sm" style="margin-right: 0.5rem;" onclick="window.appController.logout()" title="تسجيل خروج">🚪</button>
      `;
    }
  }

  showRoleDemoSelector() {
    const modalContainer = document.getElementById('global-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-overlay active" id="role-selector-modal">
        <div class="modal-box text-right">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
            <h3 style="font-size: 1.2rem; color: var(--gold-main);">تبديل وتجربة الأدوار الخمسة اللحظية</h3>
            <button class="btn btn-outline btn-sm" onclick="closeModal('role-selector-modal')">✖</button>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">اختر دور المستخدم الذي تود الانتقال إليه لتجربة الواجهة والخصائص الخاصة به:</p>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <button class="btn btn-outline" style="justify-content: flex-start;" onclick="quickFillCode('ADMIN-2026', 'د. عبد الرحمن العتيبي'); closeModal('role-selector-modal');">👑 مدير النظام (ADMIN)</button>
            <button class="btn btn-outline" style="justify-content: flex-start;" onclick="quickFillCode('MANAGER-99', 'الأستاذ طارق السعيد'); closeModal('role-selector-modal');">💼 مسير الحملات (MANAGER)</button>
            <button class="btn btn-outline" style="justify-content: flex-start;" onclick="quickFillCode('GUIDE-777', 'الشيخ أحمد بن علي'); closeModal('role-selector-modal');">👳 المرشد الديني (GUIDE)</button>
            <button class="btn btn-outline" style="justify-content: flex-start;" onclick="quickFillCode('ACC-404', 'الأستاذ ياسين الفاسي'); closeModal('role-selector-modal');">💰 المحاسب المالي (ACCOUNTANT)</button>
            <button class="btn btn-outline" style="justify-content: flex-start;" onclick="quickFillCode('PILGRIM-101', 'محمد عبد الله الشمري'); closeModal('role-selector-modal');">🕋 المسافر / المعتمر (PILGRIM)</button>
          </div>
        </div>
      </div>
    `;
  }

  onLoginSuccess(user) {
    this.switchTab('home');
  }

  logout() {
    window.appStore.clearSession();
    this.switchTab('home');
  }

  renderChatModule() {
    return `
      <div class="animate-fade-in" style="max-width: 1100px; margin: 0 auto;">
        <div style="margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
          <h2 class="text-gold" style="font-size: 1.4rem;">محادثات سوث ستريت الخصوصية المشفرة (WhatsApp Style)</h2>
          <span style="font-size: 0.78rem; background: rgba(0,168,132,0.2); color: #00A884; padding: 0.2rem 0.6rem; border-radius: 4px;">● بروتوكول آمن مباشر</span>
        </div>

        <div class="chat-container">
          <div class="chat-sidebar">
            <div class="chat-sidebar-header">
              <span style="font-weight: 700; color: #FFF; font-size: 0.95rem;">المحادثات والقنوات</span>
              <span style="font-size: 0.75rem; color: var(--gold-main);">وكالة سوث ستريت</span>
            </div>
            <div class="chat-list" id="chat-list-items"></div>
          </div>

          <div class="chat-main">
            <div class="chat-header">
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: #00A884; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #FFF;">🕋</div>
                <div>
                  <div style="font-weight: 700; color: #FFF; font-size: 0.92rem;">حملة سوث ستريت الكبرى (مكة المكرمة)</div>
                  <div style="font-size: 0.72rem; color: #00A884;">متصل الآن • 45 عضو بالجمّع</div>
                </div>
              </div>
              <button class="btn btn-gold btn-sm" onclick="window.chatEngine.shareLocation()">📍 مشاركة موقعي</button>
            </div>

            <div class="chat-quick-presets">
              <span class="preset-chip" onclick="window.chatEngine.sendMessage('text', 'أنا عند باب الملك عبد العزيز')">📍 عند باب الملك عبد العزيز</span>
              <span class="preset-chip" onclick="window.chatEngine.sendMessage('text', 'وصلت للوبي الفندق')">🏨 باللوبي</span>
              <span class="preset-chip" onclick="window.chatEngine.sendMessage('text', 'ضاع مني الفوج ومحتاج توجيه')">⚠️ ضاع مني الفوج</span>
              <span class="preset-chip" onclick="window.chatEngine.sendMessage('text', 'جزاكم الله خيراً يا شيخ')">🤲 تقبل الله</span>
            </div>

            <div class="chat-messages" id="chat-messages-body"></div>

            <div class="chat-input-bar">
              <input type="text" id="chat-input-text" class="input-field" placeholder="اكتب رسالتك الخاصة المشفرة هنا..." style="border-radius: 24px; background: #2A3942;" />
              <button class="btn btn-primary" id="btn-chat-send" style="border-radius: 50%; width: 44px; height: 44px; padding: 0; min-width: 44px;">
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderRitualsModule() {
    return `
      <div class="animate-fade-in" style="max-width: 680px; margin: 0 auto; text-align: center;">
        <h2 class="text-gold" style="font-size: 1.6rem; margin-bottom: 0.2rem;">دليل وعدّاد مناسك العمرة التفاعلي</h2>
        <p style="color: var(--text-secondary); font-size: 0.88rem; margin-bottom: 1.25rem;">مرافقة المعتمر في كل شوط من الطواف والسعي وقراءة الأدوية المأثورة</p>

        <div class="card card-gold-border">
          <div style="display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 1.25rem;">
            <button class="btn btn-primary btn-sm" onclick="window.umrahEngine.setMode('tawaf')">🕋 عداد الطواف (7 أشواط)</button>
            <button class="btn btn-gold btn-sm" onclick="window.umrahEngine.setMode('sai')">🏃 عداد السعي (7 أشواط)</button>
          </div>

          <div class="counter-wheel-container">
            <div class="counter-dial glow-gold" onclick="window.umrahEngine.incrementCounter()">
              <div class="counter-number" id="umrah-counter-number">0</div>
              <div class="counter-label" id="umrah-counter-label">اضغط لتسجيل الشوط</div>
            </div>
            <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.8rem;">اضغط بأصبعك داخل القرص الذهبي بعد كل دورة حول الكعبة أو الصفا والمروة</p>
          </div>

          <div style="background: rgba(15,23,42,0.8); border: 1px solid var(--border-gold); padding: 1.25rem; border-radius: 12px; margin-top: 1rem; text-align: right;">
            <h4 style="color: var(--gold-main); font-size: 0.95rem; margin-bottom: 0.4rem;">📖 دعاء وقراءة الشوط المباشر:</h4>
            <p id="umrah-dua-text" style="font-size: 1.05rem; font-family: 'Amiri', 'Tajawal', serif; line-height: 1.7; color: #FFF;">
              اضغط على قرص العداد بيدك لتسجيل الشوط وسماع دعاء الشوط المباشر.
            </p>
          </div>

          <div style="margin-top: 1rem; display: flex; justify-content: space-between;">
            <button class="btn btn-outline btn-sm" onclick="window.umrahEngine.resetCounter()">🔄 إعادة ضبط العداد</button>
            <button class="btn btn-outline btn-sm" onclick="window.chatEngine.playAudioTone(700, 0.15)">🔊 تسميع صوتي</button>
          </div>
        </div>
      </div>
    `;
  }

  bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });
  }
}

window.appController = new AppController();

document.addEventListener('DOMContentLoaded', () => {
  window.appController.init();
});
