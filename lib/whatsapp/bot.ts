/**
 * Sakhr on WhatsApp.
 *
 * Security model: a phone number is weaker proof than password + security key,
 * so WhatsApp never changes anything. Sakhr answers with the public tools
 * (programs, hotels, prices, guide, agency info). On top of that:
 *   - a known client (account or booking with this phone) hears about their own bookings;
 *   - a known team member is greeted by name and gets a short read-only work summary.
 * Writing to "موظف" hands the conversation to the team (bot off, shown in the inbox).
 */
import Groq, { toFile } from 'groq-sdk';
import { getSqliteDb } from '../sqlite';
import { runSakhr, type ChatTurn } from '../sakhr/agent';
import { toolGetAgencySettings } from '../ai-tools';
import { LOGIN_ROLE_LABELS, normalizeLoginRole } from '../roles';
import { downloadMedia, markReadAndTyping, sendText, toWhatsAppText, whatsappConfig } from './cloud';
import { conversation, messages, normalizePhone, saveMessage, setBotEnabled } from './store';
import { getBrand } from '../brand-server';

export type IncomingMessage = {
  id: string;
  from: string;
  profileName?: string;
  type: string;
  text?: string;
  audioId?: string;
};

const HANDOFF = /^(موظف|موضف|مستشار|انسان|إنسان|agent|human|conseiller|عامل)$/i;
const BOT_BACK = /^(صخر|sakhr|بوت|bot)$/i;
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

function limited(phone: string): boolean {
  const now = Date.now();
  const recent = (hits.get(phone) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(phone, recent);
  return recent.length > 20;
}

type Known = { userId: string; name: string; role: string; isStaff: boolean };

/** Finds the account (or booking) that uses this phone number. */
function identify(phone: string): Known | null {
  const db = getSqliteDb();
  const users = db.prepare('SELECT id, name, role, phone, status, loginEnabled FROM users').all() as any[];
  const user = users.find((u) => u.phone && normalizePhone(String(u.phone)) === phone && u.loginEnabled !== 0);
  if (!user) return null;
  const role = normalizeLoginRole(user.role);
  return { userId: String(user.id), name: String(user.name || ''), role, isStaff: role !== 'PILGRIM_USER' };
}

const money = (n: unknown) => `${Math.round(Number(n) || 0).toLocaleString('fr-DZ')} دج`;

/** Read-only facts Sakhr may use for this person. Never secrets, never other people's data. */
function factsFor(phone: string, known: Known | null): string {
  const db = getSqliteDb();
  const lines: string[] = [];
  if (known?.isStaff) {
    const rows = db.prepare('SELECT reservation_status, payment_status FROM reservations').all() as any[];
    const pending = rows.filter((r) => String(r.reservation_status).toUpperCase().includes('PENDING')).length;
    const unpaid = rows.filter((r) => String(r.payment_status).toUpperCase() !== 'PAID').length;
    lines.push(
      `المتحدث عضو في فريق الوكالة: ${known.name} (${LOGIN_ROLE_LABELS[known.role as keyof typeof LOGIN_ROLE_LABELS] || known.role}).`,
      `ملخص العمل (كل الحجوزات المسجلة، وليس اليوم فقط): المجموع ${rows.length}، بانتظار المراجعة ${pending}، غير مسدد بالكامل ${unpaid}.`,
      'عبر واتساب لا يمكن تعديل أي شيء؛ للإجراءات (قبول طلب، دفع، حسابات) وجّهه إلى لوحة التحكم في التطبيق.'
    );
    return lines.join('\n');
  }
  const all = db.prepare('SELECT reservation_number, customer_id, customer_phone, customer_name, package_name, total_price, paid_amount, payment_status, reservation_status FROM reservations').all() as any[];
  const mine = all.filter((r) => (known && r.customer_id === known.userId) || (r.customer_phone && normalizePhone(String(r.customer_phone)) === phone));
  if (known) lines.push(`المتحدث معتمر مسجّل في التطبيق: ${known.name}.`);
  if (mine.length) {
    lines.push('حجوزاته (يمكنك ذكرها له فقط):');
    for (const r of mine.slice(0, 5)) {
      const remaining = (Number(r.total_price) || 0) - (Number(r.paid_amount) || 0);
      lines.push(`- ${r.reservation_number}: ${r.package_name} — الحالة ${r.reservation_status}، المدفوع ${money(r.paid_amount)}، المتبقي ${money(remaining)}.`);
    }
  }
  return lines.join('\n');
}

async function transcribe(audioId: string): Promise<string> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) return '';
  const media = await downloadMedia(audioId);
  if (!media) return '';
  const groq = new Groq({ apiKey: key, timeout: 20_000, maxRetries: 1 });
  const result = await groq.audio.transcriptions.create({
    file: await toFile(media.data, media.mime.includes('mp4') ? 'voice.m4a' : 'voice.ogg'),
    model: 'whisper-large-v3-turbo',
    temperature: 0,
  });
  return String(result.text || '').trim();
}

