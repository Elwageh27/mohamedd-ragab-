
/* ==========================================
   MINIA LEAGUE API
   Google Sheets Database Connection
   ========================================== */

const SHEETS = {
  teams: "Teams",
  matches: "Matches",
  settings: "Settings",
  news: "News"
};

// الرصيد الأساسي بعد الأسبوع الرابع
const BASE_STATS = {
  beba: [4, 3, 1, 0, 11, 2, 10],
  matay: [4, 3, 0, 1, 10, 3, 9],
  maghagha_youth: [4, 3, 0, 1, 9, 6, 9],
  maghagha: [4, 3, 0, 1, 6, 6, 9],
  dermawas: [4, 2, 1, 1, 9, 5, 7],
  wasta: [4, 2, 0, 2, 15, 6, 6],
  ehnasia: [4, 2, 0, 2, 3, 8, 6],
  adwa: [4, 1, 0, 3, 4, 5, 3],
  samalout: [4, 0, 0, 4, 2, 13, 0],
  madina: [4, 0, 0, 4, 4, 19, 0]
};

const BASE_HEADERS = [
  "Base_Played", "Base_Won", "Base_Drawn",
  "Base_Lost", "Base_GF", "Base_GA", "Base_Points"
];

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    // Read one-time PIN verification result without ever putting the PIN in a URL.
    const authCheck = e && e.parameter && e.parameter.authCheck;
    if (authCheck) {
      const cache = CacheService.getScriptCache();
      const key = "auth_" + String(authCheck).replace(/[^a-zA-Z0-9_-]/g, "");
      const status = cache.get(key);
      cache.remove(key);
      const callback = e.parameter.callback;
      const payload = { authVerified: status === "ok" };
      if (callback && /^[a-zA-Z_$][\w.$]*$/.test(callback)) {
        return ContentService.createTextOutput(callback + "(" + JSON.stringify(payload) + ");")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return json(payload);
    }

    initializeDatabase();

    const result = getLeagueData();

    // دعم JSONP عند الحاجة للعرض من الموقع
    const callback = e && e.parameter && e.parameter.callback;
    if (callback && /^[a-zA-Z_$][\w.$]*$/.test(callback)) {
      return ContentService
        .createTextOutput(callback + "(" + JSON.stringify(result) + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return json({ success: true, data: result });
  } catch (err) {
    return json({ success: false, error: err.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    const body = JSON.parse(e.postData.contents || "{}");

    const savedPin = PropertiesService
      .getScriptProperties()
      .getProperty("ADMIN_PIN");

    if (body.action === "verifyPin") {
      const nonce = String(body.nonce || "");
      if (!/^[a-zA-Z0-9_-]{8,80}$/.test(nonce)) {
        return json({ success: false, error: "طلب تحقق غير صالح" });
      }
      CacheService.getScriptCache().put(
        "auth_" + nonce,
        savedPin && body.pin === savedPin ? "ok" : "no",
        60
      );
      return json({ success: true });
    }

    if (!savedPin || body.pin !== savedPin) {
      return json({
        success: false,
        error: "رمز الإدارة غير صحيح أو لم يتم إعداده"
      });
    }

    lock.waitLock(10000);
    initializeDatabase();

    let result;

    switch (body.action) {
      case "addNews":
        result = addNews(body.text);
        break;

      case "deleteNews":
        result = deleteNews(body.id);
        break;

      case "addMatch":
        result = addMatch(body);
        break;

      case "deleteMatch":
        result = deleteMatch(body.id);
        break;

      case "editMatch":
        result = editMatch(body);
        break;

      case "updateBaseStats":
        result = updateBaseStats(body.id, body.stats);
        break;

      case "addTeam":
        result = addTeam(body.name);
        break;

      case "renameTeam":
        result = renameTeam(body.id, body.name);
        break;

      case "deleteTeam":
        result = deleteTeam(body.id);
        break;

      case "updateSettings":
        result = updateSettings(body.values);
        break;

      default:
        throw new Error("الأمر غير معروف");
    }

    return json({
      success: true,
      message: "تم تنفيذ العملية بنجاح",
      result: result,
      data: getLeagueData()
    });

  } catch (err) {
    return json({ success: false, error: err.message });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

/* إنشاء وتجهيز قاعدة البيانات */

function initializeDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const teams = ss.getSheetByName(SHEETS.teams);
  const matches = ss.getSheetByName(SHEETS.matches);

  if (!teams || !matches) {
    throw new Error("تأكد من وجود ورقتي Teams و Matches");
  }

  // إضافة أعمدة الرصيد الأساسي دون حذف بيانات الفرق
  const headers = teams
    .getRange(1, 1, 1, Math.max(teams.getLastColumn(), 2))
    .getValues()[0];

  BASE_HEADERS.forEach((header, index) => {
    if (!headers.includes(header)) {
      const col = teams.getLastColumn() + 1;
      teams.getRange(1, col).setValue(header);
    }
  });

  const allHeaders = teams
    .getRange(1, 1, 1, teams.getLastColumn())
    .getValues()[0];

  const lastRow = teams.getLastRow();

  if (lastRow >= 2) {
    const rows = teams
      .getRange(2, 1, lastRow - 1, teams.getLastColumn())
      .getValues();

    const idCol = allHeaders.indexOf("Team_ID");

    BASE_HEADERS.forEach((header, index) => {
      const col = allHeaders.indexOf(header);

      rows.forEach((row, i) => {
        if (row[col] === "" || row[col] === null) {
          const teamId = String(row[idCol]);
          const base = BASE_STATS[teamId] || [0,0,0,0,0,0,0];
          teams.getRange(i + 2, col + 1).setValue(base[index]);
        }
      });
    });
  }

  let news = ss.getSheetByName(SHEETS.news);
  if (!news) {
    news = ss.insertSheet(SHEETS.news);
    news.appendRow(["News_ID", "News_Text", "Created_At"]);
  } else if (news.getLastRow() === 0) {
    news.appendRow(["News_ID", "News_Text", "Created_At"]);
  }

  const settings = ss.getSheetByName(SHEETS.settings);
  if (!settings) throw new Error("ورقة Settings غير موجودة");
}

/* قراءة بيانات الدوري */

function getLeagueData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const teamSheet = ss.getSheetByName(SHEETS.teams);
  const matchSheet = ss.getSheetByName(SHEETS.matches);
  const settingSheet = ss.getSheetByName(SHEETS.settings);

  const teamRows = teamSheet.getDataRange().getValues();
  const teamHeaders = teamRows.shift();

  const matchRows = matchSheet.getDataRange().getValues();
  const matchHeaders = matchRows.shift();

  const settingRows = settingSheet.getDataRange().getValues();
  const newsSheet = ss.getSheetByName(SHEETS.news);
  const newsRows = newsSheet ? newsSheet.getDataRange().getValues() : [["News_ID","News_Text","Created_At"]];

  const settings = {};
  settingRows.slice(1).forEach(row => {
    settings[row[0]] = row[1];
  });

  const matches = matchRows
    .filter(row => row[0] !== "")
    .map(row => ({
      id: String(row[0]),
      week: Number(row[1]),
      homeId: String(row[2]),
      homeGoals: Number(row[3]),
      awayId: String(row[4]),
      awayGoals: Number(row[5]),
      date: row[6] instanceof Date
        ? Utilities.formatDate(row[6], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(row[6] || "")
    }));

  const teams = teamRows
    .filter(row => row[0] !== "")
    .map(row => {
      const team = {};
      teamHeaders.forEach((h, i) => team[h] = row[i]);
      return {
        id: String(team.Team_ID),
        name: String(team.Team_Name),
        base: {
          played: Number(team.Base_Played || 0),
          won: Number(team.Base_Won || 0),
          drawn: Number(team.Base_Drawn || 0),
          lost: Number(team.Base_Lost || 0),
          gf: Number(team.Base_GF || 0),
          ga: Number(team.Base_GA || 0),
          points: Number(team.Base_Points || 0)
        }
      };
    });

  const standings = calculateStandings(teams, matches);
  const news = newsRows.slice(1).filter(row => row[0] !== "").map(row => ({
    id: String(row[0]),
    text: String(row[1] || ""),
    date: row[2] instanceof Date
      ? Utilities.formatDate(row[2], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")
      : String(row[2] || "")
  })).reverse();

  return {
    competition: {
      title: settings.League_Name || "القسم الرابع",
      subtitle: settings.Region || "منطقة المنيا وبني سويف",
      season: settings.Season || "2026 / 2027",
      currentWeek: Number(settings.Current_Week || 4),
      coachName: settings.Coach_Name || "كابتن رجب الوجيه",
      phone: String(settings.Coach_Phone || "")
    },
    teams: teams,
    matches: matches,
    standings: standings,
    news: news
  };
}

/* حساب الترتيب والنقاط */

function calculateStandings(teams, matches) {
  const table = teams.map(t => ({
    id: t.id,
    name: t.name,
    played: t.base.played,
    won: t.base.won,
    drawn: t.base.drawn,
    lost: t.base.lost,
    gf: t.base.gf,
    ga: t.base.ga,
    points: t.base.points
  }));

  const map = {};
  table.forEach(t => map[t.id] = t);

  matches.forEach(m => {
    const home = map[m.homeId];
    const away = map[m.awayId];

    if (!home || !away) return;

    const hg = Number(m.homeGoals);
    const ag = Number(m.awayGoals);

    home.played++;
    away.played++;

    home.gf += hg;
    home.ga += ag;
    away.gf += ag;
    away.ga += hg;

    if (hg > ag) {
      home.won++;
      away.lost++;
      home.points += 3;
    } else if (hg < ag) {
      away.won++;
      home.lost++;
      away.points += 3;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  });

  table.forEach(t => t.diff = t.gf - t.ga);

  table.sort((a, b) =>
    b.points - a.points ||
    b.diff - a.diff ||
    b.gf - a.gf
  );

  return table;
}

/* إضافة نتيجة مباراة */

function addMatch(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(SHEETS.matches);

  const week = Number(body.week);
  const hg = Number(body.homeGoals);
  const ag = Number(body.awayGoals);

  if (!body.homeId || !body.awayId)
    throw new Error("يجب اختيار الفريقين");

  if (body.homeId === body.awayId)
    throw new Error("لا يمكن اختيار الفريق نفسه");

  if (!Number.isInteger(week) || week < 1 ||
      !Number.isInteger(hg) || hg < 0 ||
      !Number.isInteger(ag) || ag < 0) {
    throw new Error("راجع الأسبوع ونتيجة المباراة");
  }

  const data = getLeagueData();
  const ids = data.teams.map(t => t.id);

  if (!ids.includes(body.homeId) || !ids.includes(body.awayId))
    throw new Error("الفريق غير موجود");

  const existing = data.matches.some(m =>
    m.week === week &&
    [m.homeId, m.awayId].includes(body.homeId) &&
    [m.homeId, m.awayId].includes(body.awayId)
  );

  if (existing)
    throw new Error("هذه المباراة مسجلة بالفعل في هذا الأسبوع");

  const id = Utilities.getUuid();

  sheet.appendRow([
    id, week, body.homeId, hg,
    body.awayId, ag, body.date || ""
  ]);

  updateSettingValue_("Current_Week",
    Math.max(Number(data.competition.currentWeek), week));

  return { id: id };
}

/* تعديل نتيجة مباراة مع الحفاظ على هوية الفريقين */

function editMatch(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.matches);
  const rows = sheet.getDataRange().getValues();
  const week = Number(body.week), hg = Number(body.homeGoals), ag = Number(body.awayGoals);
  if (!Number.isInteger(week) || week < 1 ||
      !Number.isInteger(hg) || hg < 0 ||
      !Number.isInteger(ag) || ag < 0) {
    throw new Error("راجع الأسبوع ونتيجة المباراة");
  }
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(body.id)) {
      sheet.getRange(i + 1, 2).setValue(week);
      sheet.getRange(i + 1, 4).setValue(hg);
      sheet.getRange(i + 1, 6).setValue(ag);
      sheet.getRange(i + 1, 7).setValue(body.date || "");
      return true;
    }
  }
  throw new Error("المباراة غير موجودة");
}

/* تصحيح الرصيد الأساسي السابق للمباريات المسجلة في النظام */

function updateBaseStats(id, stats) {
  if (!stats) throw new Error("بيانات التصحيح غير موجودة");
  const keys = ["played", "won", "drawn", "lost", "gf", "ga", "points"];
  keys.forEach(k => {
    const n = Number(stats[k]);
    if (!Number.isInteger(n) || n < 0) throw new Error("كل القيم يجب أن تكون أرقامًا صحيحة غير سالبة");
  });
  if (Number(stats.won) + Number(stats.drawn) + Number(stats.lost) !== Number(stats.played)) {
    throw new Error("مجموع الفوز والتعادل والخسارة يجب أن يساوي عدد المباريات");
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.teams);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf("Team_ID");
  const statCols = BASE_HEADERS.map(h => headers.indexOf(h));
  if (idCol < 0 || statCols.some(c => c < 0)) throw new Error("أعمدة الرصيد الأساسي غير مكتملة");
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      const ordered = [stats.played, stats.won, stats.drawn, stats.lost, stats.gf, stats.ga, stats.points];
      statCols.forEach((col, j) => sheet.getRange(i + 1, col + 1).setValue(Number(ordered[j])));
      return true;
    }
  }
  throw new Error("الفريق غير موجود");
}

/* حذف نتيجة */

function deleteMatch(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(SHEETS.matches);

  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }

  throw new Error("المباراة غير موجودة");
}

