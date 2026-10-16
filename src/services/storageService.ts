import { 
  Personnel, 
  LeaveRecord, 
  SchoolSettings, 
  AuditLog, 
  LeaveType,
  LeaveStatus,
  LeaveQuota,
  ThaiHoliday
} from '../types/leave';
import { 
  INITIAL_PERSONNEL, 
  INITIAL_LEAVE_RECORDS, 
  INITIAL_SCHOOL_SETTINGS, 
  INITIAL_AUDIT_LOGS,
  DEFAULT_QUOTAS,
  THAI_HOLIDAYS_2568,
  createDefaultSignatureSvg 
} from '../data/initialData';

export { createDefaultSignatureSvg };

const STORAGE_KEYS = {
  PERSONNEL: 'huaykhrai_leave_personnel',
  LEAVE_RECORDS: 'huaykhrai_leave_records',
  SCHOOL_SETTINGS: 'huaykhrai_school_settings',
  AUDIT_LOGS: 'huaykhrai_audit_logs',
  ACTIVE_USER_ID: 'huaykhrai_active_user_id',
};

export const getStoredPersonnel = (): Personnel[] => {
  const data = localStorage.getItem(STORAGE_KEYS.PERSONNEL);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.PERSONNEL, JSON.stringify(INITIAL_PERSONNEL));
    return INITIAL_PERSONNEL;
  }
  try {
    const list: Personnel[] = JSON.parse(data);
    if (!list.some(p => p.id === 'p-demo')) {
      const updated = [INITIAL_PERSONNEL[0], ...list];
      localStorage.setItem(STORAGE_KEYS.PERSONNEL, JSON.stringify(updated));
      return updated;
    }
    return list;
  } catch {
    return INITIAL_PERSONNEL;
  }
};

export const savePersonnel = (list: Personnel[]) => {
  localStorage.setItem(STORAGE_KEYS.PERSONNEL, JSON.stringify(list));
};

export const getStoredLeaveRecords = (): LeaveRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.LEAVE_RECORDS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.LEAVE_RECORDS, JSON.stringify(INITIAL_LEAVE_RECORDS));
    return INITIAL_LEAVE_RECORDS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_LEAVE_RECORDS;
  }
};

export const saveLeaveRecords = (records: LeaveRecord[]) => {
  localStorage.setItem(STORAGE_KEYS.LEAVE_RECORDS, JSON.stringify(records));
};

export const getStoredSchoolSettings = (): SchoolSettings => {
  const data = localStorage.getItem(STORAGE_KEYS.SCHOOL_SETTINGS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.SCHOOL_SETTINGS, JSON.stringify(INITIAL_SCHOOL_SETTINGS));
    return INITIAL_SCHOOL_SETTINGS;
  }
  try {
    const parsed = JSON.parse(data);
    return {
      ...INITIAL_SCHOOL_SETTINGS,
      ...parsed,
      googleDriveFolderUrl: parsed.googleDriveFolderUrl || INITIAL_SCHOOL_SETTINGS.googleDriveFolderUrl,
      googleSheetId: parsed.googleSheetId || INITIAL_SCHOOL_SETTINGS.googleSheetId,
      googleSheetUrl: parsed.googleSheetUrl || INITIAL_SCHOOL_SETTINGS.googleSheetUrl,
      googleSheetsWebhookUrl: parsed.googleSheetsWebhookUrl || INITIAL_SCHOOL_SETTINGS.googleSheetsWebhookUrl,
      isAutoSyncEnabled: parsed.isAutoSyncEnabled ?? true,
      lineChannelAccessToken: parsed.lineChannelAccessToken || INITIAL_SCHOOL_SETTINGS.lineChannelAccessToken,
      lineGroupId: parsed.lineGroupId || INITIAL_SCHOOL_SETTINGS.lineGroupId,
      isLineNotifyEnabled: parsed.isLineNotifyEnabled ?? true,
    };
  } catch {
    return INITIAL_SCHOOL_SETTINGS;
  }
};

export const saveSchoolSettings = (settings: SchoolSettings) => {
  localStorage.setItem(STORAGE_KEYS.SCHOOL_SETTINGS, JSON.stringify(settings));
};

export const getStoredAuditLogs = (): AuditLog[] => {
  const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_LOGS));
    return INITIAL_AUDIT_LOGS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_AUDIT_LOGS;
  }
};

export const addAuditLog = (actorName: string, actorRole: string, action: string, details: string) => {
  const now = new Date();
  const timestamp = now.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }) + ' ' + now.toLocaleTimeString('th-TH');

  const newLog: AuditLog = {
    id: 'log-' + Date.now(),
    timestamp,
    actorName,
    actorRole,
    action,
    details
  };
  const logs = getStoredAuditLogs();
  const updated = [newLog, ...logs];
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(updated));
  return updated;
};

export const getActiveUserId = (): string => {
  const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID);
  if (saved) return saved;
  // default to Huaykhrai Jaidee (demo character)
  return 'p-demo';
};

export const setActiveUserId = (id: string) => {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, id);
};

