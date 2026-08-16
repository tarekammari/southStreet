import { dbGetPackageById, dbGetPackages } from './db';
import { Package, PackagePrice } from '@/types';

export interface PriceCalculationResult {
  valid: boolean;
  total_amount: number;
  currency: string;
  unit_price: number;
  room_type: string;
  travelers_count: number;
  message?: string;
}

export interface AvailabilityResult {
  available: boolean;
  remaining_seats: number;
  total_capacity: number;
  reserved_seats: number;
  status: string;
  message: string;
}

export interface EscalationCheckResult {
  should_escalate: boolean;
  reason?: string;
  escalation_message?: string;
}

export class BusinessRulesService {
  /**
   * Price Rule Engine: Calculate total booking price based on DB pricing table
   */
  static calculatePrice(
    packageId: string,
    roomType: 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'QUAD' = 'QUAD',
    travelersCount: number = 1
  ): PriceCalculationResult {
    const pkg = dbGetPackageById(packageId);
    if (!pkg) {
      return {
        valid: false,
        total_amount: 0,
        currency: 'DZD',
        unit_price: 0,
        room_type: roomType,
        travelers_count: travelersCount,
        message: 'الباقة المطلوبة غير متوفرة بالنظام.'
      };
    }

    const priceEntry = pkg.prices.find(p => p.room_type === roomType) || pkg.prices[0];
    const unitPrice = priceEntry ? priceEntry.amount : 215000;
    const totalAmount = unitPrice * Math.max(1, travelersCount);

    return {
      valid: true,
      total_amount: totalAmount,
      currency: priceEntry ? priceEntry.currency : 'DZD',
      unit_price: unitPrice,
      room_type: roomType,
      travelers_count: travelersCount
    };
  }

  /**
   * Availability Rule Engine: Check database real-time seat status
   */
  static checkAvailability(packageId: string, requestedSeats: number = 1): AvailabilityResult {
    const pkg = dbGetPackageById(packageId);
    if (!pkg) {
      return {
        available: false,
        remaining_seats: 0,
        total_capacity: 0,
        reserved_seats: 0,
        status: 'NOT_FOUND',
        message: 'الباقة المحددة غير موجودة بالنظام.'
      };
    }

    const isAvailable = pkg.available >= requestedSeats && pkg.status === 'PUBLISHED';
    return {
      available: isAvailable,
      remaining_seats: pkg.available,
      total_capacity: pkg.capacity,
      reserved_seats: pkg.reserved,
      status: pkg.status,
      message: isAvailable
        ? `متوفر حالياً ${pkg.available} مقعد حقيقي للباقة ${pkg.name}.`
        : `عذراً، المقاعد المتبقية (${pkg.available}) غير كافية لطلبك (${requestedSeats} مقاعد).`
    };
  }

  /**
   * Document Verification Rules (Biometric Passport & Expiry Rules)
   */
  static validatePassport(expiryDateStr: string): { valid: boolean; reason?: string } {
    if (!expiryDateStr || expiryDateStr === 'PENDING_UPLOAD') {
      return { valid: false, reason: 'جواز السفر غير مرفق أو ينتظر التحميل.' };
    }

    const expiry = new Date(expiryDateStr);
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

    if (expiry < sixMonthsFromNow) {
      return {
        valid: false,
        reason: 'صلاحية جواز السفر أقل من 6 أشهر، يرجى تجديد الجواز البيومتري قبل السفر.'
      };
    }

    return { valid: true };
  }

  /**
   * Human Escalation Trigger Rules
   */
  static evaluateEscalation(prompt: string, confidence: number = 1.0): EscalationCheckResult {
    const p = (prompt || '').toLowerCase();

    // Trigger 1: Explicit Request for Human Support
    if (
      p.includes('نهدر مع موظف') ||
      p.includes('تحدث مع موظف') ||
      p.includes('مستشار') ||
      p.includes('إنسان') ||
      p.includes('human') ||
      p.includes('مسؤول الوكالة')
    ) {
      return {
        should_escalate: true,
        reason: 'طلب التحدث المباشر مع مستشار الوكالة',
        escalation_message: 'سأقوم بتحويل طلبك فوراً لأحد مستشاري ساوث ستريت المباشرين للمتابعة معك.'
      };
    }

    // Trigger 2: Sensitive Financial or Legal Disputes
    if (
      p.includes('استرجاع') ||
      p.includes('إلغاء الحجز') ||
      p.includes('مشكلة في الدفع') ||
      p.includes('نزاع') ||
      p.includes('شكوى') ||
      p.includes('تعويض')
    ) {
      return {
        should_escalate: true,
        reason: 'استفسار حساس يتعلق بالإلغاء، الاسترجاع أو المشاكل المالية',
        escalation_message: 'نظرًا لأن استفسارك يخص الإجراءات المالية والإلغاء، سأحيل طلبك لقسم المالية والحجوزات بالوكالة.'
      };
    }

    // Trigger 3: Low AI Confidence
    if (confidence < 0.6) {
      return {
        should_escalate: true,
        reason: 'انخفاض مستوى ثقة الذكاء الاصطناعي الإرشادي',
        escalation_message: 'لتوفير أدق التفاصيل وتفادي أي خطأ، سيتواصل معك أحد موظفي الوكالة المختصين.'
      };
    }

    return { should_escalate: false };
  }

  /**
   * Official Hajj vs Agency Distinction Rule
   */
  static getHajjInfoType(topic: string): 'OFFICIAL_REQUIREMENT' | 'AGENCY_INFORMATION' {
    const t = topic.toLowerCase();
    if (
      t.includes('قرعة') ||
      t.includes('الديوان الوطني') ||
      t.includes('تلقيح') ||
      t.includes('تأشيرة رسمية') ||
      t.includes('سن الحجاج')
    ) {
      return 'OFFICIAL_REQUIREMENT';
    }
    return 'AGENCY_INFORMATION';
  }
}
