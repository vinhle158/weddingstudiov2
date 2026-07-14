self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const appClient = clients.find(client => client.url.includes(self.location.origin));
      if (appClient) return appClient.focus();
      return self.clients.openWindow('/');
    })
  );
});
