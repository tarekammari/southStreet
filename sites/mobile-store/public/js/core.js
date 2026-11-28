// Shared client code for the store dashboard and the admin dashboard (no framework, no build step).
'use strict';
(() => {
  // ---------- i18n: [key, ar, fr, en] ----------
  const D = [
    ['dashboard', 'الرئيسية', 'Accueil', 'Dashboard'], ['pos', 'بيع', 'Vendre', 'Sell'], ['products', 'المنتجات', 'Produits', 'Products'],
    ['sales', 'المبيعات', 'Ventes', 'Sales'], ['customers', 'الزبائن', 'Clients', 'Customers'], ['orders', 'الطلبات', 'Commandes', 'Orders'],
    ['stock', 'حركة المخزون', 'Mouvements', 'Stock moves'], ['onHand', 'المخزون', 'Stock', 'Stock'], ['suppliers', 'الموردون', 'Fournisseurs', 'Suppliers'], ['expenses', 'المصاريف', 'Dépenses', 'Expenses'],
    ['reports', 'التقارير', 'Rapports', 'Reports'], ['staff', 'الفريق', 'Équipe', 'Team'], ['settings', 'الإعدادات', 'Paramètres', 'Settings'],
    ['devices', 'الأجهزة والدخول', 'Appareils', 'Devices'], ['more', 'المزيد', 'Plus', 'More'], ['logout', 'تسجيل الخروج', 'Déconnexion', 'Sign out'],
    ['admin', 'لوحة المدير', 'Administration', 'Admin'], ['myStore', 'متجري على الإنترنت', 'Ma boutique en ligne', 'My online store'],
    ['today', 'اليوم', 'Aujourd’hui', 'Today'], ['last30', 'آخر 30 يومًا', '30 derniers jours', 'Last 30 days'], ['last7', 'آخر 7 أيام', '7 derniers jours', 'Last 7 days'],
    ['all', 'الكل', 'Tout', 'All'], ['profit', 'الربح', 'Bénéfice', 'Profit'], ['salesCount', 'عدد المبيعات', 'Nb ventes', 'Sales count'],
    ['stockItems', 'قطع في المخزون', 'Articles en stock', 'Items in stock'], ['stockValue', 'قيمة المخزون', 'Valeur du stock', 'Stock value'],
    ['debts', 'ديون الزبائن', 'Crédits clients', 'Customer debts'], ['newOrders', 'طلبات جديدة', 'Nouvelles commandes', 'New orders'],
    ['lowStock', 'مخزون منخفض', 'Stock bas', 'Low stock'], ['topProducts', 'الأكثر مبيعًا', 'Meilleures ventes', 'Top products'],
    ['recentSales', 'آخر المبيعات', 'Dernières ventes', 'Recent sales'], ['newSale', 'بيع جديد', 'Nouvelle vente', 'New sale'],
    ['addProduct', 'إضافة منتج', 'Ajouter un produit', 'Add product'], ['receive', 'إدخال مخزون', 'Entrée de stock', 'Receive stock'],
    ['scanPc', 'الدخول على الحاسوب بـ QR', 'Connecter un PC par QR', 'Sign in a PC by QR'], ['search', 'بحث…', 'Rechercher…', 'Search…'],
    ['scan', 'مسح', 'Scanner', 'Scan'], ['save', 'حفظ', 'Enregistrer', 'Save'], ['cancel', 'إلغاء', 'Annuler', 'Cancel'], ['delete', 'حذف', 'Supprimer', 'Delete'],
    ['edit', 'تعديل', 'Modifier', 'Edit'], ['close', 'إغلاق', 'Fermer', 'Close'], ['add', 'إضافة', 'Ajouter', 'Add'], ['back', 'رجوع', 'Retour', 'Back'],
    ['confirm', 'تأكيد', 'Confirmer', 'Confirm'], ['yes', 'نعم', 'Oui', 'Yes'], ['no', 'لا', 'Non', 'No'], ['saved', 'تم الحفظ', 'Enregistré', 'Saved'],
    ['kind', 'النوع', 'Type', 'Type'], ['phone', 'هاتف', 'Téléphone', 'Phone'], ['tablet', 'لوحة', 'Tablette', 'Tablet'], ['accessory', 'إكسسوار', 'Accessoire', 'Accessory'],
    ['part', 'قطعة غيار', 'Pièce', 'Part'], ['other', 'أخرى', 'Autre', 'Other'], ['brand', 'الماركة', 'Marque', 'Brand'], ['model', 'الموديل', 'Modèle', 'Model'],
    ['title', 'الاسم', 'Nom', 'Name'], ['storage', 'الذاكرة', 'Stockage', 'Storage'], ['ram', 'الرام', 'RAM', 'RAM'], ['color', 'اللون', 'Couleur', 'Color'],
    ['condition', 'الحالة', 'État', 'Condition'], ['new', 'جديد', 'Neuf', 'New'], ['used', 'مستعمل', 'Occasion', 'Used'], ['refurbished', 'مجدد', 'Reconditionné', 'Refurbished'],
    ['battery', 'صحة البطارية %', 'Batterie %', 'Battery %'], ['warranty', 'الضمان', 'Garantie', 'Warranty'], ['sku', 'باركود / SKU', 'Code-barres / SKU', 'Barcode / SKU'],
    ['cost', 'سعر الشراء', 'Prix d’achat', 'Cost'], ['price', 'سعر البيع', 'Prix de vente', 'Price'], ['oldPrice', 'السعر قبل التخفيض', 'Ancien prix', 'Old price'],
    ['description', 'الوصف', 'Description', 'Description'], ['images', 'الصور', 'Photos', 'Photos'], ['addPhotos', 'إضافة صور', 'Ajouter des photos', 'Add photos'],
    ['published', 'ظاهر في المتجر', 'Visible en ligne', 'Visible online'], ['featured', 'منتج مميز', 'En vedette', 'Featured'],
    ['trackImei', 'تتبع بالـ IMEI (لكل قطعة رقم)', 'Suivi par IMEI (un numéro par pièce)', 'Track by IMEI (one number per item)'],
    ['imeis', 'أرقام IMEI (واحد في كل سطر)', 'Numéros IMEI (un par ligne)', 'IMEI numbers (one per line)'], ['qty', 'الكمية', 'Quantité', 'Quantity'],
    ['openingStock', 'المخزون الأولي', 'Stock initial', 'Opening stock'], ['supplier', 'المورد', 'Fournisseur', 'Supplier'], ['none', '—', '—', '—'],
    ['inStock', 'في المخزون', 'En stock', 'In stock'], ['sold', 'مباع', 'Vendu', 'Sold'], ['defective', 'معطل', 'Défectueux', 'Defective'], ['reserved', 'محجوز', 'Réservé', 'Reserved'],
    ['out', 'نفد', 'Épuisé', 'Out'], ['units', 'القطع (IMEI)', 'Unités (IMEI)', 'Units (IMEI)'], ['history', 'السجل', 'Historique', 'History'],
    ['archive', 'أرشفة', 'Archiver', 'Archive'], ['restore', 'استرجاع', 'Restaurer', 'Restore'], ['archived', 'المؤرشفة', 'Archivés', 'Archived'],
    ['adjust', 'تعديل الكمية', 'Ajuster la quantité', 'Adjust quantity'], ['delta', 'الفرق (+ أو -)', 'Écart (+ ou -)', 'Change (+ or -)'], ['note', 'ملاحظة', 'Note', 'Note'],
    ['cart', 'السلة', 'Panier', 'Cart'], ['cartEmpty', 'السلة فارغة — ابحث أو امسح منتجًا', 'Panier vide — cherchez ou scannez', 'Cart empty — search or scan'],
    ['discount', 'تخفيض', 'Remise', 'Discount'], ['total', 'المجموع', 'Total', 'Total'], ['subtotal', 'المجموع الفرعي', 'Sous-total', 'Subtotal'],
    ['paid', 'المدفوع', 'Payé', 'Paid'], ['rest', 'الباقي (دين)', 'Reste (crédit)', 'Remaining (credit)'], ['method', 'طريقة الدفع', 'Paiement', 'Payment'],
    ['cash', 'نقدًا', 'Espèces', 'Cash'], ['card', 'بطاقة', 'Carte', 'Card'], ['transfer', 'تحويل', 'Virement', 'Transfer'], ['ccp', 'CCP', 'CCP', 'CCP'],
    ['baridimob', 'بريدي موب', 'BaridiMob', 'BaridiMob'], ['credit', 'بالدين', 'À crédit', 'On credit'], ['customer', 'الزبون', 'Client', 'Customer'],
    ['customerName', 'اسم الزبون', 'Nom du client', 'Customer name'], ['phoneNum', 'الهاتف', 'Téléphone', 'Phone'], ['complete', 'إتمام البيع', 'Valider la vente', 'Complete sale'],
    ['chooseImei', 'اختر القطعة (IMEI)', 'Choisir l’unité (IMEI)', 'Choose the unit (IMEI)'], ['receipt', 'الفاتورة', 'Ticket', 'Receipt'], ['print', 'طباعة', 'Imprimer', 'Print'],
    ['refund', 'استرجاع البيع', 'Rembourser', 'Refund'], ['refunded', 'مسترجع', 'Remboursé', 'Refunded'], ['done', 'مكتمل', 'Terminé', 'Done'],
    ['seller', 'بائع', 'Vendeur', 'Seller'], ['manager', 'مدير', 'Gérant', 'Manager'], ['owner', 'المالك', 'Propriétaire', 'Owner'], ['role', 'الدور', 'Rôle', 'Role'],
    ['date', 'التاريخ', 'Date', 'Date'], ['items', 'المنتجات', 'Articles', 'Items'], ['status', 'الحالة', 'Statut', 'Status'], ['number', 'رقم', 'N°', 'No.'],
    ['debt', 'الدين', 'Crédit', 'Debt'], ['spent', 'مجموع المشتريات', 'Total achats', 'Total spent'], ['payment', 'تسجيل دفعة', 'Enregistrer un paiement', 'Record payment'],
    ['amount', 'المبلغ', 'Montant', 'Amount'], ['payments', 'الدفعات', 'Paiements', 'Payments'], ['addCustomer', 'زبون جديد', 'Nouveau client', 'New customer'],
    ['name', 'الاسم', 'Nom', 'Name'], ['city', 'المدينة', 'Ville', 'City'], ['confirmed', 'مؤكد', 'Confirmé', 'Confirmed'], ['cancelled', 'ملغى', 'Annulé', 'Cancelled'],
    ['newS', 'جديد', 'Nouveau', 'New'], ['call', 'اتصال', 'Appeler', 'Call'], ['sellIt', 'بيع', 'Vendre', 'Sell'], ['label', 'البيان', 'Libellé', 'Label'],
    ['addSupplier', 'مورد جديد', 'Nouveau fournisseur', 'New supplier'], ['addExpense', 'مصروف جديد', 'Nouvelle dépense', 'New expense'], ['bought', 'مشتريات', 'Achats', 'Purchases'],
    ['in', 'دخول', 'Entrée', 'In'], ['sale', 'بيع', 'Vente', 'Sale'], ['return', 'استرجاع', 'Retour', 'Return'], ['statusMove', 'تغيير حالة', 'Statut', 'Status'],
    ['from', 'من', 'Du', 'From'], ['to', 'إلى', 'Au', 'To'], ['net', 'الصافي بعد المصاريف', 'Net après dépenses', 'Net after expenses'],
    ['byMethod', 'حسب طريقة الدفع', 'Par paiement', 'By payment'], ['bySeller', 'حسب البائع', 'Par vendeur', 'By seller'], ['byBrand', 'حسب الماركة', 'Par marque', 'By brand'],
    ['export', 'تصدير CSV', 'Export CSV', 'Export CSV'], ['invite', 'دعوة عضو بحساب Gmail', 'Inviter avec un Gmail', 'Invite by Gmail'], ['email', 'البريد', 'E-mail', 'Email'],
    ['pending', 'لم يسجل بعد', 'En attente', 'Pending'], ['lastLogin', 'آخر دخول', 'Dernière connexion', 'Last sign-in'],
    ['storeInfo', 'معلومات المتجر', 'Infos boutique', 'Store info'], ['storeName', 'اسم المتجر', 'Nom de la boutique', 'Store name'],
    ['subdomain', 'رابط المتجر (النطاق الفرعي)', 'Adresse (sous-domaine)', 'Store address (subdomain)'], ['tagline', 'شعار قصير', 'Slogan', 'Tagline'],
    ['about', 'من نحن', 'À propos', 'About'], ['address', 'العنوان', 'Adresse', 'Address'], ['whatsapp', 'واتساب', 'WhatsApp', 'WhatsApp'],
    ['theme', 'قالب المتجر', 'Thème', 'Theme'], ['accent', 'اللون الرئيسي', 'Couleur principale', 'Accent color'], ['logo', 'الشعار', 'Logo', 'Logo'], ['cover', 'صورة الغلاف', 'Couverture', 'Cover'],
    ['currency', 'العملة', 'Devise', 'Currency'], ['language', 'اللغة', 'Langue', 'Language'], ['lowStockAt', 'تنبيه المخزون عند', 'Alerte stock à', 'Low stock alert at'],
    ['onlineOrders', 'استقبال الطلبات من المتجر', 'Commandes en ligne', 'Online orders'], ['showPrices', 'إظهار الأسعار', 'Afficher les prix', 'Show prices'],
    ['receiptNote', 'ملاحظة أسفل الفاتورة', 'Note en bas du ticket', 'Receipt footer'], ['social', 'روابط التواصل', 'Réseaux sociaux', 'Social links'],
    ['plan', 'الاشتراك', 'Abonnement', 'Plan'], ['expires', 'ينتهي', 'Expire', 'Expires'], ['storageUsed', 'المساحة المستعملة', 'Espace utilisé', 'Storage used'],
    ['createStore', 'أنشئ متجرك', 'Créez votre boutique', 'Create your store'], ['createBtn', 'إنشاء المتجر', 'Créer la boutique', 'Create store'],
    ['slugFree', 'متاح', 'Disponible', 'Available'], ['slugTaken', 'غير متاح', 'Indisponible', 'Not available'], ['sessions', 'الأجهزة المتصلة', 'Appareils connectés', 'Signed-in devices'],
    ['thisDevice', 'هذا الجهاز', 'Cet appareil', 'This device'], ['revoke', 'إخراج', 'Déconnecter', 'Sign out'], ['scanHelp', 'وجّه الكاميرا نحو رمز QR على شاشة الحاسوب', 'Visez le QR affiché sur le PC', 'Point the camera at the QR on the PC screen'],
    ['noCamera', 'المسح بالكاميرا غير مدعوم هنا — استعمل تطبيق الكاميرا في هاتفك أو اكتب الرمز.', 'Scan non supporté ici — utilisez l’appareil photo du téléphone ou tapez le code.', 'Camera scan not supported here — use your phone camera app or type the code.'],
    ['typeCode', 'أو اكتب الرقم', 'ou tapez le numéro', 'or type the number'], ['storeQr', 'رمز QR لمتجرك (للطباعة)', 'QR de votre boutique (à imprimer)', 'Your store QR (to print)'],
    ['empty', 'لا توجد بيانات بعد', 'Aucune donnée', 'Nothing yet'], ['loading', 'جارٍ التحميل…', 'Chargement…', 'Loading…'], ['optional', 'اختياري', 'optionnel', 'optional'],
    ['uploading', 'جارٍ رفع الصور…', 'Envoi des photos…', 'Uploading photos…'], ['areYouSure', 'هل أنت متأكد؟', 'Êtes-vous sûr ?', 'Are you sure?'],
    ['copied', 'تم النسخ', 'Copié', 'Copied'], ['copy', 'نسخ الرابط', 'Copier le lien', 'Copy link'], ['open', 'فتح', 'Ouvrir', 'Open'], ['walkIn', 'زبون عابر', 'Client de passage', 'Walk-in'],
    ['available', 'متوفر', 'Disponible', 'Available'], ['audit', 'سجل النشاط', 'Journal', 'Activity log'], ['action', 'العملية', 'Action', 'Action'],
    ['overview', 'نظرة عامة', 'Vue d’ensemble', 'Overview'], ['stores', 'المتاجر', 'Boutiques', 'Stores'], ['users', 'المستخدمون', 'Utilisateurs', 'Users'],
    ['active', 'نشط', 'Actif', 'Active'], ['suspended', 'موقوف', 'Suspendu', 'Suspended'], ['suspend', 'إيقاف', 'Suspendre', 'Suspend'], ['activate', 'تفعيل', 'Activer', 'Activate'],
    ['extend', 'تمديد (أيام)', 'Prolonger (jours)', 'Extend (days)'], ['volume', 'حجم المبيعات', 'Volume des ventes', 'Sales volume'], ['signups', 'متاجر جديدة', 'Nouvelles boutiques', 'New stores'],
    ['members', 'الأعضاء', 'Membres', 'Members'], ['disable', 'إيقاف الحساب', 'Désactiver', 'Disable'], ['enable', 'تفعيل الحساب', 'Activer', 'Enable'],
    ['announcement', 'إعلان لكل المتاجر', 'Annonce pour toutes les boutiques', 'Announcement to all stores'], ['signupsOpen', 'التسجيل مفتوح', 'Inscriptions ouvertes', 'Sign-ups open'],
    ['pricingText', 'نص الأسعار في الصفحة الرئيسية', 'Texte des tarifs (accueil)', 'Pricing text (home page)'], ['expiring', 'اشتراكات تنتهي قريبًا', 'Abonnements bientôt expirés', 'Plans expiring soon'],
    ['units2', 'قطع', 'unités', 'units'], ['remove', 'إزالة', 'Retirer', 'Remove'], ['receiveDone', 'تمت إضافة', 'Ajouté', 'Added'], ['imeiWarn', 'تحقق من هذه الأرقام (IMEI غير صالح):', 'Vérifiez ces IMEI (invalides) :', 'Check these IMEIs (invalid):'],
    ['pickCustomer', 'ابحث عن زبون بالاسم أو الهاتف', 'Chercher un client', 'Find a customer'], ['newCustomerHint', 'أو أدخل زبونًا جديدًا', 'ou saisissez un nouveau client', 'or enter a new customer'],
    ['change', 'الباقي للزبون', 'Monnaie à rendre', 'Change'], ['received', 'المبلغ المستلم', 'Montant reçu', 'Amount received'], ['thanks', 'شكرًا لزيارتكم', 'Merci de votre visite', 'Thank you'],
    ['trialEnds', 'الفترة التجريبية تنتهي', 'L’essai se termine le', 'Trial ends'], ['seeStore', 'شاهد متجرك', 'Voir la boutique', 'View store'],
    ['shareStore', 'شارك رابط متجرك مع زبائنك', 'Partagez le lien de votre boutique', 'Share your store link'], ['quick', 'إجراءات سريعة', 'Actions rapides', 'Quick actions'],
  ];
  const ERR = {
    auth: ['يجب تسجيل الدخول', 'Connexion requise', 'Please sign in'], forbidden: ['ليست لديك صلاحية', 'Accès refusé', 'Not allowed'],
    store_suspended: ['المتجر موقوف — تواصل مع الإدارة', 'Boutique suspendue — contactez l’administration', 'Store suspended — contact support'],
    plan_product_limit: ['وصلت لحد المنتجات في اشتراكك', 'Limite de produits atteinte', 'Product limit of your plan reached'],
    plan_member_limit: ['وصلت لحد الأعضاء في اشتراكك', 'Limite de membres atteinte', 'Member limit of your plan reached'],
    imei_exists: ['هذا الـ IMEI موجود في المخزون', 'IMEI déjà en stock', 'IMEI already in stock'], imei_required: ['أدخل رقم IMEI واحدًا على الأقل', 'Saisissez au moins un IMEI', 'Enter at least one IMEI'],
    bad_imei: ['رقم IMEI غير صالح', 'IMEI invalide', 'Invalid IMEI'], unit_not_available: ['هذه القطعة غير متوفرة', 'Unité indisponible', 'Unit not available'],
    not_enough_stock: ['الكمية غير كافية', 'Stock insuffisant', 'Not enough stock'], cart_empty: ['السلة فارغة', 'Panier vide', 'Cart is empty'],
    customer_required_for_debt: ['البيع بالدين يحتاج اسم الزبون', 'Le crédit nécessite un client', 'Credit needs a customer'], slug_taken: ['هذا الرابط مستعمل', 'Adresse déjà prise', 'Address taken'],
    bad_slug: ['الرابط: حروف إنجليزية وأرقام وشرطة فقط (3-30)', 'Adresse : lettres, chiffres, tirets (3-30)', 'Address: letters, digits, dashes (3-30)'],
    store_limit: ['وصلت للحد الأقصى من المتاجر', 'Nombre max. de boutiques atteint', 'Store limit reached'], image_too_large: ['الصورة كبيرة جدًا', 'Image trop lourde', 'Image too large'],
    image_type: ['نوع الصورة غير مدعوم', 'Format non supporté', 'Unsupported image'], storage_full: ['المساحة ممتلئة', 'Espace plein', 'Storage full'],
    product_has_sales: ['المنتج له مبيعات، قم بأرشفته بدل الحذف', 'Produit vendu : archivez-le', 'Has sales — archive it instead'],
    already_member: ['العضو موجود', 'Déjà membre', 'Already a member'], bad_email: ['بريد غير صالح', 'E-mail invalide', 'Invalid email'], rate_limited: ['محاولات كثيرة، انتظر قليلاً', 'Trop de tentatives', 'Too many attempts'],
    title_required: ['أدخل اسم المنتج أو الماركة والموديل', 'Saisissez un nom ou marque + modèle', 'Enter a name or brand + model'], name_required: ['الاسم مطلوب', 'Nom requis', 'Name required'],
    qr_expired: ['رمز QR غير صالح أو منتهي', 'QR invalide ou expiré', 'Invalid or expired QR'],
    network: ['تعذر الاتصال بالخادم', 'Connexion impossible', 'Network error'], duplicate: ['موجود مسبقًا', 'Existe déjà', 'Already exists'],
  };
  const LANGS = ['ar', 'fr', 'en'];
  let lang = (() => { try { return localStorage.getItem('ms_lang'); } catch { return null; } })() || document.getElementById('root')?.dataset.lang || 'ar';
  if (!LANGS.includes(lang)) lang = 'ar';
  const dict = Object.fromEntries(D.map(([k, ...v]) => [k, v]));
  const t = (k) => (dict[k] ? dict[k][LANGS.indexOf(lang)] : k);
  const errText = (code, detail) => (ERR[code] ? ERR[code][LANGS.indexOf(lang)] : code) + (detail ? ` (${detail})` : '');
  function setLang(l) {
    lang = l;
    try { localStorage.setItem('ms_lang', l); } catch { /* private mode */ }
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  }
  setLang(lang);

  // ---------- DOM ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v; // only for trusted SVG from our server
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
    return el;
  }
  const $ = (s, r = document) => r.querySelector(s);
  // replaceChildren that accepts nested arrays and skips null/false.
  const fill = (el, ...kids) => { el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false).map((k) => (k instanceof Node ? k : String(k)))); return el; };

  // ---------- API ----------
  async function api(method, url, body, raw) {
    let r;
    try {
      r = await fetch(url, {
        method, credentials: 'same-origin',
        headers: { 'x-ms': '1', ...(body && !raw ? { 'content-type': 'application/json' } : {}), ...(raw ? { 'content-type': raw } : {}) },
        body: body ? (raw ? body : JSON.stringify(body)) : undefined,
      });
    } catch { throw Object.assign(new Error('network'), { code: 'network' }); }
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.hash); throw new Error('auth'); }
    if (!r.ok) throw Object.assign(new Error(j.error || 'error'), { code: j.error || 'error', detail: j.detail });
    return j;
  }

  // ---------- formatting ----------
  const CUR = { DZD: ['دج', 'DA', 'DA'] };
  function money(minor, cur = 'DZD') {
    const v = (minor || 0) / 100;
    const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v).replace(/ /g, ' ');
    return `${n} ${CUR[cur] ? CUR[cur][LANGS.indexOf(lang)] : cur}`;
  }
  const loc = () => (lang === 'ar' ? 'ar-DZ-u-nu-latn' : lang === 'fr' ? 'fr-FR' : 'en-GB');
  const date = (ts) => (ts ? new Date(ts).toLocaleDateString(loc(), { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
  const dateTime = (ts) => (ts ? new Date(ts).toLocaleString(loc(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const toMajor = (minor) => (minor ? String(minor / 100) : '');

  // ---------- UI ----------
  let toastTimer;
  function toast(msg, kind = 'ok') {
    const el = $('#toast');
    el.textContent = msg; el.className = `show ${kind}`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = ''; }, 3200);
  }
  const showErr = (e) => toast(errText(e.code || 'network', e.detail), 'err');

  function modal(title, content, { wide = false, onClose } = {}) {
    const close = () => { back.remove(); document.removeEventListener('keydown', esc); onClose?.(); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    const back = h('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(); } },
      h('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true' },
        h('header', null, h('h2', null, title), h('button', { class: 'icon-btn', 'aria-label': t('close'), onclick: close }, '✕')),
        h('div', { class: 'modal-body' }, content)));
    document.body.append(back);
    document.addEventListener('keydown', esc);
    setTimeout(() => back.querySelector('input,select,textarea')?.focus(), 30);
    return { close, el: back };
  }
  function confirmBox(msg, okLabel = t('confirm'), danger = true) {
    return new Promise((res) => {
      let done = false;
      const m = modal(t('areYouSure'), [h('p', null, msg), h('div', { class: 'row end' },
        h('button', { class: 'btn ghost', onclick: () => { done = true; m.close(); res(false); } }, t('cancel')),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => { done = true; m.close(); res(true); } }, okLabel))],
      { onClose: () => { if (!done) res(false); } });
    });
  }
  function field(label, input, hint) {
    return h('label', { class: 'field' }, h('span', null, label), input, hint ? h('small', null, hint) : null);
  }
  const input = (attrs) => h('input', { class: 'in', ...attrs });
  function select(name, options, value, attrs = {}) {
    return h('select', { class: 'in', name, ...attrs }, options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) }, l)));
  }
  function formData(form) {
    const o = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else o[el.name] = el.value;
    }
    return o;
  }
  async function busy(btn, fn) {
    if (btn.disabled) return;
    btn.disabled = true; btn.classList.add('busy');
    try { return await fn(); } catch (e) { showErr(e); } finally { btn.disabled = false; btn.classList.remove('busy'); }
  }

  // Bar chart as SVG (bars = total, dots = profit).
  function barChart(points, { height = 160, value = (p) => p.total, label } = {}) {
    const ns = 'http://www.w3.org/2000/svg';
    const W = 600, H = height, pad = 4;
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H + 18}`); svg.setAttribute('class', 'chart'); svg.setAttribute('role', 'img');
    if (!points.length) return h('p', { class: 'muted center' }, t('empty'));
    const max = Math.max(...points.map(value), 1);
    const bw = (W - pad * 2) / points.length;
    points.forEach((p, i) => {
      const v = value(p), bh = Math.max(2, (v / max) * (H - 10));
      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', pad + i * bw + bw * 0.15); r.setAttribute('y', H - bh); r.setAttribute('width', Math.max(1, bw * 0.7)); r.setAttribute('height', bh); r.setAttribute('rx', 3);
      const tt = document.createElementNS(ns, 'title'); tt.textContent = `${date(p.day)} · ${label ? label(p) : money(v)}`; r.append(tt);
      svg.append(r);
      if (points.length <= 31 && (i % Math.ceil(points.length / 8) === 0)) {
        const tx = document.createElementNS(ns, 'text');
        tx.setAttribute('x', pad + i * bw + bw / 2); tx.setAttribute('y', H + 14); tx.setAttribute('text-anchor', 'middle');
        tx.textContent = new Date(p.day).getDate(); svg.append(tx);
      }
    });
    return svg;
  }
  // Fill days with no sales so the chart has a bar per day.
  function fillDays(points, from, to) {
    const map = new Map(points.map((p) => [new Date(p.day).toDateString(), p]));
    const out = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const k = d.toDateString();
      out.push(map.get(k) || { day: d.getTime(), total: 0, profit: 0, n: 0 });
    }
    return out;
  }

  // ---------- images: resize + WebP in the browser before upload ----------
  async function encode(canvas, quality) {
    const webp = await new Promise((r) => canvas.toBlob(r, 'image/webp', quality));
    if (webp && webp.type === 'image/webp') return webp;
    return new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality + 0.04));
  }
  async function resize(bitmap, maxSide, quality) {
    const s = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * s), hh = Math.round(bitmap.height * s);
    const c = document.createElement('canvas'); c.width = w; c.height = hh;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, hh);
    g.drawImage(bitmap, 0, 0, w, hh);
    let blob = await encode(c, quality);
    for (let q = quality - 0.1; blob.size > 850 * 1024 && q > 0.4; q -= 0.1) blob = await encode(c, q);
    return { blob, w, h: hh };
  }
  async function compressImage(file, { full = 1280, thumb = 480 } = {}) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
    if (!bmp) throw Object.assign(new Error('image_type'), { code: 'image_type' });
    const big = await resize(bmp, full, 0.8);
    const small = thumb ? await resize(bmp, thumb, 0.72) : null;
    bmp.close?.();
    return { big, small };
  }
  async function uploadImage(storeId, file, opts) {
    const { big, small } = await compressImage(file, opts);
    const up = (b) => api('POST', `/api/s/${storeId}/uploads`, b.blob, b.blob.type);
    const f = await up(big);
    const th = small ? await up(small) : null;
    return { f: f.file, t: th?.file || f.file, w: big.w, h: big.h };
  }
  const imgUrl = (storeId, f) => `/u/${storeId}/${f}`;

  // ---------- camera scanner (QR codes, barcodes, IMEI barcodes) ----------
  async function scan({ title = t('scan'), formats } = {}) {
    return new Promise((resolve) => {
      let stream = null, stop = false, done = false;
      const video = h('video', { playsinline: true, muted: true, class: 'scan-video' });
      const manual = input({ placeholder: t('typeCode'), inputmode: 'text', dir: 'ltr' });
      const msg = h('p', { class: 'muted' }, t('scanHelp'));
      const finish = (v) => { if (done) return; done = true; stop = true; stream?.getTracks().forEach((tr) => tr.stop()); m.close(); resolve(v); };
      const m = modal(title, [h('div', { class: 'scan-box' }, video, h('i', { class: 'scan-line' })), msg,
        h('form', { class: 'row', onsubmit: (e) => { e.preventDefault(); if (manual.value.trim()) finish(manual.value.trim()); } }, manual, h('button', { class: 'btn primary' }, t('confirm')))],
      { onClose: () => { stop = true; stream?.getTracks().forEach((tr) => tr.stop()); if (!done) { done = true; resolve(null); } } });
      if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) { msg.textContent = t('noCamera'); video.remove(); return; }
      (async () => {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats();
          const want = formats || ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'data_matrix'];
          const det = new window.BarcodeDetector({ formats: want.filter((f) => supported.includes(f)) });
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
          video.srcObject = stream; await video.play();
          const loop = async () => {
            if (stop) return;
            try {
              const codes = await det.detect(video);
              if (codes.length) { navigator.vibrate?.(60); return finish(codes[0].rawValue); }
            } catch { /* frame not ready */ }
            setTimeout(loop, 180);
          };
          loop();
        } catch { msg.textContent = t('noCamera'); video.remove(); }
      })();
    });
  }

  window.MS = { fill, t, setLang, get lang() { return lang; }, LANGS, errText, h, $, api, money, date, dateTime, toMajor, toast, showErr, modal, confirmBox, field, input, select, formData, busy, barChart, fillDays, compressImage, uploadImage, imgUrl, scan };
})();
