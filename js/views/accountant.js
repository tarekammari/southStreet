/* ==========================================================================
   SOUTH STREET (سوث ستريت) - Accountant Dashboard View
   ========================================================================== */

function renderAccountantView() {
  const receipts = window.appStore.getReceipts();
  const totalRevenue = receipts.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
  const totalPending = receipts.reduce((acc, curr) => acc + (curr.remainingAmount || 0), 0);

  return `
    <div class="animate-fade-in">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
        <div>
          <h2 class="text-gold" style="font-size: 1.6rem;">لوحة المحاسب والمالية (ACCOUNTANT)</h2>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">إدارة السندات الرقمية وسجلات تحصيل الدفعات وباقات العمرة والوكالة</p>
        </div>
        <button class="btn btn-gold btn-sm" onclick="openCreateReceiptModal()">
          🧾 إصدار سند قبض جديد
        </button>
      </div>

      <!-- Financial Metrics Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="card card-gold-border">
          <div style="color: var(--text-secondary); font-size: 0.85rem;">إجمالي المبالغ المحصلة</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-emerald); margin-top: 0.2rem;">
            ${totalRevenue.toLocaleString()} ر.س
          </div>
          <div style="font-size: 0.75rem; color: var(--text-emerald); margin-top: 0.2rem;">محدثة فورياً من السندات</div>
        </div>
        <div class="card">
          <div style="color: var(--text-secondary); font-size: 0.85rem;">المبالغ المتبقية (قيد التحصيل)</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: var(--warning); margin-top: 0.2rem;">
            ${totalPending.toLocaleString()} ر.س
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">تنبيهات للمعتمرين بالدفع</div>
        </div>
        <div class="card">
          <div style="color: var(--text-secondary); font-size: 0.85rem;">إجمالي السندات الرقمية</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; margin-top: 0.2rem;">
            ${receipts.length} سند قبض
          </div>
          <div style="font-size: 0.75rem; color: var(--gold-main); margin-top: 0.2rem;">معتمدة ومختومة برمجياً</div>
        </div>
      </div>

      <!-- Financial Receipts Table -->
      <div class="card">
        <h3 style="font-size: 1.1rem; margin-bottom: 1rem; color: #FFF;">سجل سندات القبض والدفعات الرقمية</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>رقم السند</th>
                <th>اسم المعتمر</th>
                <th>الباقة والخدمة</th>
                <th>المبلغ الإجمالي</th>
                <th>المسدد</th>
                <th>المتبقي</th>
                <th>تاريخ السند</th>
                <th>معاينة</th>
              </tr>
            </thead>
            <tbody>
              ${receipts.map(r => `
                <tr>
                  <td style="font-family: monospace; font-weight: bold; color: var(--gold-main);">${r.id}</td>
                  <td style="font-weight: 700;">${r.pilgrimName}</td>
                  <td style="color: var(--text-secondary);">${r.packageName}</td>
                  <td style="font-weight: bold; color: #FFF;">${r.totalAmount.toLocaleString()} ر.س</td>
                  <td style="color: var(--text-emerald); font-weight: bold;">${r.paidAmount.toLocaleString()} ر.س</td>
                  <td style="color: var(--warning); font-weight: bold;">${r.remainingAmount.toLocaleString()} ر.س</td>
                  <td style="font-size: 0.8rem; color: var(--text-muted);">${r.date}</td>
                  <td>
                    <button class="btn btn-outline btn-sm" onclick="viewReceiptPaper('${r.id}')">🖨️ طباعة</button>
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

function openCreateReceiptModal() {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-overlay active" id="create-receipt-modal">
      <div class="modal-box text-right">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
          <h3 style="font-size: 1.2rem; color: var(--gold-main);">إصدار سند قبض رقمي معتمد</h3>
          <button class="btn btn-outline btn-sm" onclick="closeModal('create-receipt-modal')">✖</button>
        </div>

        <form onsubmit="handleCreateReceiptSubmit(event)">
          <div class="form-group">
            <label class="form-label">اسم المعتمر المستلم منه</label>
            <input type="text" id="rec-pilgrim-name" class="input-field" placeholder="مثال: محمد عبد الله الشمري" required />
          </div>

          <div class="form-group">
            <label class="form-label">اسم باقة العمرة / الخدمة</label>
            <input type="text" id="rec-package-name" class="input-field" value="باقة العمرة الفاخرة - 10 أيام (مكة والمدينة)" required />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div class="form-group">
              <label class="form-label">المبلغ الإجمالي (ر.س)</label>
              <input type="number" id="rec-total-amount" class="input-field" value="12500" required />
            </div>
            <div class="form-group">
              <label class="form-label">المبلغ المسدد الآن (ر.س)</label>
              <input type="number" id="rec-paid-amount" class="input-field" value="12500" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">طريقة الدفع وسيلة السداد</label>
            <select id="rec-payment-method" class="input-field">
              <option value="بطاقة مدى / Visa">بطاقة مدى / Visa</option>
              <option value="تحويل بنكي سديد">تحويل بنكي سديد</option>
              <option value="نقد شباك الوكالة">نقداً في شباك الوكالة</option>
            </select>
          </div>

          <button type="submit" class="btn btn-gold" style="width: 100%; margin-top: 1rem;">
            🧾 اعتماد وطباعة السند الرقمي
          </button>
        </form>
      </div>
    </div>
  `;
}

function handleCreateReceiptSubmit(e) {
  e.preventDefault();
  const pilgrimName = document.getElementById('rec-pilgrim-name').value.trim();
  const packageName = document.getElementById('rec-package-name').value.trim();
  const totalAmount = parseFloat(document.getElementById('rec-total-amount').value) || 0;
  const paidAmount = parseFloat(document.getElementById('rec-paid-amount').value) || 0;
  const paymentMethod = document.getElementById('rec-payment-method').value;

  const session = window.appStore.getSession() || { name: 'ياسين الفاسي' };

  const newReceipt = {
    id: `REC-${Math.floor(1000 + Math.random() * 9000)}`,
    pilgrimName,
    pilgrimCode: 'PILGRIM-CUSTOM',
    packageName,
    totalAmount,
    paidAmount,
    remainingAmount: Math.max(0, totalAmount - paidAmount),
    paymentMethod,
    date: new Date().toISOString().split('T')[0],
    accountantName: session.name,
    status: (totalAmount - paidAmount <= 0) ? 'خالص الدفع' : 'عربون متبقي'
  };

  window.appStore.saveReceipt(newReceipt);
  closeModal('create-receipt-modal');
  viewReceiptPaper(newReceipt.id);
}

function viewReceiptPaper(receiptId) {
  const receipts = window.appStore.getReceipts();
  const r = receipts.find(item => item.id === receiptId);
  if (!r) return;

  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-overlay active" id="view-receipt-modal">
      <div class="modal-box text-right" style="max-width: 580px; padding: 0; background: transparent; border: none;">
        <div class="receipt-paper">
          <div class="receipt-header">
            <div style="font-size: 1.8rem; font-weight: 800; color: #064E3B; margin-bottom: 0.2rem;">وكالة سوث ستريت للسياحة والعمرة</div>
            <div style="font-size: 0.85rem; color: #64748B;">SOUTH STREET Travel Agency - Makkah & Madinah</div>
            <div style="font-size: 0.95rem; font-weight: bold; color: #D4AF37; margin-top: 0.5rem;">سند قبض مالــي معتمد (رقم: ${r.id})</div>
          </div>

          <div style="margin-bottom: 1rem;">
            <div class="receipt-row"><span>استلمنا من السيد/ة:</span> <strong>${r.pilgrimName}</strong></div>
            <div class="receipt-row"><span>مقابل خدمة:</span> <strong>${r.packageName}</strong></div>
            <div class="receipt-row"><span>وسيلة السداد:</span> <strong>${r.paymentMethod}</strong></div>
            <div class="receipt-row"><span>تاريخ الإصدار:</span> <strong>${r.date}</strong></div>
            <div class="receipt-row"><span>المحاسب المسؤول:</span> <strong>${r.accountantName}</strong></div>
          </div>

          <div style="background: #F8FAFC; padding: 0.85rem; border-radius: 8px; border: 1px solid #E2E8F0; margin-bottom: 1rem;">
            <div class="receipt-row"><span>المبلغ الإجمالي:</span> <strong>${r.totalAmount.toLocaleString()} ر.س</strong></div>
            <div class="receipt-row" style="color: #059669;"><span>المبلغ المسدد:</span> <strong>${r.paidAmount.toLocaleString()} ر.س</strong></div>
            <div class="receipt-row" style="color: #D97706;"><span>المتبقي:</span> <strong>${r.remainingAmount.toLocaleString()} ر.س</strong></div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; color: #64748B; border-top: 1px dashed #CBD5E1; padding-top: 0.75rem;">
            <span>ختم الاعتماد البرمجي 🔒</span>
            <span style="font-family: monospace; font-weight: bold;">VERIFIED-AES-${r.id}</span>
          </div>

          <div style="display: flex; gap: 0.5rem; margin-top: 1.25rem;">
            <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="window.print()">🖨️ طباعة السند</button>
            <button class="btn btn-outline btn-sm" onclick="closeModal('view-receipt-modal')">إغلاق</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
