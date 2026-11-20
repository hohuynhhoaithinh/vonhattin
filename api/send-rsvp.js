const fs = require('fs');
const path = require('path');

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

// Hoa văn 4 góc: dán link Cloudinary (đuôi .png) vào đây. Để trống thì dùng ảnh trong public/assets (cần PUBLIC_SITE_URL).
const CORNER_URLS = {
  tl: 'https://res.cloudinary.com/dzidt15cl/image/upload/v1794993363/corner-tl_tkwjza.png',
  tr: 'https://res.cloudinary.com/dzidt15cl/image/upload/v1794993363/corner-tr_rcqs0t.png',
  bl: 'https://res.cloudinary.com/dzidt15cl/image/upload/v1794993363/corner-bl_io8yz9.png',
  br: 'https://res.cloudinary.com/dzidt15cl/image/upload/v1794993363/corner-br_a19ern.png',
};

// Ảnh đại diện hiện ở góc trên phải của email xác nhận (Cloudinary tự cắt vuông theo khuôn mặt)
const AVATAR_URL = 'https://res.cloudinary.com/dzidt15cl/image/upload/v1795082082/tin_pqbmnj.jpg';

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

loadLocalEnv();

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function validEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function text(value, fallback = '') {
  return escapeHtml(String(value ?? fallback).trim());
}

function buildMessage(data, event, recipient, imageUrl) {
  const name = text(data.name);
  const email = text(data.email);
  const guests = text(data.guests);
  const message = text(data.message, '(không có)');
  const hostName = text(event.hostName);
  const venue = text(event.venue);
  const address = text(event.address);
  const mapsUrl = String(event.mapsUrl || '').trim();
  const safeMapsUrl = /^https?:\/\//i.test(mapsUrl) ? mapsUrl : '';
  const start = new Date(event.startISO);
  const date = Number.isNaN(start.getTime())
    ? ''
    : new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(start);
  const viTime = (d) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
        .formatToParts(d).map((x) => [x.type, x.value])
    );
    const h = Number(p.hour);
    const m = Number(p.minute);
    const period = h < 11 ? 'sáng' : h < 14 ? 'trưa' : h < 18 ? 'chiều' : 'tối';
    return `${h % 12 === 0 ? 12 : h % 12} giờ${m ? ` ${m}` : ''} ${period}`;
  };
  const viHour = (d) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
        .formatToParts(d).map((x) => [x.type, x.value])
    );
    return Number(p.minute) ? `${Number(p.hour)}:${p.minute}` : String(Number(p.hour));
  };
  const end = new Date(event.endISO);
  const time = Number.isNaN(start.getTime())
    ? ''
    : Number.isNaN(end.getTime())
      ? viTime(start)
      : `${viHour(start)} – ${viHour(end)} giờ`;

  // ---- Giao diện thiệp cổ điển dùng chung cho cả hai email ----
  const GOLD = '#a8873a';
  const CREAM = '#fbf6ea';
  const CAPS = `font-family:'Cormorant SC','Cormorant Garamond',Georgia,'Times New Roman',serif;text-transform:uppercase;letter-spacing:2.5px;color:${GOLD};font-weight:600`;
  const SCRIPT = `font-family:'Great Vibes','Snell Roundhand','Apple Chancery','Segoe Script','Brush Script MT',cursive;color:${GOLD};font-weight:normal`;
  const SERIF = `font-family:Georgia,'Times New Roman',serif`;

  const dp = Object.fromEntries(
    new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric',
    }).formatToParts(Number.isNaN(start.getTime()) ? new Date() : start).map((x) => [x.type, x.value])
  );
  const longDate = Number.isNaN(start.getTime()) ? '' : `${dp.weekday}, ngày ${dp.day} tháng ${dp.month} năm ${dp.year}`;

  const assets = imageUrl ? imageUrl.replace(/\/assets\/photo\.png$/, '/assets') : '';
  const cornerSrc = (pos) => CORNER_URLS[pos] || (assets ? `${assets}/corner-${pos}.png` : '');
  const corner = (pos) => cornerSrc(pos)
    ? `<img src="${escapeHtml(cornerSrc(pos))}" width="120" height="120" alt="" style="display:block;width:120px;height:120px;border:0">`
    : '';
  const avatar = AVATAR_URL.includes('/upload/')
    ? AVATAR_URL.replace('/upload/', '/upload/w_200,h_200,c_fill,g_face,f_jpg,q_auto/')
    : AVATAR_URL;
  const note = text(event.note);
  const phone = text(event.phone);
  const phoneLabel = text(event.phoneLabel, 'Liên hệ');

  const topRight = `<td width="120" height="120" valign="top" background="${escapeHtml(cornerSrc('tr'))}" style="width:120px;height:120px;${cornerSrc('tr') ? `background-image:url('${escapeHtml(cornerSrc('tr'))}');background-repeat:no-repeat;background-size:120px 120px;` : ''}">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding:18px 0 0 52px"><img src="${escapeHtml(avatar)}" width="50" height="50" alt="${hostName}" style="display:block;width:50px;height:50px;border-radius:50%;object-fit:cover;border:2px solid ${GOLD}"></td></tr></table>
        </td>`;

  const divider = (label) => `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:6px auto 4px"><tr>
          <td width="64" style="width:64px;border-top:1px solid ${GOLD};font-size:0;line-height:0">&nbsp;</td>
          <td style="padding:0 12px;${CAPS};font-size:12px">${label}</td>
          <td width="64" style="width:64px;border-top:1px solid ${GOLD};font-size:0;line-height:0">&nbsp;</td>
        </tr></table>`;

  const shell = ({ topLabel, inner, bottom }) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+SC:wght@500;600&family=Great+Vibes&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;background:#ece4d3">