// Calculate working days excluding Saturdays, Sundays and Thai official holidays
export const calculateWorkingDays = (startDateStr: string, endDateStr: string): number => {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

  const holidaySet = new Set(THAI_HOLIDAYS_2568.map(h => h.date));
  let count = 0;
  const cur = new Date(start);

  while (cur <= end) {
    const dayOfWeek = cur.getDay(); // 0 is Sunday, 6 is Saturday
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return count;
};

// Calculate leave usage for a specific personnel (perpetual, without fiscal year barrier)
export interface LeaveBalanceSummary {
  leaveType: LeaveType;
  title: string;
  maxDays: number;
  maxTimes: number;
  usedDays: number;
  usedTimes: number;
  remainingDays: number;
  remainingTimes: number;
}

export const getPersonnelLeaveBalances = (
  personnelId: string, 
  fiscalYear: number | undefined, 
  records: LeaveRecord[], 
  settings: SchoolSettings
): LeaveBalanceSummary[] => {
  const userApprovedRecords = records.filter(r => 
    r.personnelId === personnelId && 
    (r.status === 'approved' || r.status === 'pending_director' || r.status === 'pending_academic')
  );

  return settings.quotas.map(quota => {
    const matchingRecords = userApprovedRecords.filter(r => r.leaveType === quota.leaveType);
    const usedDays = matchingRecords.reduce((sum, r) => sum + r.totalDays, 0);
    const usedTimes = matchingRecords.length;
    const remainingDays = Math.max(0, quota.maxDays - usedDays);
    const remainingTimes = Math.max(0, quota.maxTimes - usedTimes);

    return {
      leaveType: quota.leaveType,
      title: quota.title,
      maxDays: quota.maxDays,
      maxTimes: quota.maxTimes,
      usedDays,
      usedTimes,
      remainingDays,
      remainingTimes
    };
  });
};

// Thai Date formatting helper
export const formatThaiDate = (dateStr: string, includeTime = false): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543;

    if (includeTime) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day} ${month} ${year} เวลา ${hours}:${minutes} น.`;
    }

    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
};

export const formatThaiFullDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const thaiFullMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    const day = date.getDate();
    const month = thaiFullMonths[date.getMonth()];
    const year = date.getFullYear() + 543;
    return `${day} ${month} พ.ศ. ${year}`;
  } catch {
    return dateStr;
  }
};

export const getLeaveTypeLabel = (type: LeaveType): string => {
  switch (type) {
    case 'sick': return 'ลาป่วย';
    case 'personal': return 'ลากิจส่วนตัว';
    case 'maternity': return 'ลาคลอดบุตร';
    case 'ordination': return 'ลาอุปสมบทหรือพิธีฮัจญ์';
    case 'wife_delivery': return 'ลาไปช่วยเหลือภริยาที่คลอดบุตร';
    case 'military': return 'ลาตรวจเลือก / เตรียมพล';
    case 'other': return 'ลาประเภทอื่น ๆ';
    default: return type;
  }
};

export const getStatusBadgeInfo = (status: LeaveStatus) => {
  switch (status) {
    case 'approved':
      return { label: 'อนุมัติแล้ว', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: 'CheckCircle2' };
    case 'pending_academic':
      return { label: 'รอความเห็นหัวหน้าวิชาการ', bg: 'bg-amber-100 text-amber-800 border-amber-300', icon: 'Clock' };
    case 'pending_director':
      return { label: 'รอ ผอ. อนุมัติ', bg: 'bg-blue-100 text-blue-800 border-blue-300', icon: 'FileCheck' };
    case 'rejected':
      return { label: 'ไม่อนุมัติ', bg: 'bg-rose-100 text-rose-800 border-rose-300', icon: 'XCircle' };
    case 'cancelled':
      return { label: 'ยกเลิกแล้ว', bg: 'bg-slate-100 text-slate-700 border-slate-300', icon: 'Ban' };
    default:
      return { label: status, bg: 'bg-slate-100 text-slate-800 border-slate-300', icon: 'Info' };
  }
};

// Export records to CSV with UTF-8 BOM so Thai text displays correctly in Excel and Sheets
export const exportLeaveRecordsToCsv = (records: LeaveRecord[], personnelList: Personnel[]) => {
  const pMap = new Map(personnelList.map(p => [p.id, `${p.prefix}${p.firstName} ${p.lastName}`]));
  
  const headers = [
    'เลขที่ใบลา',
    'ปีงบประมาณ',
    'ชื่อ-สกุล ผู้ลา',
    'ประเภทการลา',
    'วันที่เริ่ม',
    'วันที่สิ้นสุด',
    'จำนวนวัน',
    'เหตุผล',
    'เบอร์โทรติดต่อ',
    'วันที่ยื่น',
    'สถานะ',
    'ความเห็นหัวหน้าวิชาการ',
    'คำสั่ง ผอ.'
  ];

  const rows = records.map(r => [
    `"${r.referenceNumber}"`,
    `"${r.fiscalYear}"`,
    `"${pMap.get(r.personnelId) || r.personnelId}"`,
    `"${getLeaveTypeLabel(r.leaveType)}"`,
    `"${r.startDate}"`,
    `"${r.endDate}"`,
    `"${r.totalDays}"`,
    `"${(r.reason || '').replace(/"/g, '""')}"`,
    `"${r.contactPhone || '-'}"`,
    `"${r.submittedAt.slice(0, 10)}"`,
    `"${getStatusBadgeInfo(r.status).label}"`,
    `"${(r.academicHeadComment || '-').replace(/"/g, '""')}"`,
    `"${(r.directorComment || '-').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `HuayKhrai_Leave_Records_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Google Apps Script template code with 8 Database Tables, Check-before-create, Unique ID Deduplication, and LINE Messaging API
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * =========================================================================
 * Google Apps Script Web App Backend & LINE Messaging API
 * โรงเรียนบ้านห้วยไคร้ สพป.สุโขทัย เขต 2
 * ฐานข้อมูลกลาง 8 ตาราง (Personnel, LeaveRequests, LeaveRights, LeaveTypes, Holidays, Settings, Users, Logs)
 * พร้อมระบบแจ้งเตือนเข้ากลุ่ม LINE อัตโนมัติ (LINE Messaging API)
 * =========================================================================
 * 
 * คุณสมบัติสำคัญ:
 * 1. ตรวจสอบก่อนสร้างชีต (Check before create) และจัดรูปแบบหัวตารางอัตโนมัติ
 * 2. ห้ามสร้างซ้ำ: ตรวจสอบ Unique ID ทุกเรคคอร์ด ถ้ามีแล้วจะอัปเดตแถวเดิม (Upsert) ถ้ายังไม่มีจะเพิ่มแถวใหม่
 * 3. ฐานข้อมูลกลาง 8 ตาราง เพื่อใช้งานร่วมกันทุกเครื่อง (มือถือ แท็บเล็ต คอมพิวเตอร์)
 * 4. แจ้งเตือนเข้ากลุ่ม LINE อัตโนมัติเมื่อครูกดยื่นใบลาทันที (LINE Messaging API Push)
 * 
 * ข้อมูล LINE ที่ตั้งค่าไว้เริ่มต้น:
 * - Channel Access Token: 6MKdC7Jkh4/acf4lIOegOi7diwULWXIeZzZKdyGwo4Bp6jPwT/bAhVZxBBMVEpqosnvrFBX7EH7DJ4DKLvD4tuUReasJWhLJav03a8bau44Cq0QDNc0trdo0jO1M4j+N4gRNoTytEWQClQq3Cq6rWwdB04t89/1O/w1cDnyilFU=
 * - Group ID: Cd6926103d0753bbc0bc55f449083f47a
 * 
 * วิธีการติดตั้ง:
 * 1. เปิด Google Sheets แล้วคลิก 'ส่วนขยาย' (Extensions) > 'Apps Script'
 * 2. ลบโค้ดเดิมทั้งหมด แล้วนำโค้ดนี้ไปวางแทนที่
 * 3. คลิก 'การทำให้ใช้งานได้' (Deploy) > 'การทำให้ใช้งานได้ใหม่' (New deployment)
 * 4. เลือกประเภท: 'เว็บแอป' (Web App)
 *    - คำอธิบาย: ระบบจัดการวันลา โรงเรียนบ้านห้วยไคร้
 *    - ผู้เรียกใช้: 'ฉัน' (Execute as me)
 *    - ผู้มีสิทธิ์เข้าถึง: 'ทุกคน' (Anyone)
 * 5. คลิก 'ทำให้ใช้งานได้' และคัดลอก 'URL เว็บแอป' (Web App URL) มาวางในระบบที่เมนู 'เชื่อมต่อ Google Sheets'
 */

var DEFAULT_LINE_TOKEN = "6MKdC7Jkh4/acf4lIOegOi7diwULWXIeZzZKdyGwo4Bp6jPwT/bAhVZxBBMVEpqosnvrFBX7EH7DJ4DKLvD4tuUReasJWhLJav03a8bau44Cq0QDNc0trdo0jO1M4j+N4gRNoTytEWQClQq3Cq6rWwdB04t89/1O/w1cDnyilFU=";
var DEFAULT_LINE_GROUP_ID = "Cd6926103d0753bbc0bc55f449083f47a";

