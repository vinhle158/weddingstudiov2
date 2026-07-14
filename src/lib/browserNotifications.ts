export type BrowserNotificationStatus = 'unsupported' | 'default' | 'granted' | 'denied';

export function getBrowserNotificationStatus(): BrowserNotificationStatus {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission;
}

export async function requestBrowserNotifications(): Promise<BrowserNotificationStatus> {
  if (getBrowserNotificationStatus() === 'unsupported') return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission === 'granted') await navigator.serviceWorker.register('/notification-sw.js');
  return permission;
}

export async function showBrowserNotification(title: string, options: NotificationOptions = {}) {
  if (getBrowserNotificationStatus() !== 'granted') return;
  const registration = await navigator.serviceWorker.register('/notification-sw.js');
  await registration.showNotification(title, {
    ...options,
  });
}
