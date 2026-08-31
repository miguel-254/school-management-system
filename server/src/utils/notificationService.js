const Notification = require('../models/Notification');

const sendNotification = async ({ recipient, type = 'general', title, message, link, sentBy }) => {
  if (!recipient) return null;
  return Notification.create({ recipient, type, title, message, link, sentBy });
};

const sendNotificationToMany = async ({ recipients, type = 'general', title, message, link, sentBy }) => {
  const unique = [...new Set((recipients || []).filter(Boolean).map((r) => r.toString()))];
  if (unique.length === 0) return [];
  const docs = unique.map((recipient) => ({ recipient, type, title, message, link, sentBy }));
  return Notification.insertMany(docs);
};

module.exports = { sendNotification, sendNotificationToMany };
