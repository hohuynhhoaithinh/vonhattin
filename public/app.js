(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TZ = 'Asia/Ho_Chi_Minh';

  // Dùng khi không đọc được /event.json (ví dụ mở thẳng file index.html)
  const FALLBACK = {
    hostName: 'Võ Nhật Tín',
    startISO: '2026-11-25T09:00:00+07:00',
    endISO: '2026-11-25T13:00:00+07:00',
    venue: 'Địa điểm tổ chức',
    address: '',
    phoneLabel: '',
    phone: '',
    mapsUrl: '',
    dressCode: '',
    note: '',
  };

  // Link cá nhân hóa: /?to=Minh  ->  "Gửi Minh,"
  const toName = (new URLSearchParams(location.search).get('to') || '').trim().slice(0, 40);

  async function loadEvent() {
    try {
      const res = await fetch('/event.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('no event.json');
      return { ...FALLBACK, ...(await res.json()) };
    } catch {
      return FALLBACK;
    }
  }

  const fmt = (d, opts) => new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, ...opts }).format(d);
  const pad = (n) => String(n).padStart(2, '0');

  // 09:00 -> "9 giờ sáng", 13:00 -> "1 giờ trưa", 15:30 -> "3 giờ 30 chiều"
  function viTime(d) {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
        .formatToParts(d).map((x) => [x.type, x.value])
    );
    const h = Number(p.hour);
    const m = Number(p.minute);
    const period = h < 11 ? 'sáng' : h < 14 ? 'trưa' : h < 18 ? 'chiều' : 'tối';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12} giờ${m ? ` ${m}` : ''} ${period}`;
  }

  // 11:00 -> "11", 13:30 -> "13:30" (dùng cho khoảng giờ "11 – 13 giờ")
  function viHour(d) {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
        .formatToParts(d).map((x) => [x.type, x.value])
    );
    return Number(p.minute) ? `${Number(p.hour)}:${p.minute}` : String(Number(p.hour));
  }

  /* ---------- Gửi email qua Brevo (Vercel Function) ---------- */
  const BREVO_URL = '/api/send-rsvp';
  const COOLDOWN_MS = 30 * 1000;

  const lastSent = () => { try { return Number(localStorage.getItem('rsvp-last-sent')) || 0; } catch { return 0; } };
  const markSent = () => { try { localStorage.setItem('rsvp-last-sent', String(Date.now())); } catch { /* bỏ qua */ } };

  async function brevoSend(data, ev) {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, event: ev }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Brevo ${res.status}: ${body}`);
    }
    return res.json();
  }

  async function sendRsvp(data, ev) {
    // Ô bẫy bot bị điền: giả vờ thành công, không gửi gì
    if (data.website.trim()) return { emailSent: false };

    if (Date.now() - lastSent() < COOLDOWN_MS) {
      throw new Error('Bạn vừa gửi xong rồi, đợi một chút nhé.');
    }

    await brevoSend(data, ev);
    markSent();
    return { emailSent: true };
  }

  /* ---------- Pháo giấy ---------- */
  function confetti(count = 150) {
    if (reduceMotion) return;
    const canvas = $('#confetti');
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = innerWidth;
    const H = innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const colors = ['#0F0F10', '#A9AEB5', '#7F93A8', '#FFFFFF', '#6A8099', '#D5D8DC'];
    const parts = Array.from({ length: count }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 80,
      y: H * 0.62,
      vx: (Math.random() - 0.5) * 15,
      vy: -(8 + Math.random() * 12),
      g: 0.35 + Math.random() * 0.2,
      s: 6 + Math.random() * 7,
      r: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.4,
      c: colors[(Math.random() * colors.length) | 0],
    }));

    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of parts) {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.992;
        p.r += p.vr;
        if (p.y < H + 30) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6);
        ctx.restore();
      }
      if (alive && t - t0 < 5000) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    })(t0);
  }

  /* ---------- Thông tin buổi lễ + đếm ngược ---------- */
  let hostShort = 'mình';
  function renderEvent(ev) {
    const start = new Date(ev.startISO);

    hostShort = String(ev.hostName || '').trim().split(/\s+/).pop() || 'mình';
    document.querySelectorAll('.host-name').forEach((el) => (el.textContent = ev.hostName));
    $('#toName').textContent = toName || 'bạn';
    if (toName) document.title = `${toName} ơi, mình có lời mời cho bạn`;

    $('#evDay').textContent = fmt(start, { day: '2-digit' });
    $('#evMonth').textContent = `tháng ${fmt(start, { month: 'numeric' })}, ${fmt(start, { year: 'numeric' })}`;
    $('#evWeekday').textContent = fmt(start, { weekday: 'long' });
    const end = ev.endISO ? new Date(ev.endISO) : null;
    $('#evTime').textContent = end && !Number.isNaN(end.getTime())
      ? `${viHour(start)} – ${viHour(end)} giờ`
      : viTime(start);
    $('#evVenue').textContent = ev.venue;
    $('#evAddress').textContent = ev.address;
    $('#evAddress').hidden = !ev.address;
    if (ev.dressCode) {
      $('#evDress').textContent = `Trang phục: ${ev.dressCode}`;
      $('#evDress').hidden = false;
    }

    const parking = Array.isArray(ev.parking) ? ev.parking.filter(Boolean) : [];
    if (parking.length) {
      const list = $('#evParkingList');
      list.replaceChildren(...parking.map((p) => { const li = document.createElement('li'); li.textContent = p; return li; }));
      $('#evParking').hidden = false;
    }

    const phone = (ev.phone || '').trim();
    if (phone) {
      const link = $('#evPhoneLink');
      $('#evPhoneLabel').textContent = ev.phoneLabel || 'Liên hệ';
      link.textContent = phone;
      $('#evPhone').hidden = false;
    }

    const maps = $('#mapsBtn');
    if (ev.mapsUrl) maps.href = ev.mapsUrl;
    else maps.hidden = true;

    // Đếm ngược
    const tick = () => {
      const diff = start - Date.now();
      if (diff <= 0) {
        $('#countdown').hidden = true;
        $('#countdownDone').hidden = false;
        return false;
      }
      $('#cdD').textContent = Math.floor(diff / 864e5);
      $('#cdH').textContent = pad(Math.floor(diff / 36e5) % 24);
      $('#cdM').textContent = pad(Math.floor(diff / 6e4) % 60);
      $('#cdS').textContent = pad(Math.floor(diff / 1e3) % 60);
      return true;
    };
    if (tick()) {
      const timer = setInterval(() => { if (!tick()) clearInterval(timer); }, 1000);
    }

    return ev;
  }

  /* ---------- Màn hình mở đầu ---------- */
  function setupGate(onOpen) {
    const gate = $('#gate');
    const page = $('#page');
    $('#openBtn').addEventListener('click', () => {
      onOpen?.(); // chạm vào thiệp là thao tác của người dùng nên trình duyệt cho phép phát nhạc
      gate.classList.add('is-gone');
      gate.setAttribute('inert', '');
      page.removeAttribute('inert');
      page.classList.add('is-open');
      document.body.classList.remove('locked');
      window.scrollTo(0, 0);
      setTimeout(() => gate.remove(), 1000);
    });
  }

  /* ---------- Nút "Không" chạy trốn ---------- */
  function setupChoices(ev) {
    const choices = $('#choices');
    const yes = $('#btnYes');
    const no = $('#btnNo');
    const face = $('#face');

    const lines = ['Không', 'Chắc chưa?', 'Nghĩ lại đi mà', 'Mình buồn đó', 'Cho mình xin một cơ hội', 'Bạn ơi...'];
    const faces = ['🙂', '🤨', '🥺', '😢', '😭', '🥹'];

    let tries = 0;
    let converted = false;
    let placeholder = null;
    let lastDodge = 0;

    function moveNo() {
      const c = choices.getBoundingClientRect();
      const nw = no.offsetWidth;
      const nh = no.offsetHeight;
      const y = yes.getBoundingClientRect();
      const keepOut = { l: y.left - c.left - 14, t: y.top - c.top - 14, r: y.right - c.left + 14, b: y.bottom - c.top + 14 };
      const cur = { x: no.offsetLeft + nw / 2, y: no.offsetTop + nh / 2 };

      let best = null;
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * Math.max(0, c.width - nw);
        const t = Math.random() * Math.max(0, c.height - nh);
        const overlapsYes = x < keepOut.r && x + nw > keepOut.l && t < keepOut.b && t + nh > keepOut.t;
        if (overlapsYes) continue;
        const dist = Math.hypot(x + nw / 2 - cur.x, t + nh / 2 - cur.y);
        if (dist > 120) { best = { x, t }; break; }
        if (!best) best = { x, t };
      }
      if (!best) best = { x: Math.max(0, c.width - nw), t: Math.max(0, c.height - nh) };
      no.style.left = `${best.x}px`;
      no.style.top = `${best.t}px`;
    }

    function dodge() {
      if (converted) return;
      lastDodge = performance.now();
      tries++;

      if (tries >= lines.length) return convertNo();

      // Lần đầu: tách nút ra khỏi dòng chữ, giữ chỗ lại để bố cục không nhảy
      if (!no.classList.contains('is-dodging')) {
        const { offsetLeft: x, offsetTop: t, offsetWidth: w, offsetHeight: h } = no;
        placeholder = document.createElement('span');
        placeholder.style.cssText = `display:block;flex:none;width:${w}px;height:${h}px`;
        no.before(placeholder);
        no.style.left = `${x}px`;
        no.style.top = `${t}px`;
        no.classList.add('is-dodging');
      }

      no.textContent = lines[tries];
      face.textContent = faces[Math.min(tries, faces.length - 1)];
      no.style.transform = `scale(${Math.max(0.6, 1 - tries * 0.08)})`;
      yes.style.transform = `scale(${Math.min(1.5, 1 + tries * 0.1)})`;
      requestAnimationFrame(moveNo);
    }

    // Nút "Không" tự biến thành "Có"
    function convertNo() {
      converted = true;
      placeholder?.remove();
      no.classList.remove('is-dodging');
      no.removeAttribute('style');
      no.classList.add('is-yes');
      no.textContent = 'Thôi được, mình đến!';
      face.textContent = '🥹';
      yes.style.transform = '';
    }

    // Chuột: chạy khi rê vào. Cảm ứng: chạy ngay lúc chạm xuống.
    no.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') dodge(); });
    no.addEventListener('pointerdown', (e) => {
      if (converted || e.pointerType === 'mouse') return;
      e.preventDefault();
      dodge();
    });
    // Bàn phím (Enter/Space) hoặc click lọt qua
    no.addEventListener('click', (e) => {
      e.preventDefault();
      if (converted) return onYes();
      if (performance.now() - lastDodge > 400) dodge();
    });

    yes.addEventListener('click', onYes);

    /* ---------- Sau khi bấm Có ---------- */
    const form = $('#rsvpForm');
    function onYes() {
      choices.hidden = true;
      face.textContent = '🥳';
      seaWave();
      blowBubbles();
      $('#askTitle').textContent = 'Yay! Cho mình xin chút thông tin nhé';
      $('#askSub').textContent = 'Mình sẽ gửi email xác nhận kèm thông tin buổi lễ cho bạn.';
      form.hidden = false;
      $('#fName').value = toName;
      confetti(110);
      form.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      // Không tự focus ô nhập: trên điện thoại focus sẽ bật bàn phím, làm co khung nhìn và giật animation.
      // Người dùng tự chạm vào ô khi muốn nhập.
    }

    /* ---------- Gửi form ---------- */
    const errorEl = $('#formError');
    const submitBtn = $('#submitBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';

      const data = {
        name: $('#fName').value.trim(),
        email: $('#fEmail').value.trim(),
        guests: Number($('#fGuests').value),
        message: $('#fMsg').value.trim(),
        website: form.elements.website.value,
      };

      if (!data.name) return fail('Bạn nhập giúp mình tên nhé.', $('#fName'));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) return fail('Email chưa đúng định dạng, bạn kiểm tra lại nhé.', $('#fEmail'));

      // Chưa gửi gì cả: đóng gói thông tin, rồi người dùng phải ném bóng vào rổ thì mới gửi.
      submitBtn.disabled = true;
      packAndShoot(data);
    });

    /* ---------- Đóng gói -> ném bóng ---------- */
    const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
    const shootMsg = $('#shootMsg');
    const autoBtn = $('#autoShot');
    const retryBtn = $('#retryBtn');
    let court = null;
    let pending = null;

    async function packAndShoot(data) {
      pending = data;
      const pack = $('#pack');
      const packText = $('#packText');
      const stateCls = ['s-paper', 's-close', 's-seal', 's-ready', 's-out'];

      face.textContent = '📦';
      $('#askTitle').textContent = 'Đang đóng gói...';
      $('#askSub').textContent = 'Mình gói gọn thông tin của bạn vào một phong bì.';

      form.classList.add('is-packing');
      await wait(800);
      form.hidden = true;
      form.classList.remove('is-packing');

      pack.hidden = false;
      pack.classList.remove(...stateCls);
      packText.textContent = 'Đang đóng gói...';
      await wait(350);
      pack.classList.add('s-paper');
      await wait(750);
      pack.classList.add('s-close');
      await wait(600);
      pack.classList.add('s-seal');
      await wait(500);
      packText.textContent = 'Đóng gói xong rồi! 📬';
      pack.classList.add('s-ready');
      await wait(900);
      pack.classList.add('s-out');
      await wait(450);

      // Lời nhắn trước khi ra sân bóng
      pack.classList.add('s-note');
      packText.textContent = `${data.name} ơi, bạn hãy thả lá thư này vào rổ nhé! 🏀 Để những yêu thương bạn gửi gắm bay thẳng đến ${hostShort}.`;
      await wait(3800);
      pack.hidden = true;
      pack.classList.remove('s-note');

      face.textContent = '🏀';
      $('#askTitle').textContent = 'Ghi bàn để gửi thiệp nhé!';
      $('#askSub').textContent = 'Kéo quả bóng xuống rồi thả tay. Bóng vào rổ là phong bì được gửi đi.';
      $('#shoot').hidden = false;
      $('#shoot').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });

      court = createCourt($('#court'), {
        onMessage: (t) => { shootMsg.textContent = t; },
        onScore: () => { sendAfterScore(); },
      });
      court.start();
    }

    autoBtn.addEventListener('click', () => court?.autoShot());

    let sending = false;
    async function sendAfterScore() {
      if (sending || !pending) return;
      sending = true;
      autoBtn.disabled = true;
      retryBtn.hidden = true;
      shootMsg.textContent = 'Vào rổ! 🎉 Đang gửi thiệp...';
      confetti(90);
      try {
        const [json] = await Promise.all([sendRsvp(pending, ev), wait(900)]);
        court?.stop();
        $('#shoot').hidden = true;
        showDone(pending, json);
      } catch (err) {
        shootMsg.textContent = err instanceof TypeError
          ? 'Không kết nối được, bạn kiểm tra mạng rồi bấm “Gửi lại” nhé.'
          : `${err.message} Bấm “Gửi lại” để thử lần nữa.`;
        retryBtn.hidden = false;
      } finally {
        sending = false;
      }
    }
    retryBtn.addEventListener('click', sendAfterScore);

    function fail(msg, field) {
      errorEl.textContent = msg;
      field.focus();
    }

    function showDone(data, json) {
      form.hidden = true;
      $('#pack').hidden = true;
      $('#shoot').hidden = true;
      face.textContent = '🎓';
      $('#askTitle').textContent = 'Xong rồi!';
      $('#askSub').hidden = true;
      $('#doneTitle').textContent = `Hẹn gặp ${data.name} nhé!`;
      $('#doneText').textContent = json.emailSent
        ? `Mình đã gửi email xác nhận tới ${data.email}. Chưa thấy thì bạn kiểm tra mục Spam giúp mình nha.`
        : 'Mình đã nhận được xác nhận của bạn rồi. Hẹn gặp bạn ở buổi lễ!';
      const done = $('#done');
      done.hidden = false;
      done.focus({ preventScroll: true });
      done.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      confetti(180);
    }
  }


  /* ---------- Sân bóng rổ: kéo ná cao su, thả tay để ném ---------- */
  function createCourt(canvas, { onMessage, onScore }) {
    const ctx = canvas.getContext('2d');
    const INK = '#0F0F10';
    const CLAY = '#E0702F';
    const BALL_A = '#E58A47';
    const BALL_B = '#B9561F';

    const G = 1600;        // trọng lực (px/s²)
    const BR = 17;         // bán kính bóng
    const RIM_R = 36;      // nửa bề rộng vành rổ
    const RIM_RY = 9;      // độ dẹt của vành (nhìn từ phía trước)
    const KX = 7;          // lực ném theo chiều ngang (nhỏ hơn để dễ ngắm)
    const KY = 11;         // lực ném theo chiều dọc
    const MAX_PULL = 95;
    const rimPts = () => [{ x: hoop.x - RIM_R, y: hoop.y }, { x: hoop.x + RIM_R, y: hoop.y }];

    let W = 0, H = 0, dpr = 1;
    let hoop = { x: 0, y: 0 };
    let anchor = { x: 0, y: 0 };
    const ball = { x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0, s: 1 };
    let state = 'idle';     // idle | drag | fly | scored
    let raf = 0;
    let last = 0;
    let t = 0;
    let spawnT = 0;
    let misses = 0;
    let hitRim = false;
    let netSway = 0;
    let netBulge = 0;
    let running = false;

    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      hoop = { x: W * 0.66, y: 150 };
      anchor = { x: W * 0.3, y: H - 120 };
      if (state === 'idle' || state === 'drag') resetBall(false);
    }

    function resetBall(animate = true) {
      state = 'idle';
      hitRim = false;
      Object.assign(ball, { x: anchor.x, y: anchor.y, vx: 0, vy: 0, a: 0, va: 0 });
      spawnT = animate ? 0 : 1;
      canvas.classList.remove('is-dragging');
    }

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };

    // Vận tốc ném tương ứng với vị trí kéo
    const velFor = (px, py) => ({ vx: -(px - anchor.x) * KX, vy: -(py - anchor.y) * KY });

    // Điểm minh họa quỹ đạo (không tính va chạm vành rổ)
    function preview(v) {
      const pts = [];
      let x = ball.x, y = ball.y, vx = v.vx, vy = v.vy;
      const dt = 0.045;
      for (let i = 0; i < 22; i++) {
        vy += G * dt;
        x += vx * dt;
        y += vy * dt;
        if (y > hoop.y + 70 && vy > 0) break;
        pts.push({ x, y });
      }
      return pts;
    }

    let dotPts = [];
    let pull = null;

    canvas.addEventListener('pointerdown', (e) => {
      if (state !== 'idle' || !running) return;
      const p = pos(e);
      if (Math.hypot(p.x - ball.x, p.y - ball.y) > 48) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      state = 'drag';
      canvas.classList.add('is-dragging');
      onMessage('Nhắm vào rổ rồi thả tay nhé.');
    });

    canvas.addEventListener('pointermove', (e) => {
      if (state !== 'drag') return;
      const p = pos(e);
      let dx = p.x - anchor.x;
      let dy = Math.max(0, p.y - anchor.y);
      const len = Math.hypot(dx, dy);
      if (len > MAX_PULL) { dx *= MAX_PULL / len; dy *= MAX_PULL / len; }
      ball.x = anchor.x + dx;
      ball.y = anchor.y + dy;
      pull = { dx, dy };
      dotPts = preview(velFor(ball.x, ball.y));
    });

    function release() {
      if (state !== 'drag') return;
      canvas.classList.remove('is-dragging');
      const dx = ball.x - anchor.x;
      const dy = ball.y - anchor.y;
      dotPts = [];
      pull = null;
      if (dy < 14) {
        resetBall();
        onMessage('Kéo xuống thêm một chút rồi thả tay nhé.');
        return;
      }
      const v = velFor(ball.x, ball.y);
      launch(v.vx, v.vy);
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', () => { if (state === 'drag') { resetBall(); dotPts = []; pull = null; } });

    function launch(vx, vy) {
      state = 'fly';
      hitRim = false;
      ball.vx = vx;
      ball.vy = vy;
      ball.va = vx / 90;
      autoDisabled(true);
      onMessage('');
    }

    function autoDisabled(v) {
      const b = document.querySelector('#autoShot');
      if (b && !b.dataset.locked) b.disabled = v;
    }

    // "Ném giúp mình": tính sẵn một cú ném đi qua tâm rổ
    function autoShot() {
      if (state !== 'idle' || !running) return;
      const apex = hoop.y - 58;
      const vy = -Math.sqrt(2 * G * (anchor.y - apex));
      const tUp = -vy / G;
      const tDown = Math.sqrt((2 * (hoop.y - apex)) / G);
      const vx = (hoop.x - anchor.x) / (tUp + tDown);
      ball.x = anchor.x;
      ball.y = anchor.y;
      launch(vx, vy);
    }

    /* ----- vật lý ----- */
    function step(dt) {
      const px = ball.x;
      const py = ball.y;
      ball.vy += G * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.a += ball.va * dt;

      // Tường hai bên
      if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx) * 0.6; }
      if (ball.x > W - BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx) * 0.6; }

      if (state === 'fly') {
        // Va chạm hai đầu vành rổ
        for (const p of rimPts()) {
          const dx = ball.x - p.x;
          const dy = ball.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < BR + 3 && d > 0) {
            const nx = dx / d;
            const ny = dy / d;
            ball.x = p.x + nx * (BR + 3);
            ball.y = p.y + ny * (BR + 3);
            const vn = ball.vx * nx + ball.vy * ny;
            if (vn < 0) {
              ball.vx -= 1.55 * vn * nx;
              ball.vy -= 1.55 * vn * ny;
              ball.va = ball.vx / 60;
              hitRim = true;
              netSway = Math.max(netSway, 3);
            }
          }
        }

        // Rơi xuyên qua vành từ trên xuống, nằm trong lòng rổ = ghi điểm
        if (py < hoop.y && ball.y >= hoop.y && ball.vy > 0 && Math.abs(ball.x - hoop.x) < RIM_R - 5) {
          state = 'scored';
          netSway = 11;
          netBulge = 1;
          ball.vx *= 0.25;
          onScore();
        }

        // Rơi khỏi sân = trượt
        if (ball.y > H + BR * 2 && ball.vy > 0) {
          misses++;
          resetBall();
          autoDisabled(false);
          onMessage(
            (hitRim ? 'Suýt nữa! Chạm vành rổ rồi. ' : 'Chệch rồi. ') +
            (misses >= 3 ? 'Mệt thì bấm “Ném giúp mình” nha.' : 'Kéo lại và ném tiếp nhé.')
          );
        }
      } else if (state === 'scored') {
        // Bóng trượt qua lưới rồi rơi ra
        const netBottom = hoop.y + 58;
        if (ball.y < netBottom) {
          ball.x += (hoop.x - ball.x) * Math.min(1, dt * 9);
          ball.vx *= 0.9;
          if (ball.vy > 330) ball.vy = 330;
        }
        if (ball.y > H + BR * 2) {
          state = 'gone';
        }
      }
    }

    /* ----- vẽ ----- */
    function drawBoard() {
      const { x, y } = hoop;
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(x - 56, y - 108, 112, 92, 8);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = CLAY;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 25, y - 58, 50, 38);
      ctx.fillStyle = CLAY;
      ctx.fillRect(x - 9, y - 16, 18, 10);
    }

    function rimArc(front) {
      ctx.strokeStyle = CLAY;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(hoop.x, hoop.y, RIM_R, RIM_RY, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
      ctx.stroke();
    }

    function drawNet() {
      const N = 10;
      const sway = Math.sin(t * 14) * netSway;
      const bR = 20 + netBulge * 6;
      const bY = hoop.y + 60 + netBulge * 8;
      const top = (i) => { const a = (i / N) * Math.PI * 2; return { x: hoop.x + Math.cos(a) * (RIM_R - 2), y: hoop.y + Math.sin(a) * RIM_RY }; };
      const bot = (i) => { const a = (i / N) * Math.PI * 2; return { x: hoop.x + Math.cos(a) * bR + sway, y: bY + Math.sin(a) * 4 }; };
      ctx.strokeStyle = 'rgba(15, 15, 16, .55)';
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'butt';
      for (let i = 0; i < N; i++) {
        const a = top(i), b = bot(i + 1), c = top(i + 1), d = bot(i);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
      }
      for (const k of [0.34, 0.68]) {
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const a = top(i), b = bot(i);
          const x = a.x + (b.x - a.x) * k;
          const y = a.y + (b.y - a.y) * k;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    function drawBall() {
      const s = ball.s;
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.scale(s, s);
      ctx.rotate(ball.a);
      const g = ctx.createRadialGradient(-6, -7, 2, 0, 0, BR);
      g.addColorStop(0, BALL_A);
      g.addColorStop(1, BALL_B);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, BR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, BR, 0, Math.PI * 2);
      ctx.moveTo(-BR, 0); ctx.lineTo(BR, 0);
      ctx.moveTo(0, -BR); ctx.lineTo(0, BR);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-BR * 1.45, 0, BR * 1.05, -0.95, 0.95);
      ctx.moveTo(0, 0);
      ctx.arc(BR * 1.45, 0, BR * 1.05, Math.PI - 0.95, Math.PI + 0.95);
      ctx.stroke();
      ctx.restore();
    }

    function drawGuides() {
      // bóng đổ + vòng gợi ý chỗ kéo
      ctx.fillStyle = 'rgba(15, 15, 16, .10)';
      ctx.beginPath();
      ctx.ellipse(anchor.x, anchor.y + BR + 10, BR * 1.1, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (state === 'idle') {
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = 'rgba(15, 15, 16, .35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(anchor.x, anchor.y, BR + 9 + Math.sin(t * 4) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (state === 'drag' && pull) {
        ctx.strokeStyle = 'rgba(15, 15, 16, .3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(anchor.x, anchor.y);
        ctx.lineTo(ball.x, ball.y);
        ctx.stroke();
        ctx.setLineDash([]);
        dotPts.forEach((p, i) => {
          const k = 1 - i / dotPts.length;
          ctx.fillStyle = `rgba(224, 112, 47, ${0.25 + 0.65 * k})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2 + 2.2 * k, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawBoard();
      rimArc(false);
      drawGuides();
      if (state !== 'gone') drawBall();
      drawNet();
      rimArc(true);
    }

    function frame(now) {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
      last = now;
      t += dt;

      if (spawnT < 1) {
        spawnT = Math.min(1, spawnT + dt * 2.6);
        const k = spawnT;
        ball.s = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 9) : 1; // nảy ra
      } else {
        ball.s = 1;
      }

      if (state === 'idle') ball.y = anchor.y + Math.sin(t * 3) * 3;

      if (state === 'fly' || state === 'scored') {
        const n = 4;
        for (let i = 0; i < n; i++) step(dt / n);
      }

      netSway *= Math.pow(0.04, dt);
      netBulge *= Math.pow(0.02, dt);

      draw();
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => { if (state === 'idle') layout(); };

    return {
      start() {
        running = true;
        layout();
        resetBall();
        onMessage('Kéo trái bóng xuống, nhắm vào rổ rồi thả tay.');
        window.addEventListener('resize', onResize);
        last = performance.now();
        raf = requestAnimationFrame(frame);
      },
      stop() {
        running = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
      },
      autoShot,
    };
  }

  /* ---------- Bong bóng bay liên tục ---------- */
  function addBubbles(count) {
    const layer = $('#bubbles');
    for (let i = 0; i < count; i++) {
      const b = document.createElement('span');
      b.className = 'fx-bubble';
      b.style.setProperty('--s', `${Math.round(18 + Math.random() * 46)}px`);
      b.style.setProperty('--x', `${(Math.random() * 96).toFixed(1)}%`);
      b.style.setProperty('--dur', `${(9 + Math.random() * 10).toFixed(1)}s`);
      b.style.setProperty('--delay', `${(-Math.random() * 18).toFixed(1)}s`); // âm: bong bóng đã bay sẵn giữa chừng
      b.style.setProperty('--sway', `${Math.round((Math.random() - 0.5) * 90)}px`);
      layer.append(b);
    }
  }

  function startBubbles() {
    if (reduceMotion) return;
    addBubbles(innerWidth < 640 ? 12 : 18);
  }

  // Bấm "Có": thêm một đợt bong bóng và tăng tốc tất cả lên gấp 8 lần như bị thổi bay
  function blowBubbles() {
    if (reduceMotion) return;
    const layer = $('#bubbles');
    addBubbles(innerWidth < 640 ? 14 : 20);
    const t0 = performance.now();
    const RAMP = 900;
    const TOP = 8;
    (function step(now) {
      const k = Math.min(1, (now - t0) / RAMP);
      const rate = 1 + (TOP - 1) * (1 - Math.pow(1 - k, 3));
      layer.getAnimations({ subtree: true }).forEach((a) => { a.playbackRate = rate; });
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- Sóng biển quét qua, đổi màu cả trang ---------- */
  const SEA_THEME_COLOR = '#B7C3D0';
  const THEMED = '.btn-dark, .btn-yes, .btn-no, .countdown div, .countdown span, .venue span';

  function seaWave() {
    const body = document.body;
    const sea = $('#sea');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', SEA_THEME_COLOR); // thanh trình duyệt trên điện thoại cũng đổi màu

    // Người dùng tắt chuyển động: đổi màu ngay, không có sóng
    if (reduceMotion || typeof sea.animate !== 'function') {
      body.classList.add('is-sea', 'sea-done');
      sea.remove();
      return;
    }

    const DUR = 2200;
    const FRAMES = 56;   // số khung hình tính sẵn
    const N = 28;        // số điểm trên mỗi mép sóng
    const AMP = 3.4;     // độ cao sóng (% chiều cao màn hình)
    const K = 1.7;       // số đỉnh sóng theo chiều ngang
    const START = 108;   // mép sóng bắt đầu dưới đáy màn hình
    const END = -30;     // và kết thúc ngoài mép trên (để bọt + sóng sậm trôi hẳn ra khỏi màn hình)
    const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

    const edge = (yc, phase) => {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const y = yc
          + AMP * Math.sin(2 * Math.PI * K * u + phase)
          + AMP * 0.35 * Math.sin(2 * Math.PI * K * 2.3 * u - phase * 1.3 + 1.2);
        pts.push(`${(u * 100).toFixed(1)}% ${y.toFixed(1)}%`);
      }
      return pts;
    };
    const fill = (top) => `polygon(${top.join(',')},100% 170%,0% 170%)`;
    const band = (top, bottom) => `polygon(${top.join(',')},${bottom.slice().reverse().join(',')})`;

    const frames = { foam: [], mid: [], base: [] };
    for (let f = 0; f <= FRAMES; f++) {
      const t = f / FRAMES;
      const yc = START + (END - START) * ease(t);
      const phase = t * Math.PI * 2 * 2.2; // sóng nhấp nhô khi trườn lên
      frames.foam.push({ clipPath: band(edge(yc, phase), edge(yc + 4.5, phase + 0.35)) });                 // bọt trắng ở đầu sóng
      frames.mid.push({ clipPath: band(edge(yc + 2.5, phase + 0.7), edge(yc + 20, phase + 1.4)) });       // dải nước xanh sậm
      frames.base.push({ clipPath: fill(edge(yc + 11, phase + 1.1)) });                                   // màu nền mới ở lại
    }

    const opts = { duration: DUR, easing: 'linear', fill: 'forwards' };
    const anims = [
      sea.querySelector('.sea-base').animate(frames.base, opts),
      sea.querySelector('.sea-mid').animate(frames.mid, opts),
      sea.querySelector('.sea-foam').animate(frames.foam, opts),
    ];

    // Nút, ô đếm ngược... đổi màu đúng lúc sóng chạm tới vị trí của chúng
    const H = innerHeight;
    document.querySelectorAll(THEMED).forEach((el) => {
      const r = el.getBoundingClientRect();
      const cy = Math.min(85, Math.max(15, ((r.top + r.height / 2) / H) * 100));
      const e = Math.min(1, Math.max(0, (START - (cy - 6)) / (START - END)));
      const t = Math.acos(1 - 2 * e) / Math.PI; // nghịch đảo của ease()
      el.style.setProperty('--wd', `${(t * DUR / 1000).toFixed(2)}s`);
    });
    body.classList.add('is-sea');

    Promise.allSettled(anims.map((a) => a.finished)).then(() => {
      body.classList.add('sea-done'); // nền thật đã mang màu mới, bỏ lớp sóng
      sea.remove();
    });
  }

  /* ---------- Nhạc nền ---------- */
  // Bỏ file nhạc của bạn vào public/assets/ với tên music.mp3 (hoặc đổi đường dẫn dưới đây).
  const MUSIC_SRC = '/assets/music.mp3';

  function setupMusic() {
    const btn = $('#musicBtn');
    const icon = btn.firstElementChild;
    const audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.volume = 0.5;
    audio.preload = 'auto';

    let wanted = false; // người xem đang muốn nghe nhạc

    function render() {
      btn.classList.toggle('is-playing', wanted);
      btn.setAttribute('aria-pressed', String(wanted));
      btn.setAttribute('aria-label', wanted ? 'Tắt nhạc nền' : 'Bật nhạc nền');
      icon.textContent = wanted ? '🎵' : '🔇';
    }

    async function play() {
      try {
        await audio.play();
        wanted = true;
        btn.hidden = false;
      } catch (err) {
        // Không có file / không đọc được: ẩn nút. Bị chặn tự phát: vẫn hiện nút để bấm tay.
        if (err && err.name === 'NotAllowedError') btn.hidden = false;
        wanted = false;
      }
      render();
    }

    btn.addEventListener('click', () => {
      if (wanted) { audio.pause(); wanted = false; render(); }
      else play();
    });

    // Chuyển tab / khoá màn hình thì tạm dừng, quay lại thì phát tiếp
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) audio.pause();
      else if (wanted) audio.play().catch(() => {});
    });

    return { start: play };
  }

  /* ---------- Khởi động ---------- */
  const music = setupMusic();
  setupGate(() => {
    music.start();
    startBubbles();
  });
  loadEvent().then((ev) => {
    renderEvent(ev);
    setupChoices(ev);
  });
})();
