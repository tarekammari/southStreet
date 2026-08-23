import { User, UserRole } from '@/types';
import { toPortalRole } from '@/lib/roles';

export type ChatChannelType = 'dm' | 'group' | 'staff';

export interface ChatChannel {
  id: string;
  type: ChatChannelType;
  name: string;
  subtitle?: string;
  avatar: string;
  participantIds?: string[];
  roles?: string[];
}

export function normalizePortalRole(role?: string, email?: string, roleName?: string): UserRole {
  return toPortalRole(role, { email, roleName });
}

/** Deterministic private chat id between two users */
export function buildDmChatId(userIdA: string, userIdB: string): string {
  const [a, b] = [userIdA, userIdB].sort();
  return `dm:${a}:${b}`;
}

export function parseDmChatId(chatId: string): [string, string] | null {
  if (!chatId.startsWith('dm:')) return null;
  const parts = chatId.split(':');
  if (parts.length !== 3) return null;
  return [parts[1], parts[2]];
}

export function userInChat(chatId: string, userId: string): boolean {
  if (chatId.startsWith('group-') || chatId.startsWith('staff-')) return true;
  const dm = parseDmChatId(chatId);
  if (!dm) return false;
  return dm[0] === userId || dm[1] === userId;
}

const GROUP_CHANNELS: ChatChannel[] = [
  {
    id: 'group-campaign-makkah',
    type: 'group',
    name: 'حملة العمرة — مكة المكرمة',
    subtitle: 'قناة الفوج الرسمية',
    avatar: '🕋',
    roles: ['pilgrim', 'murshid', 'admin', 'accountant', 'agent', 'manager'],
  },
  {
    id: 'staff-internal',
    type: 'staff',
    name: 'طاقم الإدارة والعمليات',
    subtitle: 'محادثة داخلية للموظفين',
    avatar: '💼',
    roles: ['admin', 'accountant', 'murshid', 'manager', 'agent'],
  },
];

export function getChannelsForUser(currentUser: User, allUsers: User[]): ChatChannel[] {
  const role = normalizePortalRole(currentUser.role, currentUser.email, currentUser.roleName);
  const channels: ChatChannel[] = [];

  for (const g of GROUP_CHANNELS) {
    if (g.roles?.includes(role)) channels.push(g);
  }

  const others = allUsers.filter((u) => u.id !== currentUser.id);

  for (const u of others) {
    if (!canMessageUser(role, normalizePortalRole(u.role, u.email, u.roleName))) continue;
    channels.push({
      id: buildDmChatId(currentUser.id, u.id),
      type: 'dm',
      name: u.name,
      subtitle: u.roleName || u.role,
      avatar: u.avatar || u.name?.charAt(0) || 'م',
      participantIds: [currentUser.id, u.id],
    });
  }

  return channels;
}

function canMessageUser(fromRole: UserRole, toRole: UserRole): boolean {
  if (fromRole === 'admin' || fromRole === 'manager' || fromRole === 'agent') return true;
  if (fromRole === 'murshid') return ['pilgrim', 'admin', 'accountant', 'murshid', 'manager', 'agent'].includes(toRole);
  if (fromRole === 'accountant') return ['admin', 'murshid', 'pilgrim', 'accountant', 'manager', 'agent'].includes(toRole);
  if (fromRole === 'pilgrim') return ['murshid', 'admin', 'accountant', 'manager', 'agent'].includes(toRole);
  return false;
}

export function getChannelDisplayName(channel: ChatChannel, currentUserId: string, allUsers: User[]): string {
  if (channel.type !== 'dm') return channel.name;
  const dm = parseDmChatId(channel.id);
  if (!dm) return channel.name;
  const otherId = dm[0] === currentUserId ? dm[1] : dm[0];
  const other = allUsers.find((u) => u.id === otherId);
  return other?.name || channel.name;
}
