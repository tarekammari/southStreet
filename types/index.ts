export type UserRole =
  | 'admin'
  | 'manager'
  | 'murshid'
  | 'accountant'
  | 'pilgrim'
  | 'SUPER_ADMIN'
  | 'AGENCY_MANAGER'
  | 'AGENCY_AGENT'
  | 'PILGRIM_USER';

export interface User {
  id: string;
  code: string;
  name: string;
  role: UserRole;
  roleName: string;
  email?: string;
  phone?: string;
  avatar?: string;
  room?: string;
  status?: string;
  group?: string;
}

export interface Campaign {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  makkahHotel: string;
  madinahHotel: string;
  flightNumber: string;
  busNumber: string;
  pilgrimsCount: number;
  guideName: string;
  managerName: string;
  status: string;
}

export type MessageType = 'text' | 'voice' | 'location';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderRole: UserRole;
  text: string;
  time: string;
  type?: MessageType;
  duration?: string;
  locationName?: string;
  coords?: string;
  iv?: string;
  ciphertext?: string;
  status?: 'sent' | 'read' | 'delivered';
  isUrgent?: boolean;
}

export interface Receipt {
  id: string;
  pilgrimName: string;
  pilgrimCode: string;
  packageName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: string;
  date: string;
  accountantName: string;
  status: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole | string;
  action: string;
  details: string;
  ip: string;
}

export interface Offer {
  id: string;
  code: string;
  title_ar: string;
  title_fr: string;
  wilaya: string;
  duration: string;
  flight_type: string;
  departure_date: string;
  airline: string;
  makkah_hotel: string;
  makkah_dist: string;
  price_quin: string;
  views: number;
  img: string;
}

export interface CallPayload {
  targetUserId?: string;
  fromUserId?: string;
  fromName?: string;
  fromAvatar?: string;
  fromRole?: UserRole;
  callType?: 'voice' | 'video';
  callId?: string;
  encryptedSdp?: string;
  candidate?: RTCIceCandidateInit;
}

// ─────────────────────────────────────────────
// PRODUCTION DOMAIN SCHEMAS
// ─────────────────────────────────────────────

export interface AgencySettings {
  agency_name: string;
  legal_name: string;
  logo: string;
  description: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  opening_hours: string;
  emergency_phone: string;
  supported_languages: string[];
  default_currency: string;
  timezone: string;
}

export type SeasonType = 'UMRAH' | 'HAJJ';
export type SeasonStatus = 'DRAFT' | 'UPCOMING' | 'OPEN' | 'CURRENT' | 'FULL' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';

export interface Season {
  season_id: string;
  type: SeasonType;
  islamic_year: string;
  gregorian_year: string;
  name: string;
  start_date: string;
  end_date: string;
  status: SeasonStatus;
  description: string;
  official_information: string;
  agency_information: string;
}

