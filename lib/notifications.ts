import { query, execute } from './db';

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string | null;
  link: string;
  is_read: number;
  created_at: string;
}

export async function createNotification(n: {
  type?: string;
  title: string;
  message?: string;
  link?: string;
}): Promise<void> {
  try {
    await execute(
      'INSERT INTO notifications (`type`, `title`, `message`, `link`) VALUES (?, ?, ?, ?)',
      [n.type || 'info', n.title, n.message ?? null, n.link ?? ''],
    );
  } catch (e) {
    // Non bloquant : une notif ratée ne doit pas casser le workflow
    console.error('[notifications] createNotification failed:', e);
  }
}

export async function listNotifications(limit = 30): Promise<Notification[]> {
  return query<Notification>(
    'SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
}

export async function unreadCount(): Promise<number> {
  const rows = await query<{ n: number }>(
    'SELECT COUNT(*) AS n FROM notifications WHERE is_read = 0',
  );
  return rows[0]?.n ?? 0;
}

export async function markAllRead(): Promise<void> {
  await execute('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
}

export async function markRead(id: number): Promise<void> {
  await execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
}

export async function deleteNotification(id: number): Promise<void> {
  await execute('DELETE FROM notifications WHERE id = ?', [id]);
}

export async function deleteAllNotifications(): Promise<void> {
  await execute('DELETE FROM notifications');
}
