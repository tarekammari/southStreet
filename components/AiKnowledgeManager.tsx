'use client';

import React, { useState, useEffect } from 'react';
import { AiKnowledgeRule } from '@/lib/db';

type MainTab       = 'knowledge' | 'directives' | 'playground' | 'sources';
type AnswerMode    = 'official_exact' | 'ai_generated' | 'hybrid';
type MatchStrategy = 'keywords_or_title' | 'keywords_only' | 'exact_title';
type Category      = 'packages' | 'requirements' | 'rituals' | 'hotels' | 'flights' | 'pricing' | 'faq';

interface AiKnowledgeManagerProps {
  userRole: string;
  userName: string;
  userEmail?: string;
  allowedCategories?: Category[];
  title?: string;
  subtitle?: string;
}

interface SystemDirectives {
  tone: 'professional_warm' | 'concise_formal' | 'religious_guidance';
  strictPricing: boolean;
  handoverGuide: boolean;
  customInstructions: string;
}

const DEFAULT_DIRECTIVES: SystemDirectives = {
  tone: 'professional_warm',
  strictPricing: true,
  handoverGuide: true,
  customInstructions: 'الإجابة باللغة العربية الفصحى الواضحة، تقديم المعلومات الرسمية الخاصة بوكالة ساوث ستريت فقط، وتوجيه المعتمر للمرشد الديني عند الأسئلة الفقهية الدقيقة.',
};

const CATEGORY_LABEL: Record<string, string> = {
  packages:     'الباقات والأسعار',
  rituals:      'المناسك والفتاوى',
  pricing:      'الدفع والتحويل',
  requirements: 'الوثائق والشروط',
  hotels:       'الفنادق والإقامة',
  flights:      'الرحلات والطيران',
  faq:          'أسئلة عامة',
};

const ANSWER_MODE_LABEL: Record<AnswerMode, string> = {
  official_exact: 'نص رسمي',
  ai_generated:   'صياغة ذكية',
  hybrid:         'نص هجين',
};

function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}]/gu, '')
    .replace(/\*\*/g, '')
    .replace(/^[•\-\*]\s+/gm, '')
    .trim();
}

