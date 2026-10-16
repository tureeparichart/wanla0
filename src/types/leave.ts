export type Role = 'director' | 'academic_head' | 'teacher' | 'admin';

export type LeaveType = 
  | 'sick' // ลาป่วย
  | 'personal' // ลากิจส่วนตัว
  | 'maternity' // ลาคลอดบุตร
  | 'ordination' // ลาอุปสมบทหรือไปประกอบพิธีฮัจญ์
  | 'wife_delivery' // ลาไปช่วยเหลือภริยาที่คลอดบุตร
  | 'military' // ลาเข้ารับการตรวจเลือกหรือเตรียมพล
  | 'other'; // ลาอื่นๆ

export type LeaveStatus = 
  | 'pending_academic' // รอความเห็นหัวหน้าวิชาการ
  | 'pending_director' // รอผู้อำนวยการอนุมัติ
  | 'approved' // อนุมัติแล้ว
  | 'rejected' // ไม่อนุมัติ
  | 'cancelled'; // ยกเลิกโดยผู้ลา

export interface Personnel {
  id: string;
  prefix: string; // นาย, นาง, นางสาว, ดร.
  firstName: string;
  lastName: string;
  position: string; // เช่น ผู้อำนวยการโรงเรียน, ครู, ครูผู้ช่วย
  academicStanding: string; // เช่น ชำนาญการพิเศษ, ชำนาญการ, เชี่ยวชาญ, ครูผู้ช่วย, ปฏิบัติการ
  department?: string; // กลุ่มสาระการเรียนรู้
  address: string;
  phone: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  gender?: 'male' | 'female';
  signatureUrl?: string; // SVG data URL, uploaded image, or canvas drawing
  hireDate?: string;
}

export interface LeaveQuota {
  leaveType: LeaveType;
  title: string;
  maxDays: number; // โควต้าวันสูงสุด
  maxTimes: number; // โควต้าจำนวนครั้งสูงสุด
  description: string;
}

export interface LeaveRecord {
  id: string;
  referenceNumber: string; // เช่น ลร.04/2570
  personnelId: string;
  leaveType: LeaveType;
  fiscalYear?: number; // ตัวเลือกเสริม ไม่จำกัดปี
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isHalfDay?: boolean;
  halfDayPeriod?: 'morning' | 'afternoon';
  totalDays: number;
  reason: string;
  contactAddress: string;
  contactPhone: string;
  substitutePersonnelId?: string; // ผู้ปฏิบัติหน้าที่แทน
  substituteAccepted?: boolean;
  attachmentName?: string;
  
  // Signatures & Approvals
  submittedAt: string;
  applicantSignature: string; // Signature of the teacher
  
  // Academic Head Stage
  academicHeadId?: string;
  academicHeadComment?: string;
  academicHeadSignature?: string;
  academicHeadActionDate?: string;
  
  // Director Stage
  directorId?: string;
  directorComment?: string;
  directorSignature?: string;
  directorActionDate?: string;
  
  status: LeaveStatus;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
}

export interface SchoolSettings {
  schoolName: string; // โรงเรียนบ้านห้วยไคร้
  schoolArea: string; // สำนักงานเขตพื้นที่การศึกษาประถมศึกษาสุโขทัย เขต 2
  currentFiscalYear?: number; // ไม่จำกัดปีงบประมาณ
  directorId: string;
  academicHeadId: string;
  adminId: string;
  phone: string;
  address: string;
  googleDriveFolderUrl: string; // https://drive.google.com/drive/folders/1Kor6QbWoqa_Z2d-D--6mjf-FBM0rVwkV
  googleSheetId: string; // 17-pHOOF_bSojwTDUyXNI7bV-jFPQ8zcvsabgwTG-RbM
  googleSheetUrl: string; // https://docs.google.com/spreadsheets/d/17-pHOOF_bSojwTDUyXNI7bV-jFPQ8zcvsabgwTG-RbM/edit
  googleSheetsWebhookUrl?: string;
  isAutoSyncEnabled?: boolean;
  lastSyncedAt?: string;
  lineChannelAccessToken?: string;
  lineGroupId?: string;
  isLineNotifyEnabled?: boolean;
  quotas: LeaveQuota[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  details: string;
  ip?: string;
}

export interface ThaiHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  isSubstitution?: boolean;
}

export interface LeaveRightItem {
  id: string; // Unique ID: e.g. right-p001-sick-2570
  personnelId: string;
  personnelName: string;
  leaveType: LeaveType;
  leaveTypeLabel: string;
  maxDays: number;
  maxTimes: number;
  usedDays: number;
  usedTimes: number;
  remainingDays: number;
  remainingTimes: number;
  fiscalYear: number;
  updatedAt?: string;
}

export interface UserAccountItem {
  id: string; // Unique ID: e.g. usr-p-001
  personnelId: string;
  username: string;
  fullName: string;
  role: Role;
  pinCode: string;
  status: string;
  lastLoginAt?: string;
}

export interface DatabaseAllTablesPayload {
  personnel: any[];
  leaveRequests: any[];
  leaveRights: any[];
  leaveTypes: any[];
  holidays: any[];
  settings: any;
  users: any[];
  logs: any[];
  notifyLine?: boolean;
  lineToken?: string;
  lineTo?: string;
  lineMessage?: string;
}
