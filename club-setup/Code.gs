/**
 * קולט הרשמות מדף הנחיתה של המועדון ושומר אותן בגיליון Google Sheets.
 * הוראות התקנה: club-setup/README.md
 */
var SHEET_NAME = 'נרשמים';
var HEADERS = [
  'תאריך הרשמה', 'שם מלא', 'טלפון', 'עיר', 'נפשות', 'הוצאה חודשית',
  'אישור פרטיות', 'הסכמה לעדכונים', 'אימייל', 'קוד שיתוף', 'הגיע דרך קוד',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
];
var PHONE_COL = 3;   // column C
var REF_COL = 10;    // column J
var SPEND_OPTIONS = ['עד 1,500', '1,500–3,000', 'מעל 3,000'];

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.website) return json({ ok: true, ref: 'x' }); // honeypot filled → bot

    var phone = String(d.phone || '').replace(/\D/g, '');
    if (phone.indexOf('972') === 0) phone = '0' + phone.slice(3);
    var name = clean(d.name, 80);
    var city = clean(d.city, 60);
    if (name.length < 2 || city.length < 2 || !/^05\d{8}$/.test(phone) || d.privacy_consent !== true) {
      return json({ ok: false, error: 'invalid' });
    }
    if (SPEND_OPTIONS.indexOf(d.spend) === -1) return json({ ok: false, error: 'invalid' });

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sheet = getSheet();
      var last = sheet.getLastRow();
      if (last > 1) {
        var phones = sheet.getRange(2, PHONE_COL, last - 1, 1).getDisplayValues();
        for (var i = 0; i < phones.length; i++) {
          if (phones[i][0].replace(/\D/g, '') === phone) {
            var existingRef = sheet.getRange(i + 2, REF_COL).getDisplayValue();
            return json({ ok: true, duplicate: true, ref: existingRef });
          }
        }
      }
      var ref = /^[a-z0-9]{6,12}$/.test(d.ref) ? d.ref : Utilities.getUuid().slice(0, 8);
      sheet.appendRow([
        new Date(), name, "'" + phone, city, clean(d.household, 4), d.spend,
        'כן', d.updates_consent === true ? 'כן' : 'לא',
        d.updates_consent === true ? clean(d.email, 100) : '',
        ref, clean(d.referred_by, 20),
        clean(d.utm_source, 80), clean(d.utm_medium, 80), clean(d.utm_campaign, 80), clean(d.utm_content, 80),
      ]);
      return json({ ok: true, ref: ref });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json({ ok: false, error: 'server' });
  }
}

// Real sign-up count for the optional counter on the page.
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'count') {
    return json({ count: Math.max(0, getSheet().getLastRow() - 1) });
  }
  return json({ ok: true });
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.setRightToLeft(true);
  }
  return sheet;
}

// Trims, caps length and neutralises spreadsheet formulas (=, +, -, @).
function clean(value, max) {
  var s = String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
