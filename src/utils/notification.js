const webpush = require("web-push");
const PushSubscription = require("../models/pushSubscription");

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn("VAPID keys are missing. Web push notifications will not work.");
}

async function sendPushNotification(userId, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return;
  }

  try {
    const subscription = await PushSubscription.findOne({ userId });
    if (!subscription) {
      return;
    }

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      JSON.stringify(payload)
    );
  } catch (err) {
    console.error("Push notification send failed:", err);
  }
}

function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

module.exports = { sendPushNotification, getVapidPublicKey };