export default function AiKnowledgeManager({
  userRole,
  userName,
  allowedCategories,
}: AiKnowledgeManagerProps) {
  const [activeTab, setActiveTab] = useState<MainTab>('knowledge');

  // Rules state
  const [rules, setRules]             = useState<AiKnowledgeRule[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  // System Directives state
  const [directives, setDirectives] = useState<SystemDirectives>(DEFAULT_DIRECTIVES);
  const [directivesSaved, setDirectivesSaved] = useState(false);

  // Playground state
  const [testPrompt, setTestPrompt]       = useState('');
  const [testResponse, setTestResponse]   = useState<string | null>(null);
  const [testMatchedRule, setTestMatchedRule] = useState<string | null>(null);
  const [testLatency, setTestLatency]     = useState<number | null>(null);
  const [testBusy, setTestBusy]           = useState(false);

  // Web Learner state
  const [webUrl, setWebUrl]           = useState('');
  const [webCategory, setWebCategory] = useState<Category>(allowedCategories?.[0] ?? 'faq');
  const [webBusy, setWebBusy]         = useState(false);
  const [webMsg, setWebMsg]           = useState('');

  // Add/Edit Modal state
  const [isModalOpen, setIsModalOpen]           = useState(false);
  const [modalMode, setModalMode]               = useState<'create' | 'edit'>('create');
  const [editRuleId, setEditRuleId]             = useState<string | null>(null);
  const [ruleCategory, setRuleCategory]         = useState<Category>(allowedCategories?.[0] ?? 'faq');
  const [ruleTitle, setRuleTitle]               = useState('');
  const [ruleKeywords, setRuleKeywords]         = useState('');
  const [ruleResponse, setRuleResponse]         = useState('');
  const [ruleAnswerMode, setRuleAnswerMode]     = useState<AnswerMode>('official_exact');
  const [ruleMatchStrategy, setRuleMatchStrategy] = useState<MatchStrategy>('keywords_or_title');
  const [formMsg, setFormMsg]                   = useState('');
  const [submitting, setSubmitting]             = useState(false);

  const cats = allowedCategories ?? (Object.keys(CATEGORY_LABEL) as Category[]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('southstreet_ai_directives');
      if (saved) setDirectives(JSON.parse(saved));
    } catch {}
  }, []);

  const saveDirectives = () => {
    try {
      localStorage.setItem('southstreet_ai_directives', JSON.stringify(directives));
      setDirectivesSaved(true);
      setTimeout(() => setDirectivesSaved(false), 3000);
    } catch {}
  };

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sakhr-knowledge');
      if (res.ok) {
        const d = await res.json();
        setRules(d.rules || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, []);

  const displayedRules = rules.filter(r => {
    if (allowedCategories && !allowedCategories.includes(r.category as any)) return false;
    if (selectedCat !== 'all' && r.category !== selectedCat) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.title_ar.toLowerCase().includes(q) ||
        r.response_ar.toLowerCase().includes(q) ||
        r.keywords.some(k => k.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpandedRuleId(prev => (prev === id ? null : id));
  };

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditRuleId(null);
    setRuleTitle('');
    setRuleKeywords('');
    setRuleResponse('');
    setRuleCategory(cats[0] ?? 'faq');
    setRuleAnswerMode('official_exact');
    setRuleMatchStrategy('keywords_or_title');
    setFormMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: AiKnowledgeRule) => {
    setModalMode('edit');
    setEditRuleId(rule.id);
    setRuleTitle(rule.title_ar);
    setRuleKeywords(rule.keywords.join('، '));
    setRuleResponse(cleanText(rule.response_ar));
    setRuleCategory(rule.category as Category);
    setRuleAnswerMode(rule.answerMode || 'official_exact');
    setRuleMatchStrategy(rule.matchStrategy || 'keywords_or_title');
    setFormMsg('');
    setIsModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleTitle.trim() || !ruleResponse.trim() || !ruleKeywords.trim()) {
      setFormMsg('يرجى ملء كافة الحقول');
      return;
    }
    setSubmitting(true);
    setFormMsg('');

    const keywords = ruleKeywords.split(/[,،]+/).map(k => k.trim()).filter(Boolean);

    try {
      const endpoint = '/api/admin/sakhr-knowledge';
      const method = modalMode === 'create' ? 'POST' : 'PUT';
      const payload: any = {
        category: ruleCategory,
        title_ar: ruleTitle.trim(),
        keywords,
        response_ar: ruleResponse.trim(),
        answerMode: ruleAnswerMode,
        matchStrategy: ruleMatchStrategy,
        updatedBy: `${userName} (${userRole})`,
      };
      if (modalMode === 'edit') payload.id = editRuleId;

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setSubmitting(false);

      if (res.ok) {
        setIsModalOpen(false);
        fetchRules();
        if (modalMode === 'edit' && editRuleId) {
          setExpandedRuleId(editRuleId);
        }
      } else {
        setFormMsg(data.error || 'حدث خطأ');
      }
    } catch {
      setSubmitting(false);
      setFormMsg('خطأ في الاتصال');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا السؤال من ذاكرة صخر؟')) return;
    try {
      const res = await fetch(`/api/admin/sakhr-knowledge?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== id));
        if (expandedRuleId === id) setExpandedRuleId(null);
      }
    } catch {}
  };

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPrompt.trim()) return;
    setTestBusy(true);
    setTestResponse(null);
    setTestMatchedRule(null);
    setTestLatency(null);

    const startTime = performance.now();
    try {
      const res = await fetch('/api/ai/sakhr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: testPrompt }),
      });
      const data = await res.json();
      const endTime = performance.now();

      setTestBusy(false);
      setTestLatency(Math.round(endTime - startTime));
      setTestResponse(cleanText(data.text || 'لم تُستَرجع إجابة.'));

      const matched = rules.find(r =>
        r.keywords.some(k => testPrompt.toLowerCase().includes(k.toLowerCase())) ||
        testPrompt.toLowerCase().includes(r.title_ar.toLowerCase())
      );
      if (matched) setTestMatchedRule(matched.title_ar);
    } catch {
      setTestBusy(false);
      setTestResponse('تعذر الاتصال بمحرك صخر.');
    }
  };

  const handleWebLearn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webUrl.startsWith('http')) {
      setWebMsg('error:يرجى إدخال رابط يبدأ بـ https://');
      return;
    }
    setWebBusy(true);
    setWebMsg('');
    try {
      const res = await fetch('/api/admin/sakhr-learn-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webUrl, category: webCategory }),
      });
      const data = await res.json();
      setWebBusy(false);
      if (res.ok) {
        setWebMsg('success:تم تحليل الرابط واستخراج الأسئلة وإضافتها بنجاح');
        setWebUrl('');
        fetchRules();
      } else {
        setWebMsg(`error:${data.error || 'تعذر استخراج المحتوى'}`);
      }
    } catch {
      setWebBusy(false);
      setWebMsg('error:خطأ في الاتصال بالخادم');
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">

      {/* ── Top Header & Tab Navigation ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-black/5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1d1d1f] tracking-tight">
            مركز تحكم صخر AI
          </h2>
          <p className="text-xs sm:text-sm text-[#6e6e73] mt-0.5">
            إدارة الأسئلة والإجابات، وتوجيه سلوك الذكاء الاصطناعي، والمحاكاة
          </p>
        </div>

        <div className="bg-[#f5f5f7] p-1 rounded-xl flex gap-1 border border-black/5 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'knowledge' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
            }`}
          >
            قاعدة الأسئلة ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('directives')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'directives' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
            }`}
          >
            توجيه وسلوك الإجابة
          </button>
          <button
            onClick={() => setActiveTab('playground')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'playground' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
            }`}
          >
            مختبر المحاكاة
          </button>
          <button
            onClick={() => setActiveTab('sources')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sources' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
            }`}
          >
            استيراد مصادر
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB 1: KNOWLEDGE BASE (CLEAN TITLES LIST + CLICK TO EXPAND) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'knowledge' && (
        <div className="space-y-4">
          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <input
                type="text"
                placeholder="بحث في الأسئلة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-[#f5f5f7] border border-black/5 rounded-xl px-3.5 py-2 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3] w-full sm:w-56"
              />

              <div className="flex gap-1 overflow-x-auto pb-1 max-w-full">
                <button
                  onClick={() => setSelectedCat('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCat === 'all'
                      ? 'bg-[#1d1d1f] text-white'
                      : 'bg-[#f5f5f7] text-[#6e6e73] hover:text-[#1d1d1f]'
                  }`}
                >
                  الكل ({rules.length})
                </button>
                {cats.map(c => {
                  const count = rules.filter(r => r.category === c).length;
                  return (
                    <button
                      key={c}
                      onClick={() => setSelectedCat(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        selectedCat === c
                          ? 'bg-[#1d1d1f] text-white'
                          : 'bg-[#f5f5f7] text-[#6e6e73] hover:text-[#1d1d1f]'
                      }`}
                    >
                      {CATEGORY_LABEL[c] ?? c} {count > 0 && `(${count})`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={fetchRules}
                className="px-3 py-2 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] text-xs font-semibold transition-all cursor-pointer"
              >
                {loading ? 'جاري...' : 'تحديث'}
              </button>
              <button
                onClick={handleOpenCreate}
                className="px-4 py-2 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                إضافة سؤال
              </button>
            </div>
          </div>

          {/* Clean List View with Click-to-Expand */}
          {loading ? (
            <div className="text-center py-16 text-xs text-[#6e6e73]">جاري تحميل الأسئلة...</div>
          ) : displayedRules.length === 0 ? (
            <div className="bg-white border border-black/5 rounded-2xl p-12 text-center space-y-3">
              <p className="text-sm font-bold text-[#1d1d1f]">لا توجد نتائج مطابقة</p>
              <p className="text-xs text-[#6e6e73]">أضف أسئلة جديدة لتدريب صخر</p>
              <button
                onClick={handleOpenCreate}
                className="px-4 py-2 rounded-xl bg-[#0071e3] text-white text-xs font-bold"
              >
                إضافة سؤال جديد
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-black/5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden divide-y divide-black/5">
              {displayedRules.map((rule) => {
                const isExpanded = expandedRuleId === rule.id;
                return (
                  <div key={rule.id} className="transition-colors">
                    {/* Header Row (Title Only + Metadata) */}
                    <div
                      onClick={() => toggleExpand(rule.id)}
                      className="p-4 sm:px-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#f5f5f7]/60 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-bold text-[#0071e3] bg-[#0071e3]/10 px-2.5 py-1 rounded-md shrink-0">
                          {CATEGORY_LABEL[rule.category] ?? rule.category}
                        </span>
                        <h4 className="text-sm sm:text-base font-bold text-[#1d1d1f] truncate">
                          {rule.title_ar}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-xs text-[#6e6e73]">
                        <span className="hidden sm:inline font-medium text-[11px]">
                          {ANSWER_MODE_LABEL[rule.answerMode || 'official_exact']}
                        </span>
                        <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-[#f5f5f7] text-[#1d1d1f]">
                          {isExpanded ? 'إخفاء' : 'عرض'}
                        </span>
                      </div>
                    </div>

                    {/* Expanded Detail Body (Smoothly Revealed on Click) */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 bg-[#fbfbfd] border-t border-black/5 space-y-3.5 animate-fade-in text-xs">
                        <div>
                          <span className="text-[11px] font-bold text-[#6e6e73] block mb-1">
                            الإجابة المعتمدة التي يقدمها صخر للمعتمرين:
                          </span>
                          <div className="p-4 bg-white rounded-xl border border-black/5 text-[#1d1d1f] leading-relaxed whitespace-pre-line text-xs sm:text-sm">
                            {cleanText(rule.response_ar)}
                          </div>
                        </div>

                        {rule.keywords.length > 0 && (
                          <div>
                            <span className="text-[11px] font-bold text-[#6e6e73] block mb-1">
                              الكلمات المفتاحية المشغلة:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {rule.keywords.map((k, i) => (
                                <span
                                  key={i}
                                  className="text-[11px] font-mono bg-white text-[#1d1d1f] px-2.5 py-1 rounded-md border border-black/5 font-medium"
                                >
                                  {k}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="pt-2 flex items-center justify-between border-t border-black/5 text-[11px] text-[#6e6e73]">
                          <span>نوع المعالجة: {ANSWER_MODE_LABEL[rule.answerMode || 'official_exact']}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenEdit(rule)}
                              className="px-3.5 py-1.5 rounded-lg bg-[#0071e3] text-white font-bold hover:bg-[#0077ed] transition-colors cursor-pointer"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={() => handleDelete(rule.id)}
                              className="px-3.5 py-1.5 rounded-lg bg-[#ff3b30]/10 text-[#ff3b30] font-bold hover:bg-[#ff3b30]/20 transition-colors cursor-pointer"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB 2: SYSTEM DIRECTIVES & TONE                             */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'directives' && (
        <div className="space-y-5 max-w-2xl">
          <div className="bg-white rounded-2xl border border-black/5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-[#1d1d1f]">نبرة وصوت صخر (Persona & Tone)</h3>
              <p className="text-xs text-[#6e6e73] mt-0.5">
                تحديد الأسلوب الذي يتبعه صخر عند صياغة الإجابات للمعتمرين
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'professional_warm', title: 'وقور ومرحب', desc: 'لغة عربية فصحى معتدلة وأسلوب فندقي محترم' },
                { id: 'concise_formal', title: 'مختصر ومباشر', desc: 'إجابات مباشرة ومركزة بالأرقام والتواريخ' },
                { id: 'religious_guidance', title: 'إرشادي وتوجيهي', desc: 'تركيز على فقه المناسك والأدعية المأثورة' },
              ].map(opt => (
                <div
                  key={opt.id}
                  onClick={() => setDirectives(d => ({ ...d, tone: opt.id as any }))}
                  className={`p-4 rounded-xl border transition-all cursor-pointer text-right space-y-1 ${
                    directives.tone === opt.id
                      ? 'border-[#0071e3] bg-[#0071e3]/5 shadow-sm'
                      : 'border-black/5 bg-[#f5f5f7] hover:border-black/10'
                  }`}
                >
                  <strong className="text-xs text-[#1d1d1f] block">{opt.title}</strong>
                  <p className="text-[11px] text-[#6e6e73] leading-relaxed">{opt.desc}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-3 border-t border-black/5">
              <h4 className="text-xs font-bold text-[#1d1d1f]">ضوابط الإجابة الإلزامية (Guardrails)</h4>

              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-xl bg-[#f5f5f7] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={directives.strictPricing}
                    onChange={e => setDirectives(d => ({ ...d, strictPricing: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#0071e3] focus:ring-0"
                  />
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#1d1d1f] block">الالتزام التام بالأسعار المعتمدة</span>
                    <span className="text-[11px] text-[#6e6e73]">منع صخر من تقدير أو إعطاء أي أسعار غير مسجلة رسمياً</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl bg-[#f5f5f7] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={directives.handoverGuide}
                    onChange={e => setDirectives(d => ({ ...d, handoverGuide: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#0071e3] focus:ring-0"
                  />
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#1d1d1f] block">التحويل للمرشد عند المسائل الخلافية</span>
                    <span className="text-[11px] text-[#6e6e73]">توجيه المعتمر لمحادثة الشيخ المرشد عند الأسئلة الفقهية الحساسة</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-black/5">
              <label className="block text-xs font-bold text-[#1d1d1f]">
                التعليمات العامة للنظام (System Instructions)
              </label>
              <textarea
                rows={4}
                value={directives.customInstructions}
                onChange={e => setDirectives(d => ({ ...d, customInstructions: e.target.value }))}
                className="w-full bg-[#f5f5f7] border border-black/5 rounded-xl p-3 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3] leading-relaxed resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={saveDirectives}
                className="px-5 py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                حفظ التعليمات
              </button>
              {directivesSaved && (
                <span className="text-xs font-bold text-[#34c759]">
                  تم حفظ وتحديث تعليمات صخر بنجاح
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB 3: PLAYGROUND / SIMULATOR                               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'playground' && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-white rounded-2xl border border-black/5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#1d1d1f]">مختبر المحاكاة المباشر</h3>
              <p className="text-xs text-[#6e6e73] mt-0.5">
                اختبار إجابات صخر والتحقق من مصادر وسرعة الرد
              </p>
            </div>

            <form onSubmit={handleTest} className="flex gap-2">
              <input
                type="text"
                placeholder="اكتب سؤالاً تجريبياً (مثال: ما هي شروط العمرة؟ كم سعر باقة أوت؟)..."
                value={testPrompt}
                onChange={e => setTestPrompt(e.target.value)}
                className="flex-1 bg-[#f5f5f7] border border-black/5 rounded-xl px-3.5 py-2.5 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]"
              />
              <button
                type="submit"
                disabled={testBusy || !testPrompt.trim()}
                className="px-5 py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-40 shrink-0"
              >
                {testBusy ? 'جاري...' : 'اختبار'}
              </button>
            </form>

            {testResponse && (
              <div className="space-y-2 pt-3 border-t border-black/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#1d1d1f]">إجابة صخر:</span>
                  <div className="flex items-center gap-3 text-[11px] text-[#6e6e73]">
                    {testLatency !== null && <span>الاستجابة: {testLatency}ms</span>}
                    {testMatchedRule && <span className="text-[#0071e3] font-bold">المصدر: {testMatchedRule}</span>}
                  </div>
                </div>

                <div className="p-4 bg-[#f5f5f7] rounded-xl text-xs text-[#1d1d1f] leading-relaxed whitespace-pre-line">
                  {testResponse}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB 4: DATA SOURCES & INGESTION                             */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'sources' && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-white rounded-2xl border border-black/5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#1d1d1f]">استيراد المعرفة من روابط الويب</h3>
              <p className="text-xs text-[#6e6e73] mt-0.5">
                قراءة صفحة ويب واستخراج وتصنيف الأسئلة آلياً في ذاكرة صخر
              </p>
            </div>

            <form onSubmit={handleWebLearn} className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                placeholder="https://example.com/page"
                value={webUrl}
                onChange={e => setWebUrl(e.target.value)}
                dir="ltr"
                className="flex-1 bg-[#f5f5f7] border border-black/5 rounded-xl px-3.5 py-2.5 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]"
              />
              <select
                value={webCategory}
                onChange={e => setWebCategory(e.target.value as Category)}
                className="bg-[#f5f5f7] border border-black/5 rounded-xl px-3 py-2.5 text-xs text-[#1d1d1f] outline-none"
              >
                {cats.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={webBusy || !webUrl.trim()}
                className="px-5 py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-40 shrink-0"
              >
                {webBusy ? 'جاري التحليل...' : 'استيراد'}
              </button>
            </form>

            {webMsg && (
              <p className={`p-3 rounded-xl text-xs font-semibold ${
                webMsg.startsWith('success:')
                  ? 'bg-[#34c759]/10 text-[#34c759]'
                  : 'bg-[#ff3b30]/10 text-[#ff3b30]'
              }`}>
                {webMsg.replace(/^(success|error):/, '')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODAL: CREATE / EDIT QUESTION                               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-right border border-black/5"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-black/5 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1d1d1f]">
                {modalMode === 'create' ? 'إضافة سؤال وجواب جديد' : 'تعديل السؤال'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#6e6e73] hover:text-[#1d1d1f] text-lg font-light p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-5 sm:p-6 space-y-3.5 text-xs">
              {formMsg && (
                <div className="p-3 bg-[#ff3b30]/10 text-[#ff3b30] font-bold rounded-xl">
                  {formMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#1d1d1f] mb-1">القسم</label>
                <select
                  value={ruleCategory}
                  onChange={e => setRuleCategory(e.target.value as Category)}
                  className="w-full bg-[#f5f5f7] border border-black/5 rounded-xl px-3 py-2 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                >
                  {cats.map(c => (
                    <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1d1d1f] mb-1">عنوان السؤال / الموضوع</label>
                <input
                  type="text"
                  required
                  value={ruleTitle}
                  onChange={e => setRuleTitle(e.target.value)}
                  placeholder="مثال: شروط وتفاصيل باقة أوت الاقتصادية"
                  className="w-full bg-[#f5f5f7] border border-black/5 rounded-xl px-3.5 py-2.5 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1d1d1f] mb-1">
                  الكلمات المشغلة <span className="text-[#6e6e73] font-normal">(مفصولة بفواصل)</span>
                </label>
                <input
                  type="text"
                  required
                  value={ruleKeywords}
                  onChange={e => setRuleKeywords(e.target.value)}
                  placeholder="أوت، باقة، 215000، منارات غزة"
                  className="w-full bg-[#f5f5f7] border border-black/5 rounded-xl px-3.5 py-2.5 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1d1d1f] mb-1">نوع الإجابة</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['official_exact', 'ai_generated', 'hybrid'] as AnswerMode[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setRuleAnswerMode(mode)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        ruleAnswerMode === mode
                          ? 'bg-[#1d1d1f] text-white shadow-sm'
                          : 'bg-[#f5f5f7] text-[#6e6e73] hover:text-[#1d1d1f]'
                      }`}
                    >
                      {ANSWER_MODE_LABEL[mode]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1d1d1f] mb-1">الإجابة المعتمدة</label>
                <textarea
                  rows={4}
                  required
                  value={ruleResponse}
                  onChange={e => setRuleResponse(e.target.value)}
                  placeholder="اكتب الإجابة الدقيقة والواضحة..."
                  className="w-full bg-[#f5f5f7] border border-black/5 rounded-xl p-3 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3] leading-relaxed resize-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] font-bold text-xs transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-40"
                >
                  {submitting ? 'جاري الحفظ...' : (modalMode === 'create' ? 'إضافة السؤال' : 'تحديث')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