export interface Hotel {
  hotel_id: string;
  name: string;
  city: 'MAKKAH' | 'MADINAH';
  category: '3_STAR' | '4_STAR' | '5_STAR' | 'VIP';
  address: string;
  latitude: number;
  longitude: number;
  distance_from_haram: string;
  description: string;
  services: string[];
  images: string[];
  videos: string[];
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Flight {
  flight_id: string;
  airline: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  departure_datetime: string;
  arrival_datetime: string;
  baggage: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'DELAYED' | 'COMPLETED';
}

export interface Morshid {
  morshid_id: string;
  name: string;
  languages: string[];
  experience_years: number;
  specialization: string;
  phone: string;
  status: 'AVAILABLE' | 'ASSIGNED' | 'INACTIVE';
}

export interface PackagePrice {
  room_type: 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'QUAD';
  traveler_type: 'ADULT' | 'CHILD' | 'INFANT';
  currency: string;
  amount: number;
}

export type PackageType = 'ECONOMY' | 'STANDARD' | 'PREMIUM' | 'VIP' | 'FAMILY' | 'GROUP' | 'CUSTOM';

export interface Package {
  package_id: string;
  name: string;
  type: PackageType;
  season_id: string;
  season_name: string;
  description: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  departure_city: string;
  departure_airport: string;
  arrival_airport: string;
  airline: string;
  flight_information?: Flight;
  makkah_hotel_id: string;
  makkah_hotel_name: string;
  makkah_hotel_dist: string;
  madinah_hotel_id: string;
  madinah_hotel_name: string;
  madinah_hotel_dist: string;
  hotel_category: string;
  morshid_id?: string;
  morshid_name?: string;
  prices: PackagePrice[];
  included_services: string[];
  excluded_services: string[];
  booking_conditions: string[];
  cancellation_policy: string;
  capacity: number;
  reserved: number;
  available: number;
  status: 'DRAFT' | 'PUBLISHED' | 'FULL' | 'CLOSED';
  published: boolean;
  image_url: string;
}

export interface TravelerInfo {
  first_name: string;
  last_name: string;
  passport_number: string;
  passport_expiry: string;
  birth_date: string;
  gender: 'MALE' | 'FEMALE';
  traveler_type: 'ADULT' | 'CHILD' | 'INFANT';
}

export type ReservationStatus =
  | 'REQUESTED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PAYMENT_PENDING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'DOCUMENTS_PENDING'
  | 'READY_FOR_TRAVEL'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export interface Reservation {
  reservation_id: string;
  reservation_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  package_id: string;
  package_name: string;
  room_type: 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'QUAD';
  travelers_count: number;
  travelers: TravelerInfo[];
  total_amount: number;
  paid_amount: number;
  currency: string;
  status: ReservationStatus;
  payment_status: 'UNPAID' | 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
  created_at: string;
  updated_at: string;
}

export interface CustomerDocument {
  document_id: string;
  customer_id: string;
  document_type: 'PASSPORT' | 'ID_CARD' | 'VACCINE_CERT' | 'FAMILY_BOOK' | 'PHOTO';
  file_name: string;
  file_url: string;
  status: 'UPLOADED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  rejection_reason?: string;
  uploaded_at: string;
}

export interface MediaAsset {
  media_id: string;
  type: 'IMAGE' | 'VIDEO' | 'MAP';
  title: string;
  description: string;
  url: string;
  thumbnail_url?: string;
  source: 'AGENCY' | 'HOTEL_PARTNER' | 'OFFICIAL' | 'LICENSED';
  license: string;
  approved: boolean;
  related_entity_type?: 'HOTEL' | 'PACKAGE' | 'DESTINATION';
  related_entity_id?: string;
}

export interface AiConversationLog {
  conversation_id: string;
  customer_id?: string;
  prompt: string;
  response: string;
  tools_called: string[];
  language: string;
  feedback?: 'POSITIVE' | 'NEGATIVE';
  escalated: boolean;
  timestamp: string;
}

export interface AiAction {
  type: 'navigate' | 'open_modal' | 'apply_filter' | 'select_package' | 'show_map' | 'show_media' | 'start_booking' | 'compare' | 'open_table_viewer' | string;
  target?: string;
  targetTable?: string;
  filters?: Record<string, any>;
  package_id?: string;
  hotel_id?: string;
  media_url?: string;
  lat?: number;
  lng?: number;
}

export interface AiCard {
  type: 'package' | 'hotel' | 'flight' | 'reservation' | 'comparison' | 'morshid' | 'action' | 'db_table_viewer' | 'table_selector_prompt' | string;
  data: any;
}

export interface AiResponsePayload {
  text: string;
  actions?: AiAction[];
  cards?: AiCard[];
  media?: MediaAsset[];
  map?: {
    title: string;
    latitude: number;
    longitude: number;
    zoom?: number;
  };
  escalated?: boolean;
  noKnowledge?: boolean;
  trusted?: boolean;
  externalAi?: boolean;
  /** Explicit source category for UI attribution */
  sourceType?: 'agency_db' | 'external_ai' | 'local_guidance' | 'system';
  source?: string;
  sourceLabel?: string;
  model?: string;
  toolsUsed?: string[];
}

