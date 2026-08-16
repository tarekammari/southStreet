import {
  dbGetPackages, dbGetPackageById, dbGetSeasons, dbGetHotels,
  dbCreateReservation, dbGetMediaAssets, dbGetAgencySettings
} from '../db';
import { BusinessRulesService } from '../business-rules';
import { Package, Hotel, Season, AiAction, AiCard, MediaAsset } from '@/types';

export interface ToolCallResult {
  tool_name: string;
  success: boolean;
  result_text: string;
  actions?: AiAction[];
  cards?: AiCard[];
  media?: MediaAsset[];
  map?: { title: string; latitude: number; longitude: number };
  escalated?: boolean;
}

export class AiToolExecutor {
  /**
   * Execute controlled tools requested by Sakhr AI or intent matcher
   */
  static executeTool(name: string, args: Record<string, any> = {}): ToolCallResult {
    switch (name) {
      case 'search_packages':
        return this.searchPackages(args);
      case 'get_package':
        return this.getPackage(args.package_id);
      case 'compare_packages':
        return this.comparePackages(args.package_ids);
      case 'check_availability':
        return this.checkAvailability(args.package_id, args.seats || 1);
      case 'get_price':
        return this.getPrice(args.package_id, args.room_type, args.adults || 1);
      case 'get_current_season':
        return this.getCurrentSeason();
      case 'search_hotels':
        return this.searchHotels(args.city);
      case 'create_reservation':
        return this.createReservation(args);
      case 'navigate_to':
        return this.navigateTo(args.page, args.filters);
      case 'open_login':
        return this.openLogin();
      case 'show_media':
        return this.showMedia(args.entity_id, args.type);
      case 'show_map':
        return this.showMap(args.title, args.lat, args.lng);
      case 'transfer_to_human':
        return this.transferToHuman(args.reason);
      default:
        return {
          tool_name: name,
          success: false,
          result_text: `الأداة ${name} غير معرفة بالنظام.`
        };
    }
  }

  private static searchPackages(args: Record<string, any>): ToolCallResult {
    const pkgs = dbGetPackages();
    let filtered = pkgs.filter(p => p.published);

    if (args.type) {
      filtered = filtered.filter(p => p.type.toLowerCase() === args.type.toLowerCase());
    }
    if (args.max_budget) {
      filtered = filtered.filter(p => {
        const minPrice = Math.min(...p.prices.map(pr => pr.amount));
        return minPrice <= args.max_budget;
      });
    }

    const cards: AiCard[] = filtered.map(p => ({
      type: 'package',
      data: p
    }));

    const resultSummary = filtered.length > 0
      ? `تم العثور على ${filtered.length} عروض معتمدة لدى الوكالة.`
      : 'لم نجد عروضاً تتطابق تماماً مع معايير البحث، يرجى الاستفسار عن باقات أوت أو رمضان المتاحة.';

    return {
      tool_name: 'search_packages',
      success: true,
      result_text: resultSummary,
      cards: cards,
      actions: [
        {
          type: 'navigate',
          target: 'packages',
          filters: args
        }
      ]
    };
  }

  private static getPackage(packageId: string): ToolCallResult {
    const pkg = dbGetPackageById(packageId);
    if (!pkg) {
      return {
        tool_name: 'get_package',
        success: false,
        result_text: 'الباقة المحددة غير موجودة بالنظام.'
      };
    }

    return {
      tool_name: 'get_package',
      success: true,
      result_text: `تفاصيل الباقة: ${pkg.name} - الإقامة بمكة: ${pkg.makkah_hotel_name} (${pkg.makkah_hotel_dist}).`,
      cards: [{ type: 'package', data: pkg }],
      actions: [{ type: 'select_package', package_id: pkg.package_id }]
    };
  }

  private static comparePackages(packageIds?: string[]): ToolCallResult {
    const allPkgs = dbGetPackages();
    let targetPkgs = allPkgs.filter(p => p.published);
    if (packageIds && packageIds.length > 0) {
      targetPkgs = allPkgs.filter(p => packageIds.includes(p.package_id));
    }

    return {
      tool_name: 'compare_packages',
      success: true,
      result_text: `مقارنة بين ${targetPkgs.length} باقات معتمدة.`,
      cards: [{ type: 'comparison', data: targetPkgs }],
      actions: [{ type: 'compare' }]
    };
  }

  private static checkAvailability(packageId: string, requestedSeats: number = 1): ToolCallResult {
    const check = BusinessRulesService.checkAvailability(packageId, requestedSeats);
    const pkg = dbGetPackageById(packageId);

    return {
      tool_name: 'check_availability',
      success: check.available,
      result_text: check.message,
      cards: pkg ? [{ type: 'package', data: pkg }] : []
    };
  }

