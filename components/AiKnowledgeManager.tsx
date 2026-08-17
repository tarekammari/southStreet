'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles, Plus, Trash2, Globe, Search, CheckCircle, RefreshCw,
  BookOpen, HelpCircle, FileText, DollarSign, Compass, Layers,
  ChevronDown, ChevronUp, FlaskConical, Link2, Tag, MessageSquareText,
  Edit3, AlertCircle, ThumbsUp, ThumbsDown, Minus, Save, ClipboardList,
  Star
} from 'lucide-react';
import { AiKnowledgeRule } from '@/lib/db';

interface AiKnowledgeManagerProps {
  userRole: 'admin' | 'SUPER_ADMIN' | 'AGENCY_MANAGER' | 'murshid' | 'accountant' | 'manager' | 'AGENCY_AGENT' | string;
  userName: string;
  userEmail?: string;
  allowedCategories?: ('packages' | 'requirements' | 'rituals' | 'hotels' | 'flights' | 'pricing' | 'faq')[];
  title?: string;
  subtitle?: string;
}

const CATEGORY_META: Record<string, { label: string; labelShort: string; icon: any; accent: string; bg: string; border: string }> = {
  packages:     { label: 'الباقات والعروض',        labelShort: 'باقات',      icon: Layers,         accent: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  rituals:      { label: 'المناسك والفتاوى',        labelShort: 'مناسك',      icon: Compass,        accent: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  pricing:      { label: 'الأسعار والدفع',          labelShort: 'أسعار',      icon: DollarSign,     accent: 'text-sky-700',    bg: 'bg-sky-50',     border: 'border-sky-200' },
  requirements: { label: 'الشروط والوثائق',         labelShort: 'وثائق',      icon: FileText,       accent: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200' },
  hotels:       { label: 'الفنادق والإقامة',         labelShort: 'فنادق',      icon: BookOpen,       accent: 'text-rose-700',   bg: 'bg-rose-50',    border: 'border-rose-200' },
  flights:      { label: 'الرحلات والطيران',        labelShort: 'طيران',      icon: Globe,          accent: 'text-cyan-700',   bg: 'bg-cyan-50',    border: 'border-cyan-200' },
  faq:          { label: 'أسئلة عامة',              labelShort: 'عامة',       icon: HelpCircle,     accent: 'text-slate-700',  bg: 'bg-slate-100',  border: 'border-slate-200' },
};

export default function AiKnowledgeManager({
  userRole,
  userName,
  userEmail = 'staff@southstreet.dz',
  allowedCategories,
  title = 'قاعدة معرفة صخر AI',
  subtitle = 'أضف الأسئلة والأجوبة التي سيستخدمها صخر تلقائياً عند إجابة المعتمرين'
}: AiKnowledgeManagerProps) {
  const [rules, setRules] = useState<AiKnowledgeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ruleCategory, setRuleCategory] = useState<'packages' | 'requirements' | 'rituals' | 'hotels' | 'flights' | 'pricing' | 'faq'>(
    allowedCategories && allowedCategories.length > 0 ? allowedCategories[0] : 'faq'
  );
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleKeywords, setRuleKeywords] = useState('');
  const [ruleResponse, setRuleResponse] = useState('');
  const [formMsg, setFormMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Collapsed tools
  const [webOpen, setWebOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  // Web Learner
  const [webUrl, setWebUrl] = useState('');
  const [webCategory, setWebCategory] = useState<'packages' | 'requirements' | 'rituals' | 'hotels' | 'flights' | 'pricing' | 'faq'>(
    allowedCategories && allowedCategories.length > 0 ? allowedCategories[0] : 'faq'
  );
  const [webLearning, setWebLearning] = useState(false);
  const [webMsg, setWebMsg] = useState('');

  // Live Test
  const [testPrompt, setTestPrompt] = useState('');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Rating & Model Answer (admin grading)
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [qualityRating, setQualityRating] = useState<'good' | 'less' | 'bad' | null>(null);
  const [modelAnswer, setModelAnswer] = useState<string>('');
  const [savingRating, setSavingRating] = useState(false);
  const [saveRatingMsg, setSaveRatingMsg] = useState<string>('');

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sakhr-knowledge');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, []);

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleTitle.trim() || !ruleResponse.trim() || !ruleKeywords.trim()) {
      setFormMsg('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    setSubmitting(true);
    setFormMsg('');
    try {
      const keywordsArray = ruleKeywords.split(/[,،]+/).map(k => k.trim()).filter(Boolean);
      const res = await fetch('/api/admin/sakhr-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: ruleCategory,
          title_ar: ruleTitle,
          keywords: keywordsArray,
          response_ar: ruleResponse,
          updatedBy: `${userName} (${userRole})`
        })
      });
      const data = await res.json();
      setSubmitting(false);
      if (res.ok) {
        setIsModalOpen(false);
        setRuleTitle('');
        setRuleKeywords('');
        setRuleResponse('');
        fetchRules();
      } else {
        setFormMsg(data.error || 'حدث خطأ أثناء الحفظ');
      }
    } catch {
      setSubmitting(false);
      setFormMsg('خطأ في الاتصال بالخادم');
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('هل تريد حذف هذه القاعدة؟')) return;
    try {
      const res = await fetch(`/api/admin/sakhr-knowledge?id=${id}`, { method: 'DELETE' });
      if (res.ok) setRules(prev => prev.filter(r => r.id !== id));
    } catch {}
  };

  const handleWebLearn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webUrl.trim() || !webUrl.startsWith('http')) {
      setWebMsg('يرجى إدخال رابط صالح يبدأ بـ http');
      return;
    }
    setWebLearning(true);
    setWebMsg('');
    try {
      const res = await fetch('/api/admin/sakhr-learn-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webUrl, category: webCategory })
      });
      const data = await res.json();
      setWebLearning(false);
      if (res.ok) {
        setWebMsg('success:تم استخراج المعرفة من الرابط وإضافتها بنجاح');
        setWebUrl('');
        fetchRules();
      } else {
        setWebMsg(`error:${data.error || 'تعذر قراءة الموقع'}`);
      }
    } catch {
      setWebLearning(false);
      setWebMsg('error:خطأ في الاتصال');
    }
  };

  const handleTestSakhr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPrompt.trim()) return;
    setTestLoading(true);
    setTestResponse(null);
    setQualityRating(null);
    setModelAnswer('');
    setSaveRatingMsg('');
    try {
      const res = await fetch('/api/ai/sakhr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: testPrompt })
      });
      const data = await res.json();
      setTestLoading(false);
      setTestResponse(data.text || 'لم تُستَرجع إجابة نصية.');
      // Auto-prefill model answer with current rule's response if one is selected
      if (selectedRuleId) {
        const found = rules.find(r => r.id === selectedRuleId);
        if (found) setModelAnswer(found.modelAnswer || found.response_ar || '');
      }
    } catch {
      setTestLoading(false);
      setTestResponse('حدث خطأ في اختبار صخر.');
    }
  };

  const handleSaveRating = async () => {
    if (!selectedRuleId) {
      setSaveRatingMsg('error:يرجى اختيار السؤال المرتبط بهذا الاختبار');
      return;
    }
    setSavingRating(true);
    setSaveRatingMsg('');
    try {
      const res = await fetch('/api/admin/sakhr-knowledge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRuleId,
          qualityRating: qualityRating ?? undefined,
          modelAnswer: modelAnswer.trim() || undefined
        })
      });
      const data = await res.json();
      setSavingRating(false);
      if (res.ok) {
        setSaveRatingMsg('success:تم حفظ التقييم والنموذج بنجاح ✓');
        fetchRules(); // refresh cards to show badge
      } else {
        setSaveRatingMsg(`error:${data.error || 'حدث خطأ أثناء الحفظ'}`);
      }
    } catch {
      setSavingRating(false);
      setSaveRatingMsg('error:خطأ في الاتصال بالخادم');
    }
  };

  const cats = allowedCategories || (Object.keys(CATEGORY_META) as any[]);

  const displayedRules = rules.filter(rule => {
    if (allowedCategories && !allowedCategories.includes(rule.category)) return false;
    if (selectedCategory !== 'all' && rule.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        rule.title_ar.toLowerCase().includes(q) ||
        rule.response_ar.toLowerCase().includes(q) ||
        rule.keywords.some(k => k.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const openModal = () => {
    setRuleTitle('');
    setRuleKeywords('');
    setRuleResponse('');
    setFormMsg('');
    setRuleCategory(cats[0] || 'faq');
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-5 text-right font-tajawal" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </span>
            {title}
          </h2>
          <p className="text-xs text-slate-500 mt-1 mr-10">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchRules}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            إضافة سؤال وجواب
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-slate-900">{rules.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">إجمالي القواعد</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-emerald-600">{rules.filter(r => r.is_active !== false).length}</p>
          <p className="text-xs text-slate-500 mt-0.5">مفعّلة</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-slate-700">{cats.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">أقسام</p>
        </div>
      </div>

      {/* ── Collapsible Tools ── */}
      <div className="space-y-2">

        {/* Web Scraper */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setWebOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-slate-400" />
              تدريب صخر من رابط ويب
            </span>
            {webOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {webOpen && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
              <p className="text-xs text-slate-500">أدخل رابط صفحة ويب (موقع رسمي، مقال، شروط...) وسيقوم صخر باستخراج محتواها تلقائياً.</p>
              <form onSubmit={handleWebLearn} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/page"
                  value={webUrl}
                  onChange={e => setWebUrl(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 bg-slate-50"
                  dir="ltr"
                />
                <select
                  value={webCategory}
                  onChange={e => setWebCategory(e.target.value as any)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 bg-slate-50 focus:outline-none focus:border-emerald-500"
                >
                  {cats.map((cat: string) => (
                    <option key={cat} value={cat}>{CATEGORY_META[cat]?.label || cat}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={webLearning}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {webLearning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                  {webLearning ? 'جاري القراءة...' : 'قراءة وتدريب'}
                </button>
              </form>
              {webMsg && (
                <p className={`text-xs font-semibold px-3 py-2 rounded-lg ${webMsg.startsWith('success:') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {webMsg.replace(/^(success|error):/, '')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Live Test */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setTestOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-slate-400" />
              اختبار إجابات صخر مباشرة
            </span>
            {testOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {testOpen && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-4">

              {/* Instruction */}
              <p className="text-xs text-slate-500">
                اكتب سؤالاً لتجربة كيف سيجيب صخر على المعتمرين — ثم قيّم جودة الإجابة وأضف النموذج المثالي إن احتجت.
              </p>

              {/* Rule Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5" />
                  السؤال المرتبط بهذا الاختبار (لحفظ التقييم)
                </label>
                <select
                  value={selectedRuleId}
                  onChange={e => {
                    setSelectedRuleId(e.target.value);
                    setSaveRatingMsg('');
                    if (e.target.value) {
                      const found = rules.find(r => r.id === e.target.value);
                      if (found) setModelAnswer(found.modelAnswer || found.response_ar || '');
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 bg-slate-50 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">— اختر السؤال المرتبط (اختياري) —</option>
                  {(allowedCategories ? rules.filter(r => allowedCategories.includes(r.category)) : rules).map(r => (
                    <option key={r.id} value={r.id}>{r.title_ar}</option>
                  ))}
                </select>
              </div>

              {/* Test Input */}
              <form onSubmit={handleTestSakhr} className="flex gap-2">
                <input
                  type="text"
                  placeholder="مثال: ما هي خطوات الإحرام؟"
                  value={testPrompt}
                  onChange={e => setTestPrompt(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 bg-slate-50"
                />
                <button
                  type="submit"
                  disabled={testLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {testLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  اختبار
                </button>
              </form>

              {/* Sakhr's Response */}
              {testResponse && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                    <p className="text-[10px] font-bold text-emerald-600 mb-1.5">إجابة صخر:</p>
                    {testResponse}
                  </div>

                  {/* ── Rating Bar ── */}
                  <div className="bg-gradient-to-l from-slate-50 to-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <p className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      تقييم جودة إجابة صخر:
                    </p>

                    {/* 3-Button Rating */}
                    <div className="flex gap-2">
                      {/* Good */}
                      <button
                        type="button"
                        onClick={() => setQualityRating('good')}
                        className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-bold transition cursor-pointer ${
                          qualityRating === 'good'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm shadow-emerald-100'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50/40'
                        }`}
                      >
                        <ThumbsUp className={`w-5 h-5 ${qualityRating === 'good' ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span>جيدة</span>
                        <span className="text-[10px] font-normal opacity-70">إجابة صحيحة ومكتملة</span>
                      </button>

                      {/* Less / Acceptable */}
                      <button
                        type="button"
                        onClick={() => setQualityRating('less')}
                        className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-bold transition cursor-pointer ${
                          qualityRating === 'less'
                            ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm shadow-amber-100'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-amber-300 hover:bg-amber-50/40'
                        }`}
                      >
                        <Minus className={`w-5 h-5 ${qualityRating === 'less' ? 'text-amber-600' : 'text-slate-400'}`} />
                        <span>مقبولة</span>
                        <span className="text-[10px] font-normal opacity-70">يمكن تحسينها</span>
                      </button>

                      {/* Bad / Weak */}
                      <button
                        type="button"
                        onClick={() => setQualityRating('bad')}
                        className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-bold transition cursor-pointer ${
                          qualityRating === 'bad'
                            ? 'bg-red-50 border-red-500 text-red-700 shadow-sm shadow-red-100'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-red-300 hover:bg-red-50/40'
                        }`}
                      >
                        <ThumbsDown className={`w-5 h-5 ${qualityRating === 'bad' ? 'text-red-600' : 'text-slate-400'}`} />
                        <span>ضعيفة</span>
                        <span className="text-[10px] font-normal opacity-70">إجابة غير صحيحة</span>
                      </button>
                    </div>

                    {/* Model Answer */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5 text-violet-500" />
                        النموذج المثالي (الإجابة الصحيحة كما يجب أن تكون):
                      </label>
                      <textarea
                        rows={4}
                        placeholder="اكتب هنا الإجابة النموذجية التي يجب أن يقدمها صخر على هذا السؤال..."
                        value={modelAnswer}
                        onChange={e => setModelAnswer(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:border-violet-400 transition leading-relaxed resize-none"
                      />
                    </div>

                    {/* Save Button */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSaveRating}
                        disabled={savingRating || (!qualityRating && !modelAnswer.trim())}
                        className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-40 shadow-sm"
                      >
                        {savingRating
                          ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> جاري الحفظ...</>
                          : <><Save className="w-3.5 h-3.5" /> حفظ التقييم والنموذج</>
                        }
                      </button>

                      {saveRatingMsg && (
                        <span className={`text-[11px] font-semibold ${
                          saveRatingMsg.startsWith('success:') ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {saveRatingMsg.replace(/^(success|error):/, '')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث في الأسئلة..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-8 pl-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 bg-white"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
            }`}
          >
            الكل ({rules.length})
          </button>
          {cats.map((cat: string) => {
            const meta = CATEGORY_META[cat];
            const count = rules.filter(r => r.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  selectedCategory === cat
                    ? `${meta?.bg || 'bg-slate-100'} ${meta?.accent || 'text-slate-700'} ${meta?.border || 'border-slate-200'} border`
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
                }`}
              >
                {meta?.labelShort || cat} {count > 0 && <span className="opacity-60">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Rules Grid ── */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-slate-300" />
          جاري تحميل قواعد المعرفة...
        </div>
      ) : displayedRules.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 border-dashed rounded-2xl">
          <Sparkles className="w-8 h-8 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-400">لا توجد قواعد معرفة</p>
          <p className="text-xs text-slate-400 mt-1">ابدأ بإضافة أول سؤال وجواب لتدريب صخر</p>
          <button
            onClick={openModal}
            className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
          >
            + إضافة أول قاعدة
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {displayedRules.map(rule => {
            const meta = CATEGORY_META[rule.category] || CATEGORY_META.faq;
            const CategoryIcon = meta.icon;
            return (
              <div
                key={rule.id}
                className={`bg-white border rounded-xl p-4 hover:shadow-sm transition-all flex flex-col gap-3 ${
                  rule.qualityRating === 'good'  ? 'border-emerald-200 hover:border-emerald-300' :
                  rule.qualityRating === 'less'  ? 'border-amber-200  hover:border-amber-300'   :
                  rule.qualityRating === 'bad'   ? 'border-red-200    hover:border-red-300'     :
                  'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${meta.bg} ${meta.accent} ${meta.border} border`}>
                      <CategoryIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                    {/* Quality Rating Badge */}
                    {rule.qualityRating === 'good' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ThumbsUp className="w-2.5 h-2.5" /> جيدة
                      </span>
                    )}
                    {rule.qualityRating === 'less' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Minus className="w-2.5 h-2.5" /> مقبولة
                      </span>
                    )}
                    {rule.qualityRating === 'bad' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                        <ThumbsDown className="w-2.5 h-2.5" /> ضعيفة
                      </span>
                    )}
                    {/* Model Answer Indicator */}
                    {rule.modelAnswer && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                        <ClipboardList className="w-2.5 h-2.5" /> نموذج متاح
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-slate-300 hover:text-red-500 p-1 rounded-lg transition cursor-pointer shrink-0"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Question */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <MessageSquareText className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">السؤال</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 leading-snug">{rule.title_ar}</p>
                </div>

                {/* Keywords */}
                {rule.keywords.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">كلمات مشغِّلة</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {rule.keywords.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono rounded-md">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Answer */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">إجابة صخر</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-2.5 border border-slate-100 whitespace-pre-line line-clamp-4">
                    {rule.response_ar}
                  </p>
                </div>

                {/* Model Answer (if set) */}
                {rule.modelAnswer && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <ClipboardList className="w-3 h-3 text-violet-500 shrink-0" />
                      <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wide">النموذج المثالي</span>
                    </div>
                    <p className="text-xs text-violet-800 leading-relaxed bg-violet-50 rounded-lg p-2.5 border border-violet-100 whitespace-pre-line line-clamp-3">
                      {rule.modelAnswer}
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                  <span>بواسطة: {rule.updatedBy || 'الإدارة'}</span>
                  <span>{new Date(rule.updatedAt).toLocaleDateString('ar-DZ')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Q&A Modal ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Edit3 className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">إضافة سؤال وجواب</h3>
                  <p className="text-[11px] text-slate-500">يُضاف فوراً لذاكرة صخر AI</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-light leading-none cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddRule} className="p-6 space-y-4 text-xs">

              {formMsg && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formMsg}
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">القسم</label>
                <select
                  value={ruleCategory}
                  onChange={e => setRuleCategory(e.target.value as any)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-900 bg-slate-50 focus:outline-none focus:border-emerald-500 transition"
                >
                  {cats.map((cat: string) => (
                    <option key={cat} value={cat}>{CATEGORY_META[cat]?.label || cat}</option>
                  ))}
                </select>
              </div>

              {/* Question */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  السؤال أو الموضوع
                </label>
                <input
                  type="text"
                  placeholder="مثال: كيفية الإحرام من الطائرة"
                  value={ruleTitle}
                  onChange={e => setRuleTitle(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 bg-slate-50 focus:outline-none focus:border-emerald-500 transition"
                  required
                />
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الكلمات المشغِّلة
                  <span className="font-normal text-slate-400 mr-1">(مفصولة بفواصل)</span>
                </label>
                <input
                  type="text"
                  placeholder="إحرام، طائرة، ميقات، نية"
                  value={ruleKeywords}
                  onChange={e => setRuleKeywords(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 bg-slate-50 focus:outline-none focus:border-emerald-500 transition"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  عندما يذكر المستخدم أي كلمة من هذه القائمة، سيجيب صخر بالإجابة أدناه تلقائياً.
                </p>
              </div>

              {/* Answer */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  إجابة صخر
                </label>
                <textarea
                  rows={5}
                  placeholder="اكتب الإجابة الدقيقة التي سيقدمها صخر..."
                  value={ruleResponse}
                  onChange={e => setRuleResponse(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 bg-slate-50 focus:outline-none focus:border-emerald-500 transition leading-relaxed resize-none"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-sm cursor-pointer text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> جاري الحفظ...</>
                    : <><CheckCircle className="w-3.5 h-3.5" /> حفظ وتفعيل</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