<div style="padding:24px 10px;background:#ece4d3">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:${CREAM};border:1px solid #e2d8bf">
    <tr>
      <td width="120" valign="top" style="width:120px">${corner('tl')}</td>
      <td align="center" valign="middle" style="padding:0 4px;${CAPS};font-size:11px;line-height:1.7">${topLabel}</td>
      ${topRight}
    </tr>
    <tr>
      <td colspan="3" align="center" style="padding:0 30px;text-align:center">${inner}</td>
    </tr>
    <tr>
      <td width="120" valign="bottom" style="width:120px">${corner('bl')}</td>
      <td align="center" valign="middle" style="padding:0 4px"><div style="${SCRIPT};font-size:26px;line-height:1.2">${bottom}</div></td>
      <td width="120" valign="bottom" style="width:120px">${corner('br')}</td>
    </tr>
  </table>
  <p style="margin:14px 0 0;text-align:center;${SERIF};font-size:11px;color:#8b7d55">Email tự động từ thiệp mời</p>
</div>
</body></html>`;

  const mapsButton = safeMapsUrl
    ? `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:22px auto 0"><tr><td style="border:1px solid ${GOLD};padding:11px 26px"><a href="${escapeHtml(safeMapsUrl)}" style="${CAPS};font-size:12px;text-decoration:none">Xem chỉ đường</a></td></tr></table>`
    : '';

  /* ---------- Email báo cho chủ thiệp ---------- */
  if (recipient === 'owner') {
    const row = (label, value, first) => `<tr>
          <td valign="top" style="padding:10px 12px 10px 0;${CAPS};font-size:11px;width:30%;text-align:left;${first ? '' : 'border-top:1px solid #e6dcc0'}">${label}</td>
          <td valign="top" style="padding:10px 0;${SERIF};font-size:15px;line-height:1.55;color:#4d4520;text-align:left;word-break:break-word;${first ? '' : 'border-top:1px solid #e6dcc0'}">${value}</td>
        </tr>`;
    return {
      subject: `[Thiệp mời] ${name} vừa xác nhận tham dự`,
      htmlContent: shell({
        topLabel: 'Xác nhận<br>tham dự',
        bottom: 'Thêm một người bạn!',
        inner: `
        <div style="${CAPS};font-size:13px;line-height:1.9">Có tin vui</div>
        <div style="${SCRIPT};font-size:50px;line-height:1.25;margin-top:6px">${name}</div>
        ${divider('đã nhận lời mời')}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0">
          ${row('Email', email, true)}
          ${row('Số khách', guests)}
          ${row('Lời nhắn', message)}
        </table>
        <div style="${CAPS};font-size:13px;line-height:1.9;margin-top:24px">${longDate}<br>${time}</div>
        <div style="${CAPS};font-size:14px;line-height:1.7;margin-top:10px">${venue}</div>
        <div style="${CAPS};font-size:11px;line-height:1.7;font-weight:500">${address}</div>
        <div style="${SERIF};font-style:italic;color:${GOLD};font-size:14px;line-height:1.6;margin-top:22px">Bấm “Trả lời” để phản hồi trực tiếp cho ${name}.</div>`,
      }),
    };
  }

  /* ---------- Email gửi khách ---------- */
  return {
    subject: `Hẹn gặp bạn nhé, ${name}!`,
    htmlContent: shell({
      topLabel: 'Lời mời<br>tốt nghiệp',
      bottom: 'Hẹn gặp bạn!',
      inner: `
        <div style="${CAPS};font-size:13px;line-height:1.9">Với tất cả niềm vui<br>${hostName} trân trọng cảm ơn<br>và hẹn gặp bạn tại buổi lễ</div>
        <div style="${SCRIPT};font-size:50px;line-height:1.25;margin-top:18px">${name}</div>
        ${divider('đến chung vui cùng')}
        <div style="${SCRIPT};font-size:42px;line-height:1.3;margin-top:4px">${hostName}</div>
        <div style="${CAPS};font-size:13px;line-height:1.9;margin-top:6px">Tại lễ tốt nghiệp</div>
        <div style="${CAPS};font-size:14px;line-height:1.9;margin-top:22px">${longDate}<br>${time}</div>
        <div style="${CAPS};font-size:15px;line-height:1.7;margin-top:22px">${venue}</div>
        <div style="${CAPS};font-size:12px;line-height:1.7;font-weight:500">${address}</div>
        ${mapsButton}
        ${note ? `<div style="${SERIF};font-style:italic;color:${GOLD};font-size:14px;line-height:1.6;margin-top:22px">${note}</div>` : ''}
        ${phone ? `<div style="${CAPS};font-size:11px;line-height:1.7;margin-top:14px;font-weight:500">${phoneLabel}: ${phone}</div>` : ''}`,
    }),
  };
}

