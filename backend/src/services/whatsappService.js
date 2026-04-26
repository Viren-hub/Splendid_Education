/**
 * WhatsApp notification service via Twilio.
 * Requires in .env:
 *   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN=your_auth_token
 *   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   (Twilio sandbox or approved number)
 *
 * If Twilio credentials are not configured, messages are silently skipped (logged only).
 */

const sendWhatsApp = async (toPhone, message) => {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_WHATSAPP_FROM;

  if (!sid || !token || !from) {
    console.log(`[WhatsApp] Skipped (Twilio not configured) → ${toPhone}: ${message}`);
    return;
  }

  // Normalise phone: ensure it starts with whatsapp:+
  const normalise = (p) => {
    if (!p) return null;
    const digits = p.replace(/\D/g, '');
    return `whatsapp:+${digits}`;
  };

  const to = normalise(toPhone);
  if (!to) return;

  try {
    const twilio = require('twilio')(sid, token);
    await twilio.messages.create({ from, to, body: message });
    console.log(`[WhatsApp] Sent to ${to}`);
  } catch (err) {
    // Non-blocking — log but don't crash the request
    console.error(`[WhatsApp] Failed to send to ${to}:`, err.message);
  }
};

module.exports = { sendWhatsApp };
