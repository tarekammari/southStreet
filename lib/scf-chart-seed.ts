import type Database from 'better-sqlite3';
import { getSqliteDb } from '@/lib/sqlite';

/** SCF accounts from docs/accountant_principales/SCF_accountant_rules.md §3 only. */
export type ScfChartRow = {
  code: string;
  label_ar: string;
  label_fr: string;
  class: number;
  parent_code: string | null;
};

export const SCF_CHART_SEED: ScfChartRow[] = [
  { code: '101', label_ar: 'رأس المال الصادر / أموال الاستغلال', label_fr: 'Capital social', class: 1, parent_code: null },
  { code: '106', label_ar: 'الاحتياطات', label_fr: 'Réserves', class: 1, parent_code: null },
  { code: '108', label_ar: 'حساب المستغل', label_fr: 'Compte de l\'exploitant', class: 1, parent_code: null },
  { code: '11', label_ar: 'الترحيل من جديد', label_fr: 'Report à nouveau', class: 1, parent_code: null },
  { code: '12', label_ar: 'نتيجة السنة المالية', label_fr: 'Résultat de l\'exercice', class: 1, parent_code: null },
  { code: '16', label_ar: 'الاقتراضات والديون المماثلة', label_fr: 'Emprunts', class: 1, parent_code: null },
  { code: '20', label_ar: 'تثبيتات معنوية', label_fr: 'Immobilisations incorporelles', class: 2, parent_code: null },
  { code: '203', label_ar: 'مصاريف التطوير القابلة للتثبيت', label_fr: 'Frais de développement immobilisables', class: 2, parent_code: '20' },
  { code: '204', label_ar: 'برمجيات المعلوماتية وما شابهها', label_fr: 'Logiciels informatiques', class: 2, parent_code: '20' },
  { code: '205', label_ar: 'الامتيازات والبراءات والرخص والعلامات', label_fr: 'Concessions, brevets, licences', class: 2, parent_code: '20' },
  { code: '208', label_ar: 'تثبيتات معنوية أخرى', label_fr: 'Autres immobilisations incorporelles', class: 2, parent_code: '20' },
  { code: '21', label_ar: 'تثبيتات عينية', label_fr: 'Immobilisations corporelles', class: 2, parent_code: null },
  { code: '211', label_ar: 'الأراضي', label_fr: 'Terrains', class: 2, parent_code: '21' },
  { code: '212', label_ar: 'تهيئة وتسوية الأراضي', label_fr: 'Agencements de terrains', class: 2, parent_code: '21' },
  { code: '213', label_ar: 'البناءات', label_fr: 'Constructions', class: 2, parent_code: '21' },
  { code: '215', label_ar: 'المنشآت التقنية والمعدات والأدوات', label_fr: 'Installations techniques', class: 2, parent_code: '21' },
  { code: '218', label_ar: 'تثبيتات عينية أخرى', label_fr: 'Autres immobilisations corporelles', class: 2, parent_code: '21' },
  { code: '2182', label_ar: 'معدات النقل', label_fr: 'Matériel de transport', class: 2, parent_code: '218' },
  { code: '2183', label_ar: 'معدات المكتب والإعلام الآلي', label_fr: 'Matériel de bureau et informatique', class: 2, parent_code: '218' },
  { code: '2184', label_ar: 'الأثاث', label_fr: 'Mobilier', class: 2, parent_code: '218' },
  { code: '22', label_ar: 'تثبيتات في شكل امتياز', label_fr: 'Immobilisations en concession', class: 2, parent_code: null },
  { code: '23', label_ar: 'تثبيتات قيد الإنجاز', label_fr: 'Immobilisations en cours', class: 2, parent_code: null },
  { code: '232', label_ar: 'تثبيتات عينية قيد الإنجاز', label_fr: 'Immobilisations corporelles en cours', class: 2, parent_code: '23' },
  { code: '237', label_ar: 'تثبيتات معنوية قيد الإنجاز', label_fr: 'Immobilisations incorporelles en cours', class: 2, parent_code: '23' },
  { code: '238', label_ar: 'تسبيقات على طلبات التثبيتات', label_fr: 'Avances sur immobilisations', class: 2, parent_code: '23' },
  { code: '26', label_ar: 'مساهمات وحسابات دائنة ملحقة', label_fr: 'Participations', class: 2, parent_code: null },
  { code: '265', label_ar: 'سندات المساهمة', label_fr: 'Titres de participation', class: 2, parent_code: '26' },
  { code: '27', label_ar: 'تثبيتات مالية أخرى', label_fr: 'Autres immobilisations financières', class: 2, parent_code: null },
  { code: '271', label_ar: 'سندات مثبتة غير سندات المساهمة', label_fr: 'Titres immobilisés', class: 2, parent_code: '27' },
  { code: '272', label_ar: 'سندات تمثل حق دين', label_fr: 'Titres représentatifs de droit de créance', class: 2, parent_code: '27' },
  { code: '274', label_ar: 'قروض وديون', label_fr: 'Prêts et créances', class: 2, parent_code: '27' },
  { code: '275', label_ar: 'الودائع والكفالات المدفوعة', label_fr: 'Dépôts et cautionnements', class: 2, parent_code: '27' },
  { code: '276', label_ar: 'ديون مثبتة أخرى', label_fr: 'Autres créances immobilisées', class: 2, parent_code: '27' },
  { code: '28', label_ar: 'اهتلاك التثبيتات', label_fr: 'Amortissements des immobilisations', class: 2, parent_code: null },
  { code: '280', label_ar: 'اهتلاك التثبيتات المعنوية', label_fr: 'Amort. incorporelles', class: 2, parent_code: '28' },
  { code: '2804', label_ar: 'اهتلاك البرمجيات والحقوق', label_fr: 'Amort. logiciels et droits', class: 2, parent_code: '280' },
  { code: '281', label_ar: 'اهتلاك التثبيتات العينية', label_fr: 'Amort. corporelles', class: 2, parent_code: '28' },
  { code: '29', label_ar: 'خسائر القيمة عن التثبيتات', label_fr: 'Pertes de valeur sur immobilisations', class: 2, parent_code: null },
  { code: '290', label_ar: 'خسائر القيمة عن التثبيتات المعنوية', label_fr: 'Pertes de valeur incorporelles', class: 2, parent_code: '29' },
  { code: '291', label_ar: 'خسائر القيمة عن التثبيتات العينية', label_fr: 'Pertes de valeur corporelles', class: 2, parent_code: '29' },
  { code: '34', label_ar: 'مخزونات وإنتاجات جارية', label_fr: 'Stocks et en-cours', class: 3, parent_code: null },
  { code: '345', label_ar: 'خدمات جاري تقديمها', label_fr: 'Services en cours', class: 3, parent_code: '34' },
  { code: '401', label_ar: 'موردو المخزونات والخدمات', label_fr: 'Fournisseurs', class: 4, parent_code: null },
  { code: '404', label_ar: 'موردو التثبيتات', label_fr: 'Fournisseurs d\'immobilisations', class: 4, parent_code: null },
  { code: '408', label_ar: 'موردو الفواتير التي لم تصل', label_fr: 'Fournisseurs — factures non parvenues', class: 4, parent_code: null },
  { code: '409', label_ar: 'الموردون المدينون — تسبيقات', label_fr: 'Fournisseurs débiteurs', class: 4, parent_code: null },
  { code: '411', label_ar: 'الزبائن', label_fr: 'Clients', class: 4, parent_code: null },
  { code: '416', label_ar: 'الزبائن المشكوك فيهم', label_fr: 'Clients douteux', class: 4, parent_code: null },
  { code: '418', label_ar: 'زبائن — منتجات لم تُعدّ فواتيرها', label_fr: 'Clients — produits non facturés', class: 4, parent_code: null },
  { code: '419', label_ar: 'الزبائن الدائنون — تسبيقات مستلمة', label_fr: 'Clients créditeurs', class: 4, parent_code: null },
  { code: '421', label_ar: 'المستخدمون — الأجور المستحقة', label_fr: 'Personnel — rémunérations dues', class: 4, parent_code: null },
  { code: '425', label_ar: 'المستخدمون — التسبيقات', label_fr: 'Personnel — avances', class: 4, parent_code: null },
  { code: '431', label_ar: 'الضمان الاجتماعي', label_fr: 'Organismes sociaux', class: 4, parent_code: null },
  { code: '442', label_ar: 'الدولة — ضرائب ورسوم محصلة من الغير', label_fr: 'État — impôts retenus', class: 4, parent_code: null },
  { code: '444', label_ar: 'الدولة — الضرائب على النتائج', label_fr: 'État — impôt sur les bénéfices', class: 4, parent_code: null },
  { code: '445', label_ar: 'الدولة — الرسوم على رقم الأعمال', label_fr: 'État — taxes sur le CA', class: 4, parent_code: null },
  { code: '447', label_ar: 'ضرائب ورسوم أخرى', label_fr: 'Autres impôts et taxes', class: 4, parent_code: null },
  { code: '455', label_ar: 'الشركاء — الحسابات الجارية', label_fr: 'Associés — comptes courants', class: 4, parent_code: null },
  { code: '467', label_ar: 'حسابات أخرى دائنة أو مدينة', label_fr: 'Autres comptes créditeurs/débiteurs', class: 4, parent_code: null },
  { code: '468', label_ar: 'أعباء واجبة الدفع ومنتجات مطلوب استلامها', label_fr: 'Charges à payer / produits à recevoir', class: 4, parent_code: null },
  { code: '47', label_ar: 'حسابات انتقالية أو انتظارية', label_fr: 'Comptes transitoires', class: 4, parent_code: null },
  { code: '481', label_ar: 'مؤونات — خصوم جارية', label_fr: 'Provisions pour risques', class: 4, parent_code: null },
  { code: '486', label_ar: 'أعباء معاينة مسبقاً', label_fr: 'Charges constatées d\'avance', class: 4, parent_code: null },
  { code: '487', label_ar: 'منتوجات معاينة مسبقاً', label_fr: 'Produits constatés d\'avance', class: 4, parent_code: null },
  { code: '491', label_ar: 'خسائر القيمة عن حسابات الزبائن', label_fr: 'Dépréciation clients', class: 4, parent_code: null },
  { code: '512', label_ar: 'بنوك الحسابات الجارية', label_fr: 'Banques', class: 5, parent_code: null },
  { code: '53', label_ar: 'الصندوق', label_fr: 'Caisse', class: 5, parent_code: null },
  { code: '54', label_ar: 'وكالات التسبيقات', label_fr: 'Régies d\'avances', class: 5, parent_code: null },
  { code: '541', label_ar: 'عهدة نقدية (مرافقون)', label_fr: 'Régie d\'avances', class: 5, parent_code: '54' },
  { code: '581', label_ar: 'تحويلات الأموال', label_fr: 'Virements de fonds', class: 5, parent_code: null },
  { code: '604', label_ar: 'مشتريات الدراسات والخدمات المؤداة', label_fr: 'Achats de services', class: 6, parent_code: null },
  { code: '607', label_ar: 'مشتريات غير مخزنة من المواد واللوازم', label_fr: 'Achats non stockés', class: 6, parent_code: null },
  { code: '613', label_ar: 'الإيجارات', label_fr: 'Locations', class: 6, parent_code: null },
  { code: '615', label_ar: 'الصيانة والتصليحات', label_fr: 'Entretien et réparations', class: 6, parent_code: null },
  { code: '616', label_ar: 'أقساط التأمينات', label_fr: 'Primes d\'assurances', class: 6, parent_code: null },
  { code: '622', label_ar: 'أجور الوسطاء والأتعاب', label_fr: 'Rémunérations d\'intermédiaires', class: 6, parent_code: null },
  { code: '623', label_ar: 'الإشهار والنشر', label_fr: 'Publicité', class: 6, parent_code: null },
  { code: '624', label_ar: 'نقل السلع والنقل الجماعي', label_fr: 'Transports', class: 6, parent_code: null },
  { code: '625', label_ar: 'التنقلات والمهمات والاستقبالات', label_fr: 'Déplacements et missions', class: 6, parent_code: null },
  { code: '626', label_ar: 'البريد والاتصالات', label_fr: 'Poste et télécommunications', class: 6, parent_code: null },
  { code: '627', label_ar: 'الخدمات المصرفية', label_fr: 'Services bancaires', class: 6, parent_code: null },
  { code: '631', label_ar: 'أجور المستخدمين', label_fr: 'Rémunérations du personnel', class: 6, parent_code: null },
  { code: '635', label_ar: 'الاشتراكات المدفوعة للهيئات الاجتماعية', label_fr: 'Cotisations sociales', class: 6, parent_code: null },
  { code: '641', label_ar: 'ضرائب على الأجور', label_fr: 'Impôts sur rémunérations', class: 6, parent_code: null },
  { code: '645', label_ar: 'ضرائب ورسوم أخرى', label_fr: 'Autres impôts', class: 6, parent_code: null },
  { code: '654', label_ar: 'خسائر عن حسابات دائنة غير قابلة للتحصيل', label_fr: 'Pertes sur créances', class: 6, parent_code: null },
  { code: '656', label_ar: 'الغرامات والعقوبات والهبات', label_fr: 'Amendes et pénalités', class: 6, parent_code: null },
  { code: '661', label_ar: 'أعباء الفوائد', label_fr: 'Charges d\'intérêts', class: 6, parent_code: null },
  { code: '666', label_ar: 'خسائر الصرف', label_fr: 'Pertes de change', class: 6, parent_code: null },
  { code: '681', label_ar: 'مخصصات الاهتلاكات والمؤونات', label_fr: 'Dotations', class: 6, parent_code: null },
  { code: '695', label_ar: 'الضرائب على الأرباح', label_fr: 'Impôt sur les bénéfices', class: 6, parent_code: null },
  { code: '706', label_ar: 'تقديم الخدمات الأخرى', label_fr: 'Prestations de services', class: 7, parent_code: null },
  { code: '708', label_ar: 'منتوجات الأنشطة الملحقة', label_fr: 'Produits annexes', class: 7, parent_code: null },
  { code: '709', label_ar: 'التخفيضات والتنزيلات الممنوحة', label_fr: 'Rabais accordés', class: 7, parent_code: null },
  { code: '758', label_ar: 'منتوجات أخرى للتسيير الجاري', label_fr: 'Autres produits de gestion', class: 7, parent_code: null },
  { code: '766', label_ar: 'أرباح الصرف', label_fr: 'Gains de change', class: 7, parent_code: null },
  { code: '78', label_ar: 'استرجاعات عن خسائر القيمة والمؤونات', label_fr: 'Reprises sur provisions', class: 7, parent_code: null },
];