async function reply(to: string, text: string) {
  const id = await sendText(to, text);
  saveMessage(to, { id: id || `out_${Date.now()}`, direction: 'out', author: 'bot', body: text });
}

/** Handles one incoming WhatsApp message end to end. */
export async function handleIncoming(msg: IncomingMessage, origin: string): Promise<void> {
  if (!whatsappConfig()) return;
  const phone = normalizePhone(msg.from);
  const known = identify(phone);

  let text = (msg.text || '').trim();
  if (msg.type === 'audio' && msg.audioId) {
    text = await transcribe(msg.audioId).catch(() => '');
    if (!text) {
      saveMessage(phone, { id: msg.id, direction: 'in', author: 'customer', body: '🎤 رسالة صوتية' }, msg.profileName, known?.userId);
      await reply(phone, 'لم أتمكن من سماع الرسالة الصوتية بوضوح، هل يمكنك كتابة سؤالك؟');
      return;
    }
  }
  const stored = text ? (msg.type === 'audio' ? `🎤 ${text}` : text) : `[${msg.type}]`;
  // Same message delivered twice by WhatsApp: already handled.
  if (!saveMessage(phone, { id: msg.id, direction: 'in', author: 'customer', body: stored }, msg.profileName, known?.userId)) return;

  const conv = conversation(phone);
  if (HANDOFF.test(text)) {
    if (conv) setBotEnabled(conv.phoneHash, false);
    await reply(phone, 'تمّ تحويل محادثتك إلى فريق الوكالة، سيردّ عليك أحد الموظفين قريباً إن شاء الله. 🌿\nلإعادة المساعد الذكي اكتب: صخر');
    return;
  }
  if (BOT_BACK.test(text) && conv && !conv.botEnabled) {
    setBotEnabled(conv.phoneHash, true);
    await reply(phone, 'أهلاً بك من جديد، أنا صخر مساعد الوكالة الذكي. كيف أساعدك؟');
    return;
  }
  if (conv && !conv.botEnabled) return; // a team member is handling this conversation
  if (!text) {
    await reply(phone, 'أستقبل الرسائل النصية والصوتية فقط حالياً. كيف أساعدك؟');
    return;
  }
  if (limited(phone)) return;

  await markReadAndTyping(msg.id);

  const history: ChatTurn[] = (conv ? messages(conv.phoneHash, 14) : [])
    .filter((m) => m.id !== msg.id)
    .slice(-10)
    .map((m) => ({ role: m.direction === 'out' ? 'model' : 'user', text: m.body.slice(0, 1200) }));

  const facts = factsFor(phone, known);
  const channelNote = [
    '[ملاحظة للمساعد — لا تذكرها للمستخدم]',
    'أنت تردّ عبر واتساب: اكتب ردوداً قصيرة وواضحة، بدون جداول، وضع روابط كاملة تبدأ بـ ' + origin + ' عند الحاجة (مثل ' + origin + '/packages أو ' + origin + '/book أو ' + origin + '/guide).',
    'لا تستطيع فتح صفحات أو جداول أو عرض رسوم بيانية هنا، ولا تنفيذ أي إجراء أو حجز (لا توجد بطاقات تأكيد في واتساب): للحجز أرسل له رابط ' + origin + '/book. إذا طلب التحدث مع موظف فليكتب: موظف.',
    facts,
    '[نهاية الملاحظة]',
  ].filter(Boolean).join('\n');

  const agency = toolGetAgencySettings();
  try {
    const result = await runSakhr({
      // Public tools only (see the security model above): an unauthenticated request.
      ctx: { req: new Request(`${origin}/api/ai/sakhr`, { headers: { 'user-agent': 'WhatsApp-Sakhr' } }), role: 'ANON' },
      userName: known?.name || msg.profileName,
      agency: {
        name: agency.agency_name || getBrand().agency_name,
        phone: agency.phone,
        email: agency.email,
        address: [agency.address, agency.city].filter(Boolean).join('، '),
      },
      history,
      message: `${channelNote}\n\n${text}`,
    });
    const links = result.clientActions
      .filter((a): a is { type: 'navigate'; href: string } => a.type === 'navigate')
      .map((a) => `${origin}${a.href}`);
    const body = [toWhatsAppText(result.reply || '', origin), ...links].filter(Boolean).join('\n\n');
    await reply(phone, body || 'كيف يمكنني مساعدتك؟');
  } catch (err) {
    console.error('[whatsapp] sakhr failed', (err as Error)?.message);
    await reply(phone, 'عذراً، المساعد مشغول الآن. يمكنك المحاولة بعد قليل، أو كتابة «موظف» للتحدث مع فريق الوكالة.');
  }
}