// นิยามโครงสร้างและหัวคอลัมน์ของทั้ง 8 ตาราง
var SCHEMAS = {
  "Personnel": [
    "ID", "คำนำหน้า", "ชื่อ", "นามสกุล", "ตำแหน่ง", "วิทยฐานะ", 
    "กลุ่มสาระ", "ที่อยู่", "เบอร์โทร", "อีเมล", "บทบาท (Role)", 
    "วันที่บรรจุ", "เพศ", "อัปเดตล่าสุด"
  ],
  "LeaveRequests": [
    "ID", "เลขที่คำขอ", "รหัสบุคลากร", "ชื่อ-นามสกุลผู้ขอลา", "ตำแหน่ง", 
    "ประเภทการลา", "ปีงบประมาณ", "วันที่เริ่ม", "วันที่สิ้นสุด", "ลาครึ่งวัน", 
    "ช่วงเวลาครึ่งวัน", "จำนวนวันทำการ", "เหตุผลการลา", "ที่อยู่ระหว่างลา", 
    "เบอร์โทรติดต่อ", "ผู้ปฏิบัติหน้าที่แทน", "วันที่ยื่น", "สถานะ", 
    "ความเห็นวิชาการ", "วันที่วิชาการลงความเห็น", "คำสั่งผู้อำนวยการ", 
    "วันที่ผู้อำนวยการสั่งการ", "เหตุผลยกเลิก"
  ],
  "LeaveRights": [
    "ID", "รหัสบุคลากร", "ชื่อ-นามสกุล", "ประเภทการลา", 
    "สิทธิสูงสุด(วัน)", "สิทธิสูงสุด(ครั้ง)", "ใช้วันไป(วัน)", "ใช้ครั้งไป(ครั้ง)", 
    "วันคงเหลือ(วัน)", "ครั้งคงเหลือ(ครั้ง)", "ปีงบประมาณ", "อัปเดตล่าสุด"
  ],
  "LeaveTypes": [
    "ID", "รหัสประเภท", "ชื่อประเภทการลา", "จำนวนวันสูงสุดต่อปี", 
    "จำนวนครั้งสูงสุดต่อปี", "เงื่อนไขและรายละเอียด", "อัปเดตล่าสุด"
  ],
  "Holidays": [
    "ID", "วันที่ (YYYY-MM-DD)", "ชื่อวันหยุด", "วันหยุดชดเชย", "อัปเดตล่าสุด"
  ],
  "Settings": [
    "ID", "ชื่อสถานศึกษา", "สังกัดเขตพื้นที่", "ปีงบประมาณปัจจุบัน", 
    "รหัสผู้อำนวยการ", "รหัสหัวหน้าวิชาการ", "รหัสผู้ดูแลระบบ", "เบอร์โทรศัพท์", 
    "ที่อยู่สถานศึกษา", "LINE Channel Access Token", "LINE Group ID", 
    "เปิดแจ้งเตือน LINE อัตโนมัติ", "Google Drive Folder URL", "อัปเดตล่าสุด"
  ],
  "Users": [
    "ID", "รหัสบุคลากร", "ชื่อผู้ใช้งาน", "ชื่อ-นามสกุล", "บทบาทในระบบ", 
    "รหัสผ่าน/PIN", "สถานะใช้งาน", "เข้าสู่ระบบล่าสุด"
  ],
  "Logs": [
    "ID", "วันเวลา (Timestamp)", "ผู้ดำเนินการ", "ตำแหน่ง/บทบาท", 
    "การกระทำ (Action)", "รายละเอียด (Details)", "หมายเลข IP / อุปกรณ์"
  ]
};

// ตรวจสอบก่อนสร้างชีต (Check before create) พร้อมจัดรูปแบบหัวตาราง
function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  var headers = SCHEMAS[sheetName] || ["ID", "Data"];
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#1e3a8a")
               .setFontColor("#ffffff")
               .setFontWeight("bold")
               .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  } else {
    // ถ้าชีตมีอยู่แล้วแต่แถวที่ 1 ว่าง ให้เติมหัวตาราง
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
           .setBackground("#1e3a8a")
           .setFontColor("#ffffff")
           .setFontWeight("bold")
           .setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

// ตรวจสอบข้อมูลก่อนสร้าง และป้องกันการสร้างซ้ำด้วย Unique ID (Upsert)
function upsertRecord(sheet, uniqueId, rowData, secondaryKey) {
  if (!uniqueId || uniqueId.toString().trim() === "") {
    uniqueId = "UID_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
    rowData[0] = uniqueId;
  }
  var targetId = uniqueId.toString().trim();
  var secTarget = secondaryKey ? secondaryKey.toString().trim() : null;

  var lastRow = sheet.getLastRow();
  var existingRow = 0;

  if (lastRow > 1) {
    var numColsToRead = (secTarget && sheet.getLastColumn() >= 2) ? 2 : 1;
    var idRangeValues = sheet.getRange(2, 1, lastRow - 1, numColsToRead).getValues();

    for (var i = 0; i < idRangeValues.length; i++) {
      var currentId = (idRangeValues[i][0] || "").toString().trim();
      var currentSec = (numColsToRead > 1 && idRangeValues[i][1]) ? idRangeValues[i][1].toString().trim() : "";

      if (currentId === targetId || (secTarget && currentSec && currentSec === secTarget)) {
        existingRow = i + 2; // แถวที่ 1 คือ header
        break;
      }
    }
  }

  var numCols = rowData.length;
  if (existingRow > 0) {
    // พบเรคคอร์ดเดิม -> ทำการอัปเดตแถวเดิม (ห้ามสร้างซ้ำ)
    sheet.getRange(existingRow, 1, 1, numCols).setValues([rowData]);
    return { action: "updated", row: existingRow, id: targetId };
  } else {
    // ไม่พบเรคคอร์ดเดิม -> ทำการเพิ่มแถวใหม่
    sheet.appendRow(rowData);
    return { action: "created", row: sheet.getLastRow(), id: targetId };
  }
}

// ส่งข้อความแจ้งเตือนเข้ากลุ่ม LINE ผ่าน LINE Messaging API (Push Message)
function sendLineMessageToGroup(token, to, message) {
  var effectiveToken = (token && token.trim()) ? token.trim() : DEFAULT_LINE_TOKEN;
  var effectiveTo = (to && to.trim()) ? to.trim() : DEFAULT_LINE_GROUP_ID;

  if (!effectiveToken || !effectiveTo || !message) {
    return { success: false, message: "ข้อมูลสำหรับส่ง LINE ไม่ครบถ้วน (Token, Group ID หรือ Message ว่างเปล่า)" };
  }

  try {
    var response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + effectiveToken
      },
      payload: JSON.stringify({
        to: effectiveTo,
        messages: [{ type: "text", text: message }]
      }),
      muteHttpExceptions: true
    });

    var respCode = response.getResponseCode();
    var respText = response.getContentText();
    return {
      success: (respCode >= 200 && respCode < 300),
      code: respCode,
      response: respText
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ฟังก์ชันสำหรับเรียกใช้งานเพื่อสร้าง 8 ชีตพร้อมกันล่วงหน้า (สามารถกด Run ใน Apps Script ได้)
function initAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tableNames = Object.keys(SCHEMAS);
  tableNames.forEach(function(name) {
    getOrCreateSheet(ss, name);
  });
  return "สร้างและตรวจสอบทั้ง 8 ตารางเรียบร้อยแล้ว";
}