/* إدارة الفرق */

function addTeam(name) {
  if (!name || !String(name).trim())
    throw new Error("اكتب اسم الفريق");

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(SHEETS.teams);

  const id = Utilities.getUuid();

  sheet.appendRow([
    id, String(name).trim(),
    0, 0, 0, 0, 0, 0, 0
  ]);

  return { id: id };
}

function renameTeam(id, name) {
  if (!name || !String(name).trim())
    throw new Error("اكتب اسم الفريق");

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(SHEETS.teams);

  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sheet.getRange(i + 1, 2).setValue(String(name).trim());
      return true;
    }
  }

  throw new Error("الفريق غير موجود");
}

function deleteTeam(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const teams = ss.getSheetByName(SHEETS.teams);
  const matches = ss.getSheetByName(SHEETS.matches);

  const matchRows = matches.getDataRange().getValues();

  for (let i = 1; i < matchRows.length; i++) {
    if (String(matchRows[i][2]) === String(id) ||
        String(matchRows[i][4]) === String(id)) {
      throw new Error("احذف مباريات الفريق أولًا");
    }
  }

  const rows = teams.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      teams.deleteRow(i + 1);
      return true;
    }
  }

  throw new Error("الفريق غير موجود");
}

/* إعدادات البطولة */

function updateSettings(values) {
  if (!values) throw new Error("لا توجد إعدادات");

  Object.keys(values).forEach(key => {
    updateSettingValue_(key, values[key]);
  });

  return true;
}

function updateSettingValue_(key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(SHEETS.settings);

  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(key)) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }

  sheet.appendRow([key, value]);
}

/* إدارة شريط الأخبار */
function addNews(text) {
  const value = String(text || "").trim();
  if (!value) throw new Error("اكتب نص الخبر");
  if (value.length > 240) throw new Error("الخبر طويل جدًا (الحد الأقصى 240 حرفًا)");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.news);
  const id = Utilities.getUuid();
  sheet.appendRow([id, value, new Date()]);
  return { id: id };
}

function deleteNews(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.news);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  throw new Error("الخبر غير موجود");
}

/* اختبار الاتصال */

function testConnection() {
  initializeDatabase();
  const data = getLeagueData();

  Logger.log("عدد الفرق: " + data.teams.length);
  Logger.log("عدد المباريات المسجلة: " + data.matches.length);
  Logger.log("متصدر الدوري: " +
    (data.standings[0] ? data.standings[0].name : "لا يوجد"));

  return "الاتصال سليم";
}