export function seedScfChartAccounts(db: Database.Database) {
  const ins = db.prepare(`
    INSERT OR IGNORE INTO finance_scf_accounts (code, label_ar, label_fr, class, parent_code, active)
    VALUES (@code, @label_ar, @label_fr, @class, @parent_code, 1)
  `);
  const upd = db.prepare(`
    UPDATE finance_scf_accounts
    SET label_ar = @label_ar, label_fr = @label_fr, class = @class, parent_code = @parent_code, active = 1
    WHERE code = @code
  `);
  for (const row of SCF_CHART_SEED) {
    ins.run(row);
    upd.run(row);
  }
}

export function listScfChartAccounts(opts?: { class?: number; q?: string; activeOnly?: boolean }) {
  const db = getSqliteDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts?.activeOnly !== false) {
    where.push('active = 1');
  }
  if (opts?.class != null) {
    where.push('class = ?');
    params.push(opts.class);
  }
  const q = String(opts?.q || '').trim().toLowerCase();
  type Row = ScfChartRow & { active: number };
  const rows = db
    .prepare(
      `SELECT code, label_ar, label_fr, class, parent_code, active FROM finance_scf_accounts
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY class, code`
    )
    .all(...params) as Row[];
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.code.includes(q) ||
      r.label_ar.toLowerCase().includes(q) ||
      r.label_fr.toLowerCase().includes(q)
  );
}