async function sendBrevoEmail({ sender, to, replyTo, subject, htmlContent }) {
  const response = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      replyTo: { email: replyTo },
      subject,
      htmlContent,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Brevo ${response.status}: ${detail}`);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};
  const data = body;
  const event = body.event || {};
  const ownerEmail = process.env.OWNER_EMAIL;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || event.hostName || 'Thiệp mời';
  const siteUrl = String(process.env.PUBLIC_SITE_URL || '').replace(/\/+$/, '');
  const imageUrl = /^https?:\/\//i.test(siteUrl) ? `${siteUrl}/assets/photo.png` : '';

  const missing = [];
  if (!process.env.BREVO_API_KEY) missing.push('BREVO_API_KEY');
  if (!validEmail(senderEmail)) missing.push('BREVO_SENDER_EMAIL');
  if (!validEmail(ownerEmail)) missing.push('OWNER_EMAIL');
  if (missing.length) {
    res.status(500).json({ error: `Thiếu hoặc sai biến môi trường: ${missing.join(', ')}` });
    return;
  }
  if (String(data.website || '').trim()) {
    res.status(204).end();
    return;
  }
  if (!String(data.name || '').trim() || !validEmail(data.email) || !event.startISO) {
    res.status(400).json({ error: 'Thông tin xác nhận không hợp lệ.' });
    return;
  }

  const sender = { email: senderEmail, name: senderName };
  const ownerMessage = buildMessage(data, event, 'owner', imageUrl);
  const guestMessage = buildMessage(data, event, 'guest', imageUrl);

  try {
    await Promise.all([
      sendBrevoEmail({
        sender,
        to: ownerEmail,
        replyTo: data.email,
        ...ownerMessage,
      }),
      sendBrevoEmail({
        sender,
        to: data.email,
        replyTo: ownerEmail,
        ...guestMessage,
      }),
    ]);
    res.status(200).json({ emailSent: true });
  } catch (error) {
    console.error('[brevo] gửi email thất bại:', error);
    res.status(502).json({ error: 'Brevo không gửi được email lúc này.' });
  }
};

module.exports.buildMessage = buildMessage;
