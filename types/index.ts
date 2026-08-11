export type UserRole = 'admin' | 'manager' | 'murshid' | 'accountant' | 'pilgrim';

export interface User {
  id: string;
  code: string;
  name: string;
  role: UserRole;
  roleName: string;
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
  senderRole: UserRole;
  text: string;
  time: string;
  type: MessageType;
  duration?: string;
  locationName?: string;
  coords?: string;
  iv?: string;
  ciphertext?: string;
  status?: 'sent' | 'read' | 'delivered';
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