  private static getPrice(
    packageId: string,
    roomType: 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'QUAD' = 'QUAD',
    adults: number = 1
  ): ToolCallResult {
    const calc = BusinessRulesService.calculatePrice(packageId, roomType, adults);
    const pkg = dbGetPackageById(packageId);

    return {
      tool_name: 'get_price',
      success: calc.valid,
      result_text: calc.valid
        ? `السعر المؤكد للباقة (${pkg?.name}) للغرفة ${roomType} لعدد ${adults} معتمر هو: ${calc.total_amount.toLocaleString()} ${calc.currency}.`
        : calc.message || 'السعر غير متاح حالياً.',
      cards: pkg ? [{ type: 'package', data: pkg }] : []
    };
  }

  private static getCurrentSeason(): ToolCallResult {
    const seasons = dbGetSeasons();
    const currentSeason = seasons.find(s => s.status === 'CURRENT' || s.status === 'OPEN') || seasons[0];

    return {
      tool_name: 'get_current_season',
      success: true,
      result_text: `الموسم الحالي المفتوح: ${currentSeason.name} (من ${currentSeason.start_date} إلى ${currentSeason.end_date}).`
    };
  }

  private static searchHotels(city?: string): ToolCallResult {
    const hotels = dbGetHotels();
    let filtered = hotels.filter(h => h.status === 'ACTIVE');
    if (city) {
      filtered = filtered.filter(h => h.city.toLowerCase() === city.toLowerCase());
    }

    const cards: AiCard[] = filtered.map(h => ({ type: 'hotel', data: h }));
    return {
      tool_name: 'search_hotels',
      success: true,
      result_text: `عثرنا على ${filtered.length} فنادق معتمدة بالقرب من الحرمين الشريفين.`,
      cards: cards
    };
  }

  private static createReservation(args: Record<string, any>): ToolCallResult {
    const res = dbCreateReservation({
      customer_name: args.customer_name || 'معتمر جديد',
      customer_email: args.customer_email || 'pilgrim@southstreet.dz',
      customer_phone: args.customer_phone || '+213 550 00 00 00',
      package_id: args.package_id || 'pkg_august_economy_2026',
      room_type: args.room_type || 'QUAD',
      travelers_count: args.travelers_count || 1
    });

    return {
      tool_name: 'create_reservation',
      success: true,
      result_text: `🎉 **تم إنشاء طلب الحجز المبدئي بنجاح!**\n• رقم الحجز: **${res.reservation_number}**\n• الإجمالي: **${res.total_amount.toLocaleString()} دج**\n• الحالة: **${res.status}**\nيمكنك إرفاق وثائق الجواز ودفع العلبون في البوابة الشخصية.`,
      cards: [{ type: 'reservation', data: res }],
      actions: [{ type: 'open_modal', target: 'reservation_success' }]
    };
  }

  private static openLogin(): ToolCallResult {
    return {
      tool_name: 'open_login',
      success: true,
      result_text: '🔑 **تم فتح نافذة "بوابة الوكالة" لك الآن.** يمكنك تسجيل الدخول أو اختيار رتبتك.',
      actions: [{ type: 'open_modal', target: 'login' }]
    };
  }

  private static navigateTo(page: string, filters?: Record<string, any>): ToolCallResult {
    return {
      tool_name: 'navigate_to',
      success: true,
      result_text: `سيتم توجيهك الآن إلى صفحة ${page}.`,
      actions: [{ type: 'navigate', target: page, filters }]
    };
  }

  private static showMedia(entityId?: string, type?: string): ToolCallResult {
    const mediaAssets = dbGetMediaAssets().filter(m => m.approved);
    let selected = mediaAssets;
    if (entityId) {
      selected = mediaAssets.filter(m => m.related_entity_id === entityId);
    }
    if (selected.length === 0) selected = mediaAssets;

    return {
      tool_name: 'show_media',
      success: true,
      result_text: `إليك الصور والمعارض المعتمدة.`,
      media: selected,
      actions: [{ type: 'show_media', media_url: selected[0]?.url }]
    };
  }

  private static showMap(title: string = 'فندق سويس أوتيل مكة', lat: number = 21.4187, lng: number = 39.8256): ToolCallResult {
    return {
      tool_name: 'show_map',
      success: true,
      result_text: `عرض الخريطة والموقع الجغرافي بالنسبة لصحن الحرم الشريف: ${title}.`,
      map: { title, latitude: lat, longitude: lng },
      actions: [{ type: 'show_map', lat, lng }]
    };
  }

  private static transferToHuman(reason?: string): ToolCallResult {
    return {
      tool_name: 'transfer_to_human',
      success: true,
      result_text: `🤝 **جاري تحويلك لمستشار ساوث ستريت:**\n${reason || 'تم طلب التواصل الإنساني المباشر'}.\nتم تحويل تذكرتك لقسم الاستقبال والتواصل الإنساني وسيتصل بك موظف الوكالة فوراً.`,
      escalated: true
    };
  }
}