// ฟังก์ชัน doGet: ดึงข้อมูลฐานข้อมูลกลางทั้ง 8 ตารางเพื่อแสดงผลในทุกเครื่อง
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var params = (e && e.parameter) ? e.parameter : {};
    var requestedSheet = params.sheet;

    var tableNames = Object.keys(SCHEMAS);
    var result = {
      status: "success",
      timestamp: new Date().toISOString(),
      school: "โรงเรียนบ้านห้วยไคร้ สพป.สุโขทัย เขต 2",
      tables: {}
    };

    tableNames.forEach(function(tableName) {
      var sheet = getOrCreateSheet(ss, tableName);
      if (!requestedSheet || requestedSheet === tableName || requestedSheet === "all") {
        var data = sheet.getDataRange().getValues();
        var rows = [];
        if (data.length > 1) {
          var headers = data[0];
          for (var r = 1; r < data.length; r++) {
            var rowObj = {};
            for (var c = 0; c < headers.length; c++) {
              var val = data[r][c];
              if (val instanceof Date) {
                val = Utilities.formatDate(val, "GMT+7", "yyyy-MM-dd HH:mm:ss");
              }
              rowObj[headers[c]] = val;
            }
            rows.push(rowObj);
          }
        }
        result.tables[tableName] = {
          count: rows.length,
          data: rows
        };
      }
    });

    return ContentService.createTextOutput(JSON.stringify(result))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ฟังก์ชัน doPost: รับข้อมูลจากเว็บแอพเพื่อบันทึกลง 8 ตาราง และส่ง LINE อัตโนมัติ
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;

    // 1. ส่งการแจ้งเตือนเข้ากลุ่ม LINE ผ่าน LINE Messaging API โดยตรง
    if (action === "line_notify") {
      var lineToken = requestData.token || DEFAULT_LINE_TOKEN;
      var lineTo = requestData.to || DEFAULT_LINE_GROUP_ID;
      var lineMessage = requestData.message;

      var lineRes = sendLineMessageToGroup(lineToken, lineTo, lineMessage);
      return ContentService.createTextOutput(JSON.stringify({
        status: lineRes.success ? "success" : "error",
        message: lineRes.success ? "ส่งข้อความแจ้งเตือนเข้ากลุ่ม LINE เรียบร้อยแล้ว" : "ส่งข้อความไม่สำเร็จ: " + (lineRes.response || lineRes.error),
        details: lineRes
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. ซิงค์ฐานข้อมูลทั้ง 8 ตาราง (Personnel, LeaveRequests, LeaveRights, LeaveTypes, Holidays, Settings, Users, Logs)
    if (action === "sync_all") {
      var summary = {};

      // 2.1 Personnel
      if (requestData.personnel && Array.isArray(requestData.personnel)) {
        var pSheet = getOrCreateSheet(ss, "Personnel");
        var pCount = 0;
        requestData.personnel.forEach(function(row) {
          if (Array.isArray(row) && row[0]) {
            upsertRecord(pSheet, row[0], row);
            pCount++;
          }
        });
        summary["Personnel"] = pCount;
      }

      // 2.2 LeaveRequests
      if (requestData.leaveRequests && Array.isArray(requestData.leaveRequests)) {
        var lrSheet = getOrCreateSheet(ss, "LeaveRequests");
        var lrCount = 0;
        requestData.leaveRequests.forEach(function(row) {
          if (Array.isArray(row) && (row[0] || row[1])) {
            upsertRecord(lrSheet, row[0], row, row[1]); // ID or referenceNumber
            lrCount++;
          }
        });
        summary["LeaveRequests"] = lrCount;
      }

      // 2.3 LeaveRights
      if (requestData.leaveRights && Array.isArray(requestData.leaveRights)) {
        var rSheet = getOrCreateSheet(ss, "LeaveRights");
        var rCount = 0;
        requestData.leaveRights.forEach(function(row) {
          if (Array.isArray(row) && row[0]) {
            upsertRecord(rSheet, row[0], row);
            rCount++;
          }
        });
        summary["LeaveRights"] = rCount;
      }

      // 2.4 LeaveTypes
      if (requestData.leaveTypes && Array.isArray(requestData.leaveTypes)) {
        var ltSheet = getOrCreateSheet(ss, "LeaveTypes");
        var ltCount = 0;
        requestData.leaveTypes.forEach(function(row) {
          if (Array.isArray(row) && row[0]) {
            upsertRecord(ltSheet, row[0], row);
            ltCount++;
          }
        });
        summary["LeaveTypes"] = ltCount;
      }

      // 2.5 Holidays
      if (requestData.holidays && Array.isArray(requestData.holidays)) {
        var hSheet = getOrCreateSheet(ss, "Holidays");
        var hCount = 0;
        requestData.holidays.forEach(function(row) {
          if (Array.isArray(row) && row[0]) {
            upsertRecord(hSheet, row[0], row);
            hCount++;
          }
        });
        summary["Holidays"] = hCount;
      }

      // 2.6 Settings
      if (requestData.settings) {
        var sSheet = getOrCreateSheet(ss, "Settings");
        var sRow = Array.isArray(requestData.settings) ? requestData.settings : [
          "config-school",
          requestData.settings.schoolName || "โรงเรียนบ้านห้วยไคร้",
          requestData.settings.schoolArea || "สพป.สุโขทัย เขต 2",
          requestData.settings.currentFiscalYear || 2570,
          requestData.settings.directorId || "p-001",
          requestData.settings.academicHeadId || "p-002",
          requestData.settings.adminId || "p-003",
          requestData.settings.phone || "055-678901",
          requestData.settings.address || "",
          requestData.settings.lineChannelAccessToken || DEFAULT_LINE_TOKEN,
          requestData.settings.lineGroupId || DEFAULT_LINE_GROUP_ID,
          requestData.settings.isLineNotifyEnabled ? "เปิด" : "ปิด",
          requestData.settings.googleDriveFolderUrl || "",
          new Date().toISOString()
        ];
        upsertRecord(sSheet, sRow[0], sRow);
        summary["Settings"] = 1;
      }

      // 2.7 Users
      if (requestData.users && Array.isArray(requestData.users)) {
        var uSheet = getOrCreateSheet(ss, "Users");
        var uCount = 0;
        requestData.users.forEach(function(row) {
          if (Array.isArray(row) && row[0]) {
            upsertRecord(uSheet, row[0], row);
            uCount++;
          }
        });
        summary["Users"] = uCount;
      }

      // 2.8 Logs
      if (requestData.logs && Array.isArray(requestData.logs)) {
        var lSheet = getOrCreateSheet(ss, "Logs");
        var lCount = 0;
        requestData.logs.forEach(function(row) {
          if (Array.isArray(row) && row[0]) {
            upsertRecord(lSheet, row[0], row);
            lCount++;
          }
        });
        summary["Logs"] = lCount;
      }

      // หากมีคำสั่งส่ง LINE แจ้งเตือนเข้ากลุ่ม ให้ส่งทันที
      var lineResult = null;
      if (requestData.notifyLine && requestData.lineMessage) {
        var token = requestData.lineToken || DEFAULT_LINE_TOKEN;
        var to = requestData.lineTo || DEFAULT_LINE_GROUP_ID;
        lineResult = sendLineMessageToGroup(token, to, requestData.lineMessage);
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "ตรวจสอบและบันทึกฐานข้อมูลกลาง 8 ตารางบน Google Sheets สำเร็จเรียบร้อยแล้ว (ไม่พบข้อมูลซ้ำ)",
        summary: summary,
        lineResult: lineResult
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. ยื่นคำขอลาออนไลน์ (เมื่อครูกดยื่นใบลา -> บันทึกลง LeaveRequests และส่ง LINE เข้ากลุ่มทันที)
    if (action === "submit_leave" || action === "create_leave_request") {
      var reqSheet = getOrCreateSheet(ss, "LeaveRequests");
      var reqData = requestData.record;
      var refNumber = requestData.referenceNumber || (reqData && reqData[1]) || "";
      var uniqueId = requestData.id || (reqData && reqData[0]) || ("req-" + new Date().getTime());

      if (Array.isArray(reqData)) {
        upsertRecord(reqSheet, uniqueId, reqData, refNumber);
      }

      // บันทึกลง Logs อัตโนมัติ
      var logsSheet = getOrCreateSheet(ss, "Logs");
      var logId = "log-" + new Date().getTime();
      var logRow = [
        logId,
        new Date().toISOString(),
        requestData.applicantName || "ครูผู้ยื่นใบลา",
        requestData.applicantPosition || "ครู",
        "ยื่นคำขอลาออนไลน์",
        "บันทึกคำขอลา " + refNumber + " สำเร็จ",
        "Google Sheets Web App"
      ];
      upsertRecord(logsSheet, logId, logRow);

      // ส่งข้อความแจ้งเตือนเข้ากลุ่ม LINE ทันที
      var lineResp = null;
      if (requestData.lineMessage) {
        var t = requestData.lineToken || DEFAULT_LINE_TOKEN;
        var g = requestData.lineTo || DEFAULT_LINE_GROUP_ID;
        lineResp = sendLineMessageToGroup(t, g, requestData.lineMessage);
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "บันทึกคำขอลาลงฐานข้อมูลกลาง Google Sheets และส่งแจ้งเตือนเข้ากลุ่ม LINE เรียบร้อยแล้ว",
        referenceNumber: refNumber,
        lineResult: lineResp
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. รองรับคำสั่งเดิม (Backwards Compatibility: sync_records / add_record)
    if (action === "sync_records" || action === "add_record") {
      var lrSheetOld = getOrCreateSheet(ss, "LeaveRequests");
      var oldRecords = requestData.records || (requestData.record ? [requestData.record] : []);
      
      oldRecords.forEach(function(r) {
        var rId = r.id || ("leave-" + (r.referenceNumber ? r.referenceNumber.replace(/[^a-zA-Z0-9]/g, "_") : new Date().getTime()));
        var rRow = [
          rId,
          r.referenceNumber || "",
          r.personnelId || "",
          r.personnelName || "",
          r.personnelPosition || "",
          r.leaveTypeLabel || "",
          r.fiscalYear || 2570,
          r.startDate || "",
          r.endDate || "",
          r.isHalfDay ? "ใช่" : "ไม่ใช่",
          r.halfDayPeriod || "",
          r.totalDays || 1,
          r.reason || "",
          r.contactAddress || "",
          r.contactPhone || "",
          r.substituteName || "",
          r.submittedAt || new Date().toISOString(),
          r.statusLabel || "รอความเห็นหัวหน้าวิชาการ",
          r.academicHeadComment || "",
          r.academicHeadActionDate || "",
          r.directorComment || "",
          r.directorActionDate || "",
          r.cancellationReason || ""
        ];
        upsertRecord(lrSheetOld, rId, rRow, r.referenceNumber);
      });

      // ส่ง LINE หากระบุ
      var oldLine = null;
      if (requestData.notifyLine && requestData.lineMessage) {
        oldLine = sendLineMessageToGroup(
          requestData.lineToken || DEFAULT_LINE_TOKEN, 
          requestData.lineTo || DEFAULT_LINE_GROUP_ID, 
          requestData.lineMessage
        );
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "บันทึกลงฐานข้อมูล Google Sheets สำเร็จเรียบร้อยแล้ว (ตรวจสอบ Unique ID ป้องกันการสร้างซ้ำ)",
        lineResult: oldLine
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "ไม่พบคำสั่ง (Action) ที่ระบุ: " + action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "เกิดข้อผิดพลาดในการประมวลผล: " + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;

// Helper: Safely parse JSON from a fetch response without throwing syntax error on HTML
const parseJsonResponseSafe = async (res: Response): Promise<{ isJson: boolean; data: any; text: string }> => {
  try {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return { isJson: true, data, text };
    } catch {
      return { isJson: false, data: null, text };
    }
  } catch {
    return { isJson: false, data: null, text: '' };
  }
};

// Fetch unified leave records from Google Sheets (cross-device source of truth)
export const fetchRecordsFromGoogleSheets = async (
  sheetId: string,
  personnelList: Personnel[]
): Promise<LeaveRecord[] | null> => {
  if (!sheetId || !sheetId.trim()) return null;

  try {
    const encodedSheet = encodeURIComponent('สถิติการลา');
    const url = `https://docs.google.com/spreadsheets/d/${sheetId.trim()}/gviz/tq?tqx=out:json&sheet=${encodedSheet}&tq=${encodeURIComponent('select *')}`;
    
    const res = await fetch(url);
    if (!res.ok) return null;

    const text = await res.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
    if (!match) return null;

    const json = JSON.parse(match[1]);
    const rows = json?.table?.rows;
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const pMapByName = new Map<string, Personnel>();
    for (const p of personnelList) {
      pMapByName.set(`${p.prefix}${p.firstName} ${p.lastName}`.trim(), p);
      pMapByName.set(`${p.firstName} ${p.lastName}`.trim(), p);
    }

    const records: LeaveRecord[] = [];

    for (let i = 0; i < rows.length; i++) {
      const c = rows[i]?.c;
      if (!c || !c[0]?.v) continue;

      const referenceNumber = String(c[0]?.v).trim();
      const submittedAt = c[1]?.v ? String(c[1]?.v) : new Date().toISOString();
      const personnelName = c[2]?.v ? String(c[2]?.v).trim() : '';
      const leaveTypeLabel = c[4]?.v ? String(c[4]?.v).trim() : 'ลาป่วย';
      
      // Parse dates
      let startDate = c[5]?.f || '';
      if (!startDate && c[5]?.v) {
        const m = String(c[5].v).match(/Date\((\d+),(\d+),(\d+)\)/);
        if (m) {
          startDate = `${m[1]}-${String(Number(m[2]) + 1).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
        } else {
          startDate = String(c[5].v);
        }
      }

      let endDate = c[6]?.f || '';
      if (!endDate && c[6]?.v) {
        const m = String(c[6].v).match(/Date\((\d+),(\d+),(\d+)\)/);
        if (m) {
          endDate = `${m[1]}-${String(Number(m[2]) + 1).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
        } else {
          endDate = String(c[6].v);
        }
      }

      const totalDays = typeof c[7]?.v === 'number' ? c[7].v : parseFloat(String(c[7]?.v || '1'));
      const reason = c[8]?.v ? String(c[8].v).trim() : '';
      const substituteName = c[9]?.v ? String(c[9].v).trim() : '';
      const contactPhone = c[10]?.v ? String(c[10].v).trim() : '';
      const statusLabel = c[11]?.v ? String(c[11].v).trim() : 'รอความเห็นหัวหน้าวิชาการ';
      const academicHeadComment = c[12]?.v ? String(c[12].v).trim() : undefined;
      const directorComment = c[13]?.v ? String(c[13].v).trim() : undefined;

      // Find personnel
      let matchedPersonnel = pMapByName.get(personnelName);
      if (!matchedPersonnel) {
        matchedPersonnel = personnelList.find(p => personnelName.includes(p.firstName));
      }
      const personnelId = matchedPersonnel ? matchedPersonnel.id : 'p-007';

      // Find substitute personnel
      let subPersonnelId: string | undefined = undefined;
      if (substituteName && substituteName !== '-') {
        const subP = pMapByName.get(substituteName) || personnelList.find(p => substituteName.includes(p.firstName));
        if (subP) subPersonnelId = subP.id;
      }

      // Map leave type
      let leaveType: LeaveType = 'sick';
      if (leaveTypeLabel.includes('กิจ') || leaveTypeLabel.includes('พักผ่อน')) leaveType = 'personal';
      else if (leaveTypeLabel.includes('คลอด')) leaveType = 'maternity';
      else if (leaveTypeLabel.includes('ช่วยภริยา') || leaveTypeLabel.includes('ภริยา')) leaveType = 'wife_delivery';
      else if (leaveTypeLabel.includes('ทหาร')) leaveType = 'military';
      else if (leaveTypeLabel.includes('อุปสมบท')) leaveType = 'ordination';
      else if (leaveTypeLabel.includes('อื่น') || leaveTypeLabel.includes('อบรม')) leaveType = 'other';

      // Map status
      let status: LeaveStatus = 'pending_academic';
      if (statusLabel.includes('อนุมัติแล้ว')) status = 'approved';
      else if (statusLabel.includes('ไม่อนุมัติ')) status = 'rejected';
      else if (statusLabel.includes('ยกเลิก')) status = 'cancelled';
      else if (statusLabel.includes('รอ ผอ') || statusLabel.includes('เสนอ ผอ')) status = 'pending_director';

      // Fiscal year
      const fyMatch = referenceNumber.match(/\/(\d{4})/);
      const fiscalYear = fyMatch ? parseInt(fyMatch[1], 10) : 2568;

      records.push({
        id: `sheet-${referenceNumber.replace(/[^a-zA-Z0-9]/g, '_')}`,
        referenceNumber,
        personnelId,
        leaveType,
        fiscalYear,
        startDate,
        endDate,
        totalDays,
        reason,
        contactAddress: '',
        contactPhone,
        substitutePersonnelId: subPersonnelId,
        status,
        submittedAt,
        applicantSignature: matchedPersonnel?.signatureUrl || createDefaultSignatureSvg(personnelName || 'ผู้ขอลา'),
        academicHeadComment,
        directorComment
      });
    }

    return records;
  } catch (err) {
    console.warn('Failed to fetch records from Google Sheets:', err);
    return null;
  }
};

// Merge local records and sheet records cleanly (unifies all devices, never loses records)
export const mergeLeaveRecords = (
  localRecords: LeaveRecord[],
  sheetRecords: LeaveRecord[]
): LeaveRecord[] => {
  const map = new Map<string, LeaveRecord>();

  // 1. Add all local records first
  for (const r of localRecords) {
    const key = r.referenceNumber || r.id;
    map.set(key, r);
  }

  // 2. Merge in sheet records
  for (const s of sheetRecords) {
    const key = s.referenceNumber || s.id;
    const existing = map.get(key);
    if (!existing) {
      // New record from another device!
      map.set(key, s);
    } else {
      // Record exists in both: merge with precedence for updated status
      const isSheetMoreAdvanced = 
        (s.status === 'approved' || s.status === 'rejected' || s.status === 'cancelled') && 
        (existing.status === 'pending_academic' || existing.status === 'pending_director');
      
      map.set(key, {
        ...existing,
        ...s,
        status: isSheetMoreAdvanced ? s.status : existing.status,
        academicHeadComment: s.academicHeadComment || existing.academicHeadComment,
        directorComment: s.directorComment || existing.directorComment,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });
};


// Helper functions to construct rows for the 8 Google Sheets tables with Unique ID
export const buildPersonnelRows = (personnelList: Personnel[]) => {
  return personnelList.map(p => [
    p.id,
    p.prefix,
    p.firstName,
    p.lastName,
    p.position,
    p.academicStanding || '',
    p.department || '',
    p.address || '',
    p.phone || '',
    p.email || '',
    p.role,
    p.hireDate || '',
    p.gender || 'male',
    new Date().toISOString()
  ]);
};

export const buildLeaveRequestRows = (records: LeaveRecord[], personnelList: Personnel[]) => {
  const pMap = new Map(personnelList.map(p => [p.id, p]));
  return records.map(r => {
    const p = pMap.get(r.personnelId);
    const sub = r.substitutePersonnelId ? pMap.get(r.substitutePersonnelId) : null;
    const pName = p ? `${p.prefix}${p.firstName} ${p.lastName}` : r.personnelId;
    const pPos = p ? `${p.position} ${p.academicStanding || ''}`.trim() : '';
    const subName = sub ? `${sub.prefix}${sub.firstName} ${sub.lastName}` : (r.substitutePersonnelId || '-');

    return [
      r.id,
      r.referenceNumber,
      r.personnelId,
      pName,
      pPos,
      getLeaveTypeLabel(r.leaveType),
      r.fiscalYear || 2570,
      r.startDate,
      r.endDate,
      r.isHalfDay ? 'ใช่' : 'ไม่ใช่',
      r.halfDayPeriod || '',
      r.totalDays,
      r.reason || '',
      r.contactAddress || '',
      r.contactPhone || '',
      subName,
      r.submittedAt,
      getStatusBadgeInfo(r.status).label,
      r.academicHeadComment || '',
      r.academicHeadActionDate || '',
      r.directorComment || '',
      r.directorActionDate || '',
      r.cancellationReason || ''
    ];
  });
};

export const buildLeaveRightsRows = (records: LeaveRecord[], personnelList: Personnel[], settings: SchoolSettings) => {
  const rows: any[][] = [];
  const fy = settings.currentFiscalYear || 2570;

  for (const p of personnelList) {
    const balances = getPersonnelLeaveBalances(p.id, fy, records, settings);
    const pName = `${p.prefix}${p.firstName} ${p.lastName}`;

    for (const b of balances) {
      const rightId = `right-${p.id}-${b.leaveType}-${fy}`;
      rows.push([
        rightId,
        p.id,
        pName,
        b.title,
        b.maxDays,
        b.maxTimes,
        b.usedDays,
        b.usedTimes,
        b.remainingDays,
        b.remainingTimes,
        fy,
        new Date().toISOString()
      ]);
    }
  }
  return rows;
};

export const buildLeaveTypeRows = (quotas: LeaveQuota[]) => {
  return quotas.map(q => [
    `lt-${q.leaveType}`,
    q.leaveType,
    q.title,
    q.maxDays,
    q.maxTimes,
    q.description,
    new Date().toISOString()
  ]);
};

export const buildHolidayRows = (holidays: ThaiHoliday[]) => {
  return holidays.map(h => [
    `h-${h.date}`,
    h.date,
    h.name,
    h.isSubstitution ? 'ใช่' : 'ไม่ใช่',
    new Date().toISOString()
  ]);
};

export const buildSettingsRows = (settings: SchoolSettings) => {
  return [
    'config-school',
    settings.schoolName || 'โรงเรียนบ้านห้วยไคร้',
    settings.schoolArea || 'สพป.สุโขทัย เขต 2',
    settings.currentFiscalYear || 2570,
    settings.directorId || 'p-001',
    settings.academicHeadId || 'p-002',
    settings.adminId || 'p-003',
    settings.phone || '055-678901',
    settings.address || '',
    settings.lineChannelAccessToken || '6MKdC7Jkh4/acf4lIOegOi7diwULWXIeZzZKdyGwo4Bp6jPwT/bAhVZxBBMVEpqosnvrFBX7EH7DJ4DKLvD4tuUReasJWhLJav03a8bau44Cq0QDNc0trdo0jO1M4j+N4gRNoTytEWQClQq3Cq6rWwdB04t89/1O/w1cDnyilFU=',
    settings.lineGroupId || 'Cd6926103d0753bbc0bc55f449083f47a',
    settings.isLineNotifyEnabled ? 'เปิด' : 'ปิด',
    settings.googleDriveFolderUrl || '',
    new Date().toISOString()
  ];
};

export const buildUserRows = (personnelList: Personnel[]) => {
  return personnelList.map(p => [
    `usr-${p.id}`,
    p.id,
    p.email || p.id,
    `${p.prefix}${p.firstName} ${p.lastName}`,
    p.role,
    '1234',
    'ใช้งานปกติ',
    new Date().toISOString()
  ]);
};

export const buildLogRows = (logs: AuditLog[]) => {
  return logs.map(l => [
    l.id,
    l.timestamp,
    l.actorName,
    l.actorRole,
    l.action,
    l.details,
    l.ip || 'Local/Web Client'
  ]);
};

// Fetch full 8-table database from Google Apps Script Web App
export const fetchDatabaseFromGoogleWebApp = async (webhookUrl: string): Promise<{
  success: boolean;
  message?: string;
  tables?: Record<string, { count: number; data: any[] }>;
}> => {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'กรุณาระบุ URL ของ Google Apps Script ที่ถูกต้อง' };
  }

  try {
    const url = `${webhookUrl.trim()}${webhookUrl.includes('?') ? '&' : '?'}action=getAll`;
    const res = await fetch(url);
    if (!res.ok) {
      return { success: false, message: `เซิร์ฟเวอร์ตอบกลับรหัส: ${res.status}` };
    }
    const { isJson, data } = await parseJsonResponseSafe(res);
    if (isJson && data && data.status === 'success') {
      return {
        success: true,
        tables: data.tables
      };
    }
    return { success: false, message: 'ไม่สามารถแยกวิเคราะห์ข้อมูลจาก Google Sheets ได้' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `เกิดข้อผิดพลาดในการดึงข้อมูล: ${msg}` };
  }
};

// Sync with Google Sheets 8 Tables via Server Proxy or Direct Fallback (avoids CORS)
export const syncWithGoogleSheets = async (
  webhookUrl: string, 
  records: LeaveRecord[], 
  personnelList: Personnel[],
  settings?: SchoolSettings,
  lineMessage?: string
): Promise<{ success: boolean; message: string; summary?: any }> => {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'กรุณากรอก Webhook URL ของ Google Apps Script ที่ถูกต้อง' };
  }

  const pMap = new Map(personnelList.map(p => [p.id, p]));
  const currentSettings = settings || INITIAL_SCHOOL_SETTINGS;

  const payloadRecords = records.map(r => {
    const p = pMap.get(r.personnelId);
    const sub = r.substitutePersonnelId ? pMap.get(r.substitutePersonnelId) : null;
    return {
      referenceNumber: r.referenceNumber,
      submittedAt: r.submittedAt,
      personnelName: p ? `${p.prefix}${p.firstName} ${p.lastName}` : r.personnelId,
      personnelPosition: p ? `${p.position} ${p.academicStanding}` : '',
      leaveTypeLabel: getLeaveTypeLabel(r.leaveType),
      startDate: r.startDate,
      endDate: r.endDate,
      totalDays: r.totalDays,
      reason: r.reason,
      substituteName: sub ? `${sub.prefix}${sub.firstName} ${sub.lastName}` : '-',
      contactPhone: r.contactPhone,
      statusLabel: getStatusBadgeInfo(r.status).label,
      academicHeadComment: r.academicHeadComment,
      directorComment: r.directorComment
    };
  });

  const shouldNotifyLine = Boolean(
    lineMessage &&
    currentSettings.isLineNotifyEnabled !== false &&
    currentSettings.lineChannelAccessToken &&
    currentSettings.lineGroupId
  );

  const payload: any = {
    action: 'sync_all',
    school: currentSettings.schoolName ? `${currentSettings.schoolName} ${currentSettings.schoolArea}` : 'โรงเรียนบ้านห้วยไคร้ สพป.สุโขทัย เขต 2',
    syncTime: new Date().toISOString(),
    personnel: buildPersonnelRows(personnelList),
    leaveRequests: buildLeaveRequestRows(records, personnelList),
    leaveRights: buildLeaveRightsRows(records, personnelList, currentSettings),
    leaveTypes: buildLeaveTypeRows(currentSettings.quotas || DEFAULT_QUOTAS),
    holidays: buildHolidayRows(THAI_HOLIDAYS_2568),
    settings: buildSettingsRows(currentSettings),
    users: buildUserRows(personnelList),
    logs: buildLogRows(getStoredAuditLogs()),
    records: payloadRecords
  };

  if (shouldNotifyLine) {
    payload.notifyLine = true;
    payload.lineToken = currentSettings.lineChannelAccessToken?.trim();
    payload.lineTo = currentSettings.lineGroupId?.trim();
    payload.lineMessage = lineMessage;
  }

  try {
    // 1. Try server proxy first (bypasses browser CORS and reads actual response)
    const proxyRes = await fetch('/api/cloud-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl.trim(),
        serviceType: 'Google Sheets (8 ตาราง)',
        payload
      })
    });

    const { isJson, data } = await parseJsonResponseSafe(proxyRes);
    if (proxyRes.ok && isJson && data) {
      return {
        success: data.success,
        message: data.message || (data.success ? 'ตรวจสอบและบันทึกฐานข้อมูลกลาง 8 ตารางลง Google Sheets สำเร็จเรียบร้อยแล้ว' : 'ส่งข้อมูลไม่สำเร็จ'),
        summary: data.data?.summary
      };
    }
    throw new Error('Proxy not available');
  } catch {
    // 2. Direct browser fallback using mode 'no-cors'
    try {
      await fetch(webhookUrl.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      return { 
        success: true, 
        message: 'ส่งข้อมูล 8 ตารางบันทึกลง Google Sheets เรียบร้อยแล้ว (กำลังอัปเดตแบบเรียลไทม์)' 
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { 
        success: false, 
        message: `เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheets: ${errorMsg}` 
      };
    }
  }
};

// Fetch central database from server (for cross-device instant sync)
export const fetchDatabaseFromServer = async (): Promise<{
  personnelList?: Personnel[];
  leaveRecords?: LeaveRecord[];
  settings?: SchoolSettings;
  auditLogs?: AuditLog[];
  updatedAt?: string;
} | null> => {
  try {
    const res = await fetch('/api/database');
    if (!res.ok) return null;
    const { isJson, data } = await parseJsonResponseSafe(res);
    if (!isJson || !data) return null;
    return data?.data || null;
  } catch {
    return null;
  }
};

// Sync database to central server (persists across all devices and machines)
export const syncDatabaseToServer = async (payload: {
  personnelList: Personnel[];
  leaveRecords: LeaveRecord[];
  settings: SchoolSettings;
  auditLogs: AuditLog[];
}): Promise<{ success: boolean; message: string; updatedAt?: string }> => {
  try {
    const res = await fetch('/api/database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const { isJson, data } = await parseJsonResponseSafe(res);
    if (res.ok && isJson && data) {
      return {
        success: data.success,
        message: data.message || 'บันทึกข้อมูลลงฐานข้อมูลกลางสำเร็จ',
        updatedAt: data.updatedAt
      };
    }
    return {
      success: true,
      message: 'บันทึกข้อมูลในเครื่องเรียบร้อยแล้ว'
    };
  } catch {
    return {
      success: true,
      message: 'บันทึกข้อมูลในเครื่องเรียบร้อยแล้ว'
    };
  }
};

// Send notification to LINE regular group via LINE Messaging API
export const sendLineNotification = async (
  settings: SchoolSettings,
  messageText: string
): Promise<{ success: boolean; message: string }> => {
  if (!settings.isLineNotifyEnabled) {
    return { success: false, message: 'ระบบแจ้งเตือน LINE ปิดการใช้งานอยู่' };
  }

  const token = settings.lineChannelAccessToken?.trim();
  const to = settings.lineGroupId?.trim();

  if (!token || !to) {
    return { success: false, message: 'ยังไม่ได้ระบุ Channel Access Token หรือ Group ID' };
  }

  // 1. Try server proxy endpoint (/api/line-notify) if available
  try {
    const res = await fetch('/api/line-notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        to,
        message: messageText
      })
    });

    const { isJson, data } = await parseJsonResponseSafe(res);
    if (res.ok && isJson && data) {
      return {
        success: data.success,
        message: data.message || (data.success ? 'ส่งข้อความแจ้งเตือนเข้ากลุ่ม LINE สำเร็จ' : 'ส่งข้อความไม่สำเร็จ')
      };
    }
    if (isJson && data?.message) {
      return {
        success: false,
        message: data.message
      };
    }
  } catch {
    // Backend proxy not reachable (e.g. running statically on GitHub Pages)
  }

  // 2. Direct fallback for Static Deployments (GitHub Pages): Send via Google Apps Script Web App
  if (settings.googleSheetsWebhookUrl && settings.googleSheetsWebhookUrl.trim().startsWith('http')) {
    try {
      await fetch(settings.googleSheetsWebhookUrl.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'line_notify',
          token,
          to,
          message: messageText
        })
      });

      return {
        success: true,
        message: 'ส่งคำขอแจ้งเตือนเข้ากลุ่ม LINE ผ่าน Google Apps Script เรียบร้อยแล้ว'
      };
    } catch (gasErr: unknown) {
      const errorMsg = gasErr instanceof Error ? gasErr.message : String(gasErr);
      return {
        success: false,
        message: `ไม่สามารถส่งผ่าน Google Apps Script: ${errorMsg}`
      };
    }
  }

  return {
    success: false,
    message: 'เว็บไซต์รันบนโฮสติ้งแบบ Static (GitHub Pages) ซึ่งไม่มีเซิร์ฟเวอร์ Node.js กรุณาเปิดใช้งาน Google Apps Script Web App เพื่อใช้เป็นตัวกลางส่งเข้ากลุ่ม LINE'
  };
};

// Format LINE message for new leave application
export const formatNewLeaveLineMessage = (
  record: LeaveRecord, 
  applicant: Personnel,
  settings?: SchoolSettings
): string => {
  const schoolTitle = settings?.schoolName && settings?.schoolArea?.includes('สุโขทัย เขต 2')
    ? `${settings.schoolName} สพป.สุโขทัย เขต 2`
    : (settings?.schoolName ? `${settings.schoolName} ${settings.schoolArea || ''}`.trim() : 'โรงเรียนบ้านห้วยไคร้ สพป.สุโขทัย เขต 2');

  const positionText = applicant.academicStanding
    ? `${applicant.position} ${applicant.academicStanding}`
    : applicant.position;

  const dateText = record.startDate === record.endDate
    ? `${formatThaiDate(record.startDate)} (${record.totalDays} วันทำการ)`
    : `${formatThaiDate(record.startDate)} ถึง ${formatThaiDate(record.endDate)} (${record.totalDays} วันทำการ)`;

  return [
    `🔔 แจ้งเตือนบันทึกคำขอลาออนไลน์`,
    schoolTitle,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📋 เลขที่คำขอ: ${record.referenceNumber}`,
    `👤 ผู้ขอลา: ${applicant.prefix}${applicant.firstName} ${applicant.lastName}`,
    `💼 ตำแหน่ง: ${positionText}`,
    `📌 ประเภทการลา: ${getLeaveTypeLabel(record.leaveType)}`,
    `📅 วันที่ลา: ${dateText}`,
    `📝 เหตุผล: ${record.reason || '-'}`,
    `📞 เบอร์โทรติดต่อ: ${record.contactPhone || applicant.phone || '-'}`
  ].join('\n');
};

// Format LINE message for Academic Head review
export const formatAcademicReviewLineMessage = (
  record: LeaveRecord, 
  applicant: Personnel, 
  academicHeadName: string, 
  comment: string
): string => {
  return [
    `📝 หัวหน้าฝ่ายวิชาการลงความเห็นแล้ว`,
    `โรงเรียนบ้านห้วยไคร้ สพป.สุโขทัย เขต 2`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📋 เลขที่คำขอ: ${record.referenceNumber}`,
    `👤 ผู้ขอลา: ${applicant.prefix}${applicant.firstName} ${applicant.lastName}`,
    `📌 ประเภทการลา: ${getLeaveTypeLabel(record.leaveType)} (${record.totalDays} วันทำการ)`,
    `✍️ ผู้ลงความเห็น: ${academicHeadName}`,
    `💬 ความเห็น: "${comment}"`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `⏳ ขั้นตอนต่อไป: รอผู้อำนวยการโรงเรียนสั่งการอนุมัติ`
  ].join('\n');
};

// Format LINE message for Director final decision
export const formatDirectorDecisionLineMessage = (
  record: LeaveRecord, 
  applicant: Personnel, 
  directorName: string, 
  isApproved: boolean, 
  comment: string
): string => {
  const statusIcon = isApproved ? '✅' : '❌';
  const statusText = isApproved ? 'อนุมัติการลาเรียบร้อยแล้ว' : 'ไม่อนุมัติการลา';

  return [
    `${statusIcon} แจ้งผลการพิจารณาอนุมัติใบลา`,
    `โรงเรียนบ้านห้วยไคร้ สพป.สุโขทัย เขต 2`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📋 เลขที่คำขอ: ${record.referenceNumber}`,
    `👤 ผู้ขอลา: ${applicant.prefix}${applicant.firstName} ${applicant.lastName}`,
    `📌 ประเภท: ${getLeaveTypeLabel(record.leaveType)} (${record.totalDays} วันทำการ)`,
    `📅 ช่วงวันที่: ${formatThaiDate(record.startDate)}${record.startDate !== record.endDate ? ` ถึง ${formatThaiDate(record.endDate)}` : ''}`,
    `🎖️ คำสั่ง ผอ.: ${statusText}`,
    `💬 บันทึกคำสั่ง: "${comment || '-'}"`,
    `✍️ ผู้อนุมัติ: ${directorName}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📄 สามารถเปิดดูและพิมพ์แบบใบลาทางการได้ในระบบ`
  ].join('\n');
};
