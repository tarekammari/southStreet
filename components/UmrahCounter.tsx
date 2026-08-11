'use client';

import React, { useState } from 'react';
import { RotateCcw, Volume2, Footprints, Sparkles } from 'lucide-react';
import KaabaIcon from '@/components/icons/KaabaIcon';

const RITUAL_DUAS: Record<'tawaf' | 'sai', string[]> = {
  tawaf: [
    'الشوط الأول: "اللَّهُمَّ إِيمَانًا بِكَ، وَتَصْدِيقًا بِكِتَابِكَ، وَوَفَاءً بِعَهْدِكَ، وَاتِّبَاعًا لِسُنَّةِ نَبِيِّكَ مُحَمَّدٍ ﷺ"',
    'الشوط الثاني: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ"',
    'الشوط الثالث: "اللَّهُمَّ اجْعَلْهُ حَجًّا مَبْرُورًا، وَذَنْبًا مَغْفُورًا، وَسَعْيًا مَشْكُورًا"',
    'الشوط الرابع: "اللَّهُمَّ اغْفِرْ وَارْحَمْ، وَاعْفُ عَمَّا تَعْلَمْ، وَأَنْتَ الأَعَزُّ الأَكْرَمُ"',
    'الشوط الخامس: "اللَّهُمَّ قَنِّعْنِي بِمَا رَزَقْتَنِي، وَبَارِكْ لِي فِيهِ، وَاخْلُفْ عَلَى كُلِّ غَائِبَةٍ لِي بِخَيْرٍ"',
    'الشوط السادس: "اللَّهُمَّ إِنِّي أَسْأَلُكَ عَفْوَكَ وَعَافِيَتَكَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي"',
    'الشوط السابع: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ - أتممت الطواف بحمد الله"'
  ],
  sai: [
    'الشوط الأول (من الصفا إلى المروة): "إِنَّ الصَّفَا وَالْمَروَةَ مِن شَعَائِرِ اللَّهِ.. أَبْدَأُ بِمَا بَدَأَ اللَّهُ بِهِ"',
    'الشوط الثاني (من المروة إلى الصفا): "لا إِلَهَ إِلا اللَّهُ وَحْدَهُ لا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ"',
    'الشوط الثالث (من الصفا إلى المروة): "رَبِّ اغْفِرْ وَارْحَمْ إِنَّكَ أَنْتَ الأَعَزُّ الأَكْرَمُ"',
    'الشوط الرابع (من المروة إلى الصفا): "اللَّهُمَّ إِنِّي أَسْأَلُكَ المُوجِبَاتِ لِرَحْمَتِكَ وَعَزَائِمِ مَغْفِرَتِكَ"',
    'الشوط الخامس (من الصفا إلى المروة): "اللَّهُمَّ اهْدِنِي فِيمَنْ هَدَيْتَ، وَعَافِنِي فِيمَنْ عَافَيْتَ"',
    'الشوط السادس (من المروة إلى الصفا): "اللَّهُمَّ ثَبِّتْ قَلْبِي عَلَى دِينِكَ وَأَلْهِمْنِي رُشْدِي"',
    'الشوط السابع (من الصفا إلى المروة): "اللَّهُمَّ تَقَبَّلْ مِنَّا سَعْيَنَا وَاعْفُ عَنَّا إِنَّكَ أَنْتَ السَّمِيعُ الْعَلِيمُ - اكتمل السعي!"'
  ]
};

export default function UmrahCounter() {
  const [mode, setMode] = useState<'tawaf' | 'sai'>('tawaf');
  const [count, setCount] = useState<number>(0);

  const triggerHaptics = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([60, 40, 60]);
    }
    playTone(850, 0.08);
  };

  const playTone = (freq = 600, duration = 0.1) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // AudioContext fallback
    }
  };

  const handleIncrement = () => {
    if (count < 7) {
      setCount((prev) => prev + 1);
      triggerHaptics();
    }
  };

  const handleReset = () => {
    setCount(0);
    playTone(500, 0.15);
  };

  const currentDua = count > 0 && count <= 7
    ? RITUAL_DUAS[mode][count - 1]
    : 'اضغط بأصبعك على القرص المضيء بعد كل دورة حول الكعبة المشرفة أو بين الصفا والمروة لقراءة أدعية الشوط المباشرة.';

  return (
    <div className="max-w-xl mx-auto text-center space-y-5 animate-fade-in p-2">
      <div>
        <div className="inline-flex items-center gap-2 bg-emerald-deep text-gold-main px-4 py-1.5 rounded-full border border-gold-main text-xs font-bold mb-2">
          <Sparkles className="w-4 h-4 text-gold-main" />
          مساعد العمرة والمناسك التفاعلي
        </div>
        <h2 className="text-2xl font-black text-slate-900 font-ruqaa">دليل وعدّاد مناسك العمرة</h2>
        <p className="text-slate-600 text-xs mt-1">مرافقة وتوثيق الأشواط السبعة للطواف والسعي مع الأدعية المأثورة</p>
      </div>

      <div className="bg-white border-2 border-gold-main rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex justify-center gap-3">
          <button
            onClick={() => { setMode('tawaf'); setCount(0); }}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              mode === 'tawaf'
                ? 'bg-emerald-main text-white shadow-md scale-105'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <KaabaIcon className="w-4 h-4 text-gold-main" />
            عداد الطواف (7 أشواط)
          </button>
          <button
            onClick={() => { setMode('sai'); setCount(0); }}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              mode === 'sai'
                ? 'bg-gradient-to-r from-gold-dark to-gold-main text-slate-950 shadow-md scale-105'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Footprints className="w-4 h-4" />
            عداد السعي (7 أشواط)
          </button>
        </div>

        <div className="py-2">
          <div className="counter-dial animate-pulse-glow" onClick={handleIncrement}>
            <div className="counter-number">{count}</div>
            <div className="counter-label">
              {count === 0 ? 'اضغط لتسجيل الشوط' : `الشوط ${count} من 7 (${mode === 'tawaf' ? 'طواف' : 'سعي'})`}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 font-bold">
            {count < 7 ? 'اضغط بلمسة واحدة بعد إتمام كل دورة' : '🎉 تم إكمال الأشواط السبعة بنجاح! تقبل الله طاعتكم.'}
          </p>
        </div>

        <div className="bg-slate-900 border border-gold-main/50 rounded-xl p-4 text-right space-y-2 shadow-inner">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-gold-main flex items-center gap-1.5">
              <span>📖</span> دعاء وقراءة الشوط المباشر:
            </h4>
            <button
              onClick={() => playTone(950, 0.2)}
              className="text-gold-main hover:text-white p-1 rounded transition-colors"
              title="استماع للتسميع الصوتي"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm font-amiri text-white leading-relaxed pt-1">
            {currentDua}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleReset}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            إعادة ضبط العداد
          </button>

          <span className="text-[11px] font-bold text-emerald-main bg-emerald-soft px-3 py-1 rounded-full border border-emerald-light">
            تنبيه اهتزاز هاتف مفعّل ●
          </span>
        </div>
      </div>
    </div>
  );
}
