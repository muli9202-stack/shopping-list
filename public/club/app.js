(function () {
  'use strict';

  var CFG = window.CLUB_CONFIG || {};
  var BRAND = (document.querySelector('meta[property="og:site_name"]') || {}).content || '';
  var fmt = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
  var $ = function (id) { return document.getElementById(id); };

  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { return null; }
  }

  /* ---------- Analytics (only when IDs are configured) ---------- */
  function loadAnalytics() {
    if (CFG.GA_MEASUREMENT_ID) {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CFG.GA_MEASUREMENT_ID);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', CFG.GA_MEASUREMENT_ID);
    }
    if (CFG.META_PIXEL_ID) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('init', CFG.META_PIXEL_ID);
      window.fbq('track', 'PageView');
    }
  }

  function track(event) {
    try {
      if (event === 'lead') {
        if (window.gtag) window.gtag('event', 'generate_lead');
        if (window.fbq) window.fbq('track', 'Lead');
      } else if (event === 'share') {
        if (window.gtag) window.gtag('event', 'share', { method: 'whatsapp' });
        if (window.fbq) window.fbq('trackCustom', 'ShareReferral');
      }
    } catch (e) { /* analytics must never break the page */ }
  }

  /* ---------- Attribution: referral code and UTM params ---------- */
  var params = new URLSearchParams(location.search);
  var attribution = store('club_attr') || {};
  ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
    var v = params.get(k);
    if (v) attribution[k] = v.slice(0, 80);
  });
  store('club_attr', attribution);

  function newRefCode() {
    var chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    var bytes = new Uint8Array(8);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
    return out;
  }

  function shareUrl(ref) {
    return location.origin + location.pathname + '?ref=' + encodeURIComponent(ref);
  }

  /* ---------- WhatsApp contact links ---------- */
  function setupWhatsApp() {
    var num = String(CFG.WHATSAPP_NUMBER || '').replace(/\D/g, '');
    if (!num) return;
    var href = 'https://wa.me/' + num + '?text=' + encodeURIComponent('היי, יש לי שאלה על ' + BRAND);
    $('fab-wa').href = href;
    $('fab-wa').hidden = false;
    $('footer-wa').href = href;
    $('footer-wa-wrap').hidden = false;
  }

  /* ---------- Real sign-up counter (optional) ---------- */
  function setupCounter() {
    if (!CFG.SHOW_COUNTER || !CFG.SHEET_ENDPOINT || !window.fetch) return;
    fetch(CFG.SHEET_ENDPOINT + '?action=count')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var n = Number(data && data.count);
        if (n >= (CFG.COUNTER_MIN || 0)) {
          $('counter').textContent = 'כבר ' + fmt.format(n) + ' משפחות ברשימת ההמתנה';
          $('counter').hidden = false;
        }
      })
      .catch(function () { /* no counter is better than a wrong one */ });
  }

  /* ---------- Savings calculator ---------- */
  var TIERS = [
    { upTo: 1500, rate: 0.03 },
    { upTo: 3000, rate: 0.04 },
    { upTo: Infinity, rate: 0.05 },
  ];

  function tierFor(amount) {
    for (var i = 0; i < TIERS.length; i++) if (amount <= TIERS[i].upTo) return i;
    return TIERS.length - 1;
  }

  function setupCalculator() {
    var range = $('spend-range');
    var num = $('spend-number');
    var min = Number(range.min), max = Number(range.max);
    var rows = document.querySelectorAll('.tiers tbody tr');

    function render(amount) {
      var t = tierFor(amount);
      var monthly = Math.round(amount * TIERS[t].rate);
      $('save-month').textContent = fmt.format(monthly);
      $('save-year').textContent = fmt.format(monthly * 12);
      $('calc-rate').textContent = 'לפי הנחה מתוכננת של ' + Math.round(TIERS[t].rate * 100) + '% על ' + fmt.format(amount) + ' ₪ בחודש';
      range.style.setProperty('--fill', ((amount - min) / (max - min) * 100) + '%');
      range.setAttribute('aria-valuetext', fmt.format(amount) + ' שקלים');
      for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('is-active', i === t);
    }

    range.addEventListener('input', function () {
      num.value = range.value;
      render(Number(range.value));
    });
    num.addEventListener('input', function () {
      var v = Number(num.value);
      if (!isFinite(v) || v < min || v > max) return;
      range.value = v;
      render(v);
    });
    num.addEventListener('change', function () {
      var v = Math.min(max, Math.max(min, Math.round(Number(num.value) || min)));
      num.value = v;
      range.value = v;
      render(v);
    });
    render(Number(range.value));
  }

  /* ---------- Sign-up form ---------- */
  var MSG = {
    name: 'נא למלא שם מלא',
    phone: 'נא למלא מספר נייד ישראלי תקין, למשל 050-1234567',
    city: 'נא למלא עיר מגורים',
    household: 'נא לבחור מספר נפשות',
    spend: 'נא לבחור הוצאה חודשית משוערת',
    privacy: 'כדי להצטרף צריך לאשר את מדיניות הפרטיות',
    email: 'כתובת האימייל לא תקינה',
  };

  function normalizePhone(raw) {
    var d = String(raw).replace(/\D/g, '');
    if (d.indexOf('972') === 0) d = '0' + d.slice(3);
    return d;
  }

  function setError(input, message) {
    var err = $(input.id + '-err');
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (!err) return;
    err.textContent = message || '';
    err.hidden = !message;
  }

  function checksFor(form) {
    var f = form.elements;
    var checks = [
      [f.name, f.name.value.trim().length >= 2, MSG.name],
      [f.phone, /^05\d{8}$/.test(normalizePhone(f.phone.value)), MSG.phone],
      [f.city, f.city.value.trim().length >= 2, MSG.city],
      [f.household, !!f.household.value, MSG.household],
      [f.spend, !!f.spend.value, MSG.spend],
      [f.privacy, f.privacy.checked, MSG.privacy],
    ];
    var email = f.email.value.trim();
    checks.push([f.email, !f.updates.checked || !email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email), MSG.email]);
    return checks;
  }

  // Returns the first invalid field (or null) and shows every error.
  function validate(form) {
    var firstBad = null;
    checksFor(form).forEach(function (c) {
      setError(c[0], c[1] ? '' : c[2]);
      if (!c[1] && !firstBad) firstBad = c[0];
    });
    return firstBad;
  }

  function send(payload) {
    if (!CFG.SHEET_ENDPOINT) {
      // Test mode: nothing leaves the browser.
      console.warn('[club] SHEET_ENDPOINT is empty – registration kept in this browser only.', payload);
      var local = store('club_test_signups') || [];
      local.push(payload);
      store('club_test_signups', local);
      return Promise.resolve({ ok: true, ref: payload.ref, test: true });
    }
    var body = JSON.stringify(payload);
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 20000);
    // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight.
    return fetch(CFG.SHEET_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body,
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (r) { return r.json(); })
      .catch(function (err) {
        if (err && err.name === 'AbortError') throw err;
        // Some browsers block reading the redirected response. The server de-duplicates
        // by phone, so re-sending without reading the reply is safe.
        return fetch(CFG.SHEET_ENDPOINT, { method: 'POST', mode: 'no-cors', body: body })
          .then(function () { return { ok: true, ref: payload.ref }; });
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  function showThanks(result) {
    var url = shareUrl(result.ref);
    var text = 'מצטרפים ל' + BRAND + ' – הנחה קבועה על כל הקניות בסופר, בלי קופונים. ההצטרפות חינם ולא מחייבת. כל מי שמצטרף מקרב את ההשקה: ' + url;
    $('share-url').value = url;
    $('wa-share').href = 'https://wa.me/?text=' + encodeURIComponent(text);
    if (result.duplicate) {
      $('thanks-title').textContent = 'אתם כבר ברשימת ההמתנה!';
      $('thanks-msg').textContent = 'המספר הזה כבר רשום אצלנו. נעדכן אתכם ברגע שהמועדון יוצא לדרך.';
    }
    if (navigator.share) {
      $('native-share').hidden = false;
      $('native-share').onclick = function () {
        navigator.share({ title: BRAND, text: text }).then(function () { track('share'); }).catch(function () {});
      };
    }
    $('join-form-wrap').hidden = true;
    $('thanks').hidden = false;
    $('thanks-title').focus();
    store('club_ref', result.ref);
  }

  function setupForm() {
    var form = $('join-form');
    var btn = $('submit-btn');
    var formError = $('form-error');
    var f = form.elements;

    f.updates.addEventListener('change', function () {
      $('email-field').hidden = !f.updates.checked;
      if (!f.updates.checked) { f.email.value = ''; setError(f.email, ''); }
    });

    // Once a field has shown an error, re-check it as the user fixes it.
    function recheck(e) {
      if (e.target.getAttribute('aria-invalid') !== 'true') return;
      checksFor(form).forEach(function (c) {
        if (c[0] === e.target) setError(c[0], c[1] ? '' : c[2]);
      });
    }
    form.addEventListener('input', recheck);
    form.addEventListener('change', recheck);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      formError.hidden = true;
      var bad = validate(form);
      if (bad) { bad.focus(); return; }
      if (f.website.value) return; // bot

      var payload = {
        name: f.name.value.trim(),
        phone: normalizePhone(f.phone.value),
        city: f.city.value.trim(),
        household: f.household.value,
        spend: f.spend.value,
        privacy_consent: true,
        updates_consent: f.updates.checked,
        email: f.updates.checked ? f.email.value.trim() : '',
        ref: store('club_ref') || newRefCode(),
        referred_by: attribution.ref || '',
        utm_source: attribution.utm_source || '',
        utm_medium: attribution.utm_medium || '',
        utm_campaign: attribution.utm_campaign || '',
        utm_content: attribution.utm_content || '',
        website: f.website.value,
      };

      btn.disabled = true;
      btn.textContent = 'שולחים…';
      send(payload)
        .then(function (res) {
          if (!res || !res.ok) throw new Error((res && res.error) || 'failed');
          track('lead');
          showThanks({ ref: res.ref || payload.ref, duplicate: !!res.duplicate });
        })
        .catch(function () {
          formError.textContent = 'משהו השתבש בשליחה. בדקו את החיבור לאינטרנט ונסו שוב.';
          formError.hidden = false;
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = 'הצטרפו לרשימת ההמתנה';
        });
    });

    $('copy-btn').addEventListener('click', function () {
      var input = $('share-url');
      var done = function () { $('copy-status').textContent = 'הקישור הועתק'; };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(input.value).then(done, function () { input.select(); });
      } else {
        input.select();
        try { document.execCommand('copy'); done(); } catch (err) { /* user can copy manually */ }
      }
    });
    $('wa-share').addEventListener('click', function () { track('share'); });
  }

  /* ---------- Accessibility widget ---------- */
  function setupA11y() {
    var root = document.documentElement;
    var toggle = $('a11y-toggle');
    var panel = $('a11y-panel');
    var state = Object.assign({ size: 100, contrast: false, links: false, font: false, motion: false }, store('club_a11y') || {});
    var MODES = ['contrast', 'links', 'font', 'motion'];

    function apply() {
      root.style.fontSize = state.size === 100 ? '' : state.size + '%';
      $('a11y-size-value').textContent = state.size + '%';
      MODES.forEach(function (m) {
        root.classList.toggle('a11y-' + m, state[m]);
        var b = panel.querySelector('[data-a11y="' + m + '"]');
        if (b) b.setAttribute('aria-pressed', String(state[m]));
      });
      store('club_a11y', state);
    }

    function setOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) panel.querySelector('button').focus();
    }

    toggle.addEventListener('click', function () { setOpen(panel.hidden); });
    $('a11y-close').addEventListener('click', function () { setOpen(false); toggle.focus(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!panel.hidden && !$('a11y').contains(e.target)) setOpen(false);
    });

    panel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a11y]');
      if (!b) return;
      var action = b.getAttribute('data-a11y');
      if (action === 'larger') state.size = Math.min(150, state.size + 10);
      else if (action === 'smaller') state.size = Math.max(90, state.size - 10);
      else if (action === 'reset') state = { size: 100, contrast: false, links: false, font: false, motion: false };
      else state[action] = !state[action];
      apply();
    });
    apply();
  }

  /* ---------- Init ---------- */
  function init() {
    $('year').textContent = new Date().getFullYear();
    setupA11y();
    setupWhatsApp();
    setupCalculator();
    setupForm();
    setupCounter();
    loadAnalytics();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
