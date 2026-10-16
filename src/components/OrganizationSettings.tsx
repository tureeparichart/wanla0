import React, { useState } from 'react';
import { 
  Personnel, 
  SchoolSettings, 
  LeaveQuota,
  LeaveRecord,
  AuditLog
} from '../types/leave';
import { 
  Building, 
  Save, 
  ShieldCheck, 
  UserCheck, 
  Phone, 
  MapPin, 
  Calendar, 
  Sheet, 
  CheckCircle2, 
  AlertCircle,
  MessageCircle,
  Send,
  ExternalLink,
  RotateCcw,
  Lock,
  AlertTriangle,
  X,
  ShieldAlert,
  FolderOpen,
  Zap,
  Server,
  Copy,
  Check,
  Search,
  Clock
} from 'lucide-react';
import { sendLineNotification } from '../services/storageService';

interface OrganizationSettingsProps {
  settings: SchoolSettings;
  allPersonnel: Personnel[];
  onSaveSettings: (newSettings: SchoolSettings) => void;
  currentPersonnel: Personnel;
  onOpenGoogleSheetsModal: () => void;
  onOpenLineModal: () => void;
  leaveRecords?: LeaveRecord[];
  onResetAllLeaveRecords?: () => void;
  auditLogs?: AuditLog[];
}

export const OrganizationSettings: React.FC<OrganizationSettingsProps> = ({
  settings,
  allPersonnel,
  onSaveSettings,
  currentPersonnel,
  onOpenGoogleSheetsModal,
  onOpenLineModal,
  leaveRecords = [],
  onResetAllLeaveRecords,
  auditLogs = [],
}) => {
  // Sub-tabs: 1. ตั้งค่าโรงเรียน & ผู้บริหาร & โควต้า | 2. Google Drive & Sheets | 3. LINE แจ้งเตือน | 4. Audit Log | 5. รีเซ็ตวันลา
  const [activeTab, setActiveTab] = useState<'info' | 'cloud' | 'line' | 'audit' | 'reset'>('info');

  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [schoolArea, setSchoolArea] = useState(settings.schoolArea);
  const [directorId, setDirectorId] = useState(settings.directorId);
  const [academicHeadId, setAcademicHeadId] = useState(settings.academicHeadId);
  const [adminId, setAdminId] = useState(settings.adminId);
  const [phone, setPhone] = useState(settings.phone);
  const [address, setAddress] = useState(settings.address);
  const [quotas, setQuotas] = useState<LeaveQuota[]>(settings.quotas);

  // Cloud & Backup storage
  const [googleDriveFolderUrl, setGoogleDriveFolderUrl] = useState(
    settings.googleDriveFolderUrl || 'https://drive.google.com/drive/folders/1Kor6QbWoqa_Z2d-D--6mjf-FBM0rVwkV'
  );
  const [googleSheetId, setGoogleSheetId] = useState(
    settings.googleSheetId || '17-pHOOF_bSojwTDUyXNI7bV-jFPQ8zcvsabgwTG-RbM'
  );
  const [googleSheetUrl, setGoogleSheetUrl] = useState(
    settings.googleSheetUrl || 'https://docs.google.com/spreadsheets/d/17-pHOOF_bSojwTDUyXNI7bV-jFPQ8zcvsabgwTG-RbM/edit'
  );
  const [googleSheetsWebhookUrl, setGoogleSheetsWebhookUrl] = useState(
    settings.googleSheetsWebhookUrl || 'https://script.google.com/macros/s/AKfycby2na_uHx_jvzv8okwAmLzRk4dYpD2T05j1zuts3WCB3N6P64rZByZxxi0Ag1OMiJZtKg/exec'
  );
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(settings.isAutoSyncEnabled !== false);

  // LINE Messaging API credentials
  const [isLineNotifyEnabled, setIsLineNotifyEnabled] = useState(settings.isLineNotifyEnabled ?? true);
  const [lineChannelAccessToken, setLineChannelAccessToken] = useState(
    settings.lineChannelAccessToken || '6MKdC7Jkh4/acf4lIOegOi7diwULWXIeZzZKdyGwo4Bp6jPwT/bAhVZxBBMVEpqosnvrFBX7EH7DJ4DKLvD4tuUReasJWhLJav03a8bau44Cq0QDNc0trdo0jO1M4j+N4gRNoTytEWQClQq3Cq6rWwdB04t89/1O/w1cDnyilFU='
  );
  const [lineGroupId, setLineGroupId] = useState(
    settings.lineGroupId || 'Cd6926103d0753bbc0bc55f449083f47a'
  );

  const [isSaved, setIsSaved] = useState(false);
  const [copiedDrive, setCopiedDrive] = useState(false);
  const [copiedSheet, setCopiedSheet] = useState(false);

  // Reset modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetPin, setResetPin] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Line test status
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Audit search filter
  const [auditSearchTerm, setAuditSearchTerm] = useState('');

  const handleConfirmReset = () => {
    if (resetPin !== '1234') {
      setResetError('รหัสผ่านไม่ถูกต้อง! กรุณากรอกรหัส 1234 อีกครั้ง');
      return;
    }
    if (onResetAllLeaveRecords) {
      onResetAllLeaveRecords();
    }
    setIsResetModalOpen(false);
    setResetPin('');
    setResetError(null);
    setResetSuccessMsg('รีเซ็ตข้อมูลวันลาทั้งหมดในระบบเรียบร้อยแล้ว (สถิติวันลาสะสมของบุคลากรทุกคนกลับเป็น 0 วัน)');
    setTimeout(() => setResetSuccessMsg(null), 6000);
  };

  const handleQuotaChange = (index: number, field: 'maxDays' | 'maxTimes', value: number) => {
    const nextQuotas = [...quotas];
    nextQuotas[index] = {
      ...nextQuotas[index],
      [field]: Math.max(0, value),
    };
    setQuotas(nextQuotas);
  };

  const handleTestNotification = async () => {
    if (!lineChannelAccessToken.trim() || !lineGroupId.trim()) {
      setTestStatus({
        type: 'error',
        message: 'กรุณากรอกทั้ง Channel Access Token และ Group ID ให้ครบถ้วนก่อนทดสอบ'
      });
      return;
    }

    setIsTesting(true);
    setTestStatus(null);

    const testSettings: SchoolSettings = {
      ...settings,
      isLineNotifyEnabled: true,
      lineChannelAccessToken: lineChannelAccessToken.trim(),
      lineGroupId: lineGroupId.trim(),
    };

    const testMessage = [
      `🔔 แจ้งเตือนบันทึกคำขอลาออนไลน์`,
      `${settings.schoolName || 'โรงเรียนบ้านห้วยไคร้'} ${settings.schoolArea || 'สพป.สุโขทัย เขต 2'}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📋 เลขที่คำขอ: ลร.04/2570`,
      `👤 ผู้ขอลา: ${currentPersonnel.prefix}${currentPersonnel.firstName} ${currentPersonnel.lastName}`,
      `💼 ตำแหน่ง: ${currentPersonnel.position}${currentPersonnel.academicStanding ? ' ' + currentPersonnel.academicStanding : ''}`,
      `📌 ประเภทการลา: ลาป่วย`,
      `📅 วันที่ลา: 15 ต.ค. 2569 (1 วันทำการ)`,
      `📝 เหตุผล: 123`,
      `📞 เบอร์โทรติดต่อ: ${currentPersonnel.phone || '087-654-3210'}`
    ].join('\n');

    try {
      const result = await sendLineNotification(testSettings, testMessage);
      if (result.success) {
        setTestStatus({
          type: 'success',
          message: result.message || 'ส่งข้อความทดสอบสำเร็จ! กรุณาตรวจสอบในกลุ่ม LINE ของโรงเรียน'
        });
      } else {
        setTestStatus({
          type: 'error',
          message: `ส่งข้อความไม่สำเร็จ: ${result.message}`
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setTestStatus({
        type: 'error',
        message: `เกิดข้อผิดพลาด: ${errorMsg}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings: SchoolSettings = {
      ...settings,
      schoolName: schoolName.trim(),
      schoolArea: schoolArea.trim(),
      directorId,
      academicHeadId,
      adminId,
      phone: phone.trim(),
      address: address.trim(),
      quotas,
      googleDriveFolderUrl: googleDriveFolderUrl.trim(),
      googleSheetId: googleSheetId.trim(),
      googleSheetUrl: googleSheetUrl.trim(),
      googleSheetsWebhookUrl: googleSheetsWebhookUrl.trim(),
      isAutoSyncEnabled,
      isLineNotifyEnabled,
      lineChannelAccessToken: lineChannelAccessToken.trim(),
      lineGroupId: lineGroupId.trim(),
    };
    onSaveSettings(updatedSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Filtered Audit logs
  const filteredLogs = auditLogs.filter(log => {
    const text = `${log.actorName} ${log.actorRole} ${log.action} ${log.details} ${log.timestamp}`.toLowerCase();
    return text.includes(auditSearchTerm.toLowerCase());
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Title */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 border border-amber-300">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              เมนูตั้งค่าหน่วยงาน (ผ่านการยืนยันรหัสความปลอดภัยแล้ว)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
            ข้อมูลโรงเรียนและการตั้งค่าระบบ
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            ระบบใช้งานได้ตลอดไป ไม่จำกัดปีงบประมาณ • สำรอง Google Drive, Sheets, LINE API และ Audit Log
          </p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 px-4 py-2 rounded-2xl text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            บันทึกการตั้งค่าเรียบร้อยแล้ว
          </div>
        )}

        {resetSuccessMsg && (
          <div className="flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-300 px-4 py-2 rounded-2xl text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-rose-600" />
            {resetSuccessMsg}
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs inside Organization Settings */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-2xl text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'info'
              ? 'bg-white text-blue-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building className="w-4 h-4 text-blue-600" />
          <span>1. ข้อมูลทั่วไป & ผู้บริหาร & โควต้า</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cloud')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'cloud'
              ? 'bg-white text-blue-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderOpen className="w-4 h-4 text-amber-600" />
          <span>2. Google Drive & Sheets ถาวร</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('line')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'line'
              ? 'bg-white text-blue-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageCircle className="w-4 h-4 text-emerald-600" />
          <span>3. LINE แจ้งเตือนกลุ่ม</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-white text-blue-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-indigo-600" />
          <span>4. ประวัติการใช้งาน (Audit Log) ({auditLogs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reset')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'reset'
              ? 'bg-white text-rose-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <RotateCcw className="w-4 h-4 text-rose-600" />
          <span>5. การรีเซ็ตข้อมูลวันลา</span>
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* ───────────── SUB-TAB 1: ข้อมูลทั่วไป, ผู้บริหาร และโควต้าวันลา ───────────── */}
        {activeTab === 'info' && (
          <div className="space-y-6">
            {/* Section 1: School General Info */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Building className="w-5 h-5 text-blue-900" />
                  1. ข้อมูลทั่วไปของสถานศึกษา
                </h3>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-300">
                  ระบบใช้งานได้ตลอดไป (ไม่จำกัดปีงบประมาณ)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อโรงเรียน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    สังกัดสำนักงานเขตพื้นที่การศึกษา <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolArea}
                    onChange={(e) => setSchoolArea(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เบอร์โทรศัพท์โรงเรียน
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ที่ตั้งสถานศึกษา
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-hidden"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>การใช้งานตลอดไป:</strong> ระบบจัดการวันลาเปิดให้ใช้งานได้ตลอดการปฏิบัติราชการโดยไม่ต้องระบุหรือเปลี่ยนปีงบประมาณในระบบ การยื่นใบลาและสถิติจะถูกบันทึกสะสมอย่างต่อเนื่อง
                </span>
              </div>
            </div>

            {/* Section 2: Key Personnel & Executive Roles */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2 pb-3 border-b border-slate-100">
                <UserCheck className="w-5 h-5 text-indigo-700" />
                2. ผู้มีอำนาจพิจารณาและผู้ดูแลระบบ
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ผู้อำนวยการโรงเรียน (ผู้มีอำนาจอนุมัติใบลา) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={directorId}
                    onChange={(e) => setDirectorId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-hidden"
                  >
                    {allPersonnel.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.prefix}{p.firstName} {p.lastName} ({p.position})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หัวหน้าฝ่ายบริหารงานวิชาการ (ผู้ตรวจความเห็น) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={academicHeadId}
                    onChange={(e) => setAcademicHeadId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-hidden"
                  >
                    {allPersonnel.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.prefix}{p.firstName} {p.lastName} ({p.position})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ผู้ดูแลระบบ (Admin) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-hidden"
                  >
                    {allPersonnel.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.prefix}{p.firstName} {p.lastName} ({p.position})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Leave Quotas */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-600" />
                  3. กำหนดสิทธิวันลาแต่ละประเภท (โควต้าจำนวนวันและครั้ง)
                </h3>
                <span className="text-xs text-slate-500">
                  ตามระเบียบ พ.ศ. 2555 สามารถปรับเปลี่ยนให้เหมาะสมกับโรงเรียนได้
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-3 px-4 font-semibold">ประเภทการลา</th>
                      <th className="py-3 px-4 font-semibold text-center w-36">โควต้าวันสูงสุด (วัน)</th>
                      <th className="py-3 px-4 font-semibold text-center w-36">โควต้าครั้งสูงสุด (ครั้ง)</th>
                      <th className="py-3 px-4 font-semibold">คำอธิบายและเงื่อนไข</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quotas.map((quota: LeaveQuota, idx: number) => (
                      <tr key={quota.leaveType} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {quota.title}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min="0"
                            value={quota.maxDays}
                            onChange={(e) => handleQuotaChange(idx, 'maxDays', Number(e.target.value))}
                            className="w-24 text-center bg-white border border-slate-300 rounded-xl py-1.5 font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-hidden mx-auto"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min="0"
                            value={quota.maxTimes}
                            onChange={(e) => handleQuotaChange(idx, 'maxTimes', Number(e.target.value))}
                            className="w-24 text-center bg-white border border-slate-300 rounded-xl py-1.5 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden mx-auto"
                          />
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {quota.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ───────────── SUB-TAB 2: Google Drive & Google Sheets ถาวร ───────────── */}
        {activeTab === 'cloud' && (
          <div className="space-y-6">
            {/* Google Drive Remembered Folder Section */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold shrink-0">
                    <FolderOpen className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      โฟลเดอร์ Google Drive สำหรับจดจำและสำรองข้อมูล
                    </h3>
                    <p className="text-xs text-slate-500">
                      เมื่อบันทึกข้อมูลการตั้งค่าระบบ ให้จดจำไว้ในโฟลเดอร์ Google Drive นี้ตลอดไป
                    </p>
                  </div>
                </div>

                <a
                  href={googleDriveFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <FolderOpen className="w-4 h-4 text-blue-200" />
                  <span>เปิด Google Drive โฟลเดอร์สำรอง</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL โฟลเดอร์ Google Drive (ฝังและจดจำในระบบอัตโนมัติ)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={googleDriveFolderUrl}
                    onChange={(e) => setGoogleDriveFolderUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:bg-white outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(googleDriveFolderUrl);
                      setCopiedDrive(true);
                      setTimeout(() => setCopiedDrive(false), 2000);
                    }}
                    className="flex items-center gap-1 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium cursor-pointer shrink-0 transition-colors"
                  >
                    {copiedDrive ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedDrive ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Google Sheets ID Section */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold shrink-0">
                    <Sheet className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      บันทึกข้อมูลการลาลง Google Sheet ถาวร
                    </h3>
                    <p className="text-xs text-slate-500">
                      Google Sheet ID: <strong className="text-emerald-800">{googleSheetId}</strong> ฝังลิงก์ในระบบ เข้าใช้งานจากเครื่องไหนก็ได้
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={googleSheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <Sheet className="w-4 h-4 text-emerald-200" />
                    <span>เปิดสเปรดชีต Google Sheet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={onOpenGoogleSheetsModal}
                    className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors shrink-0"
                  >
                    <span>ตั้งค่า Webhook</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Google Sheet ID (ถาวร)
                  </label>
                  <input
                    type="text"
                    value={googleSheetId}
                    onChange={(e) => {
                      setGoogleSheetId(e.target.value);
                      setGoogleSheetUrl(`https://docs.google.com/spreadsheets/d/${e.target.value}/edit`);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ลิงก์เต็มของ Google Sheet
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(googleSheetUrl);
                        setCopiedSheet(true);
                        setTimeout(() => setCopiedSheet(false), 2000);
                      }}
                      className="flex items-center gap-1 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium cursor-pointer shrink-0 transition-colors"
                    >
                      {copiedSheet ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedSheet ? 'คัดลอก' : 'คัดลอก'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Webhook URL optional input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Apps Script Web App Webhook URL (สำหรับการส่งข้อมูลอัตโนมัติ)
                </label>
                <input
                  type="url"
                  value={googleSheetsWebhookUrl}
                  onChange={(e) => setGoogleSheetsWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              {/* Auto-sync Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-semibold text-slate-800">
                    บันทึกข้อมูลอัตโนมัติทุกเครื่องทุกครั้ง (ข้ามอุปกรณ์ คอมพิวเตอร์ มือถือ แท็บเล็ต)
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    checked={isAutoSyncEnabled} 
                    onChange={(e) => setIsAutoSyncEnabled(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ───────────── SUB-TAB 3: LINE Messaging API ───────────── */}
        {activeTab === 'line' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-emerald-600" />
                    การแจ้งเตือนผ่านกลุ่ม LINE (LINE Messaging API)
                  </h3>
                  <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-300">
                    กลุ่มโรงเรียน
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  ระบบส่งข้อความแจ้งเตือนเข้ากลุ่มทันทีเมื่อครูกดยื่นใบลา โดยฝังรหัสเหล่านี้ไว้ในระบบ ไม่ต้องกรอกใหม่เมื่อเข้าจากเครื่องอื่น
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenLineModal}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                คู่มือการตั้งค่า LINE
              </button>
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <span className="font-bold text-slate-800 text-sm block">
                  เปิดระบบแจ้งเตือนเข้ากลุ่ม LINE อัตโนมัติ
                </span>
                <span className="text-xs text-slate-500">
                  เมื่อครูกดยื่นใบลา ระบบจะส่งข้อความแจ้งเตือนเข้ากลุ่มทันที
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLineNotifyEnabled}
                  onChange={(e) => setIsLineNotifyEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Channel Access Token (Long-lived) (ฝังในระบบ)
                </label>
                <textarea
                  rows={3}
                  value={lineChannelAccessToken}
                  onChange={(e) => setLineChannelAccessToken(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รหัสกลุ่ม LINE (Group ID) (ฝังในระบบ)
                </label>
                <input
                  type="text"
                  value={lineGroupId}
                  onChange={(e) => setLineGroupId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  รหัสกลุ่ม: Cd6926103d0753bbc0bc55f449083f47a
                </p>
              </div>
            </div>

            {/* Template Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                ตัวอย่างข้อความแจ้งเตือนที่จะส่งเข้ากลุ่ม LINE:
              </span>
              <pre className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-sans text-slate-800 leading-relaxed whitespace-pre-wrap select-all">
{`🔔 แจ้งเตือนบันทึกคำขอลาออนไลน์
โรงเรียนบ้านห้วยไคร้ สพป.สุโขทัย เขต 2
━━━━━━━━━━━━━━━━━━━━
📋 เลขที่คำขอ: ลร.04/2570
👤 ผู้ขอลา: นายชัชวาลย์ ใจภักดี
💼 ตำแหน่ง: ครู ชำนาญการ
📌 ประเภทการลา: ลาป่วย
📅 วันที่ลา: 15 ต.ค. 2569 (1 วันทำการ)
📝 เหตุผล: 123
📞 เบอร์โทรติดต่อ: 087-654-3210`}
              </pre>
            </div>

            {/* Test Status feedback */}
            {testStatus && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-medium flex items-center gap-2 animate-in fade-in ${
                  testStatus.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                    : 'bg-rose-50 border border-rose-300 text-rose-800'
                }`}
              >
                {testStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testStatus.message}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestNotification}
                disabled={isTesting}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <Send className="w-3.5 h-3.5 text-white" />
                {isTesting ? 'กำลังทดสอบส่ง...' : 'ทดสอบส่งข้อความเข้ากลุ่ม LINE ทันที'}
              </button>

              <button
                type="button"
                onClick={onOpenGoogleSheetsModal}
                className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Sheet className="w-3.5 h-3.5 text-emerald-600" />
                ดูโค้ด Apps Script สำหรับส่งเข้า LINE
              </button>
            </div>

            {/* Troubleshooting notice */}
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl text-[11px] text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>คำแนะนำหากกดส่งข้อความแล้วยังไม่ขึ้นแจ้งเตือนในกลุ่ม LINE:</span>
              </div>
              <p className="leading-relaxed text-slate-600">
                1. ตรวจสอบว่าได้เชิญบอท LINE เข้ากลุ่มโรงเรียน (Group ID: <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-200">{lineGroupId || 'Cd6926103d0753bbc0bc55f449083f47a'}</code>) เรียบร้อยแล้ว<br />
                2. หากเปิดเว็บผ่าน GitHub Pages ให้คัดลอกโค้ด Google Apps Script เวอร์ชันใหม่ไปวางทับในเมนู <strong>ส่วนขยาย &gt; Apps Script</strong> ของ Google Sheets แล้วกด <strong>Deploy (New version)</strong> เพื่อให้ Google Sheets ช่วยส่งข้อความเข้ากลุ่มโดยไม่มีปัญหา CORS
              </p>
            </div>
          </div>
        )}

        {/* ───────────── SUB-TAB 4: ประวัติการใช้งานระบบ (Audit Log) ───────────── */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-indigo-700" />
                  รายงานบันทึกประวัติการใช้งานระบบ (Audit Log)
                </h3>
                <p className="text-xs text-slate-500">
                  ประวัติการยื่นใบลา สลับผู้ใช้ และอนุมัติแบบเรียลไทม์เพื่อความโปร่งใส
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearchTerm}
                  onChange={(e) => setAuditSearchTerm(e.target.value)}
                  placeholder="ค้นหาประวัติการทำรายการ..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">ไม่พบบันทึกการทำรายการ</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold w-40">วัน-เวลา</th>
                        <th className="py-2.5 px-3 font-semibold w-48">ผู้ดำเนินการ</th>
                        <th className="py-2.5 px-3 font-semibold w-36">การกระทำ</th>
                        <th className="py-2.5 px-3 font-semibold">รายละเอียด</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                            {log.timestamp}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-slate-800 font-sans">{log.actorName}</p>
                            <p className="text-[10px] text-blue-700 font-sans">{log.actorRole}</p>
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            <span className="bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-sans">
                            {log.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ───────────── SUB-TAB 5: การรีเซ็ตวันลา ───────────── */}
        {activeTab === 'reset' && (
          <div className="bg-rose-50/60 border border-rose-200 rounded-3xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-rose-200">
              <h3 className="font-bold text-rose-900 text-base flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                การจัดการข้อมูลและการรีเซ็ตวันลาทั้งหมด
              </h3>
              <span className="text-xs bg-rose-200 text-rose-800 font-bold px-3 py-1 rounded-full border border-rose-300">
                สำหรับผู้ดูแลระบบ / ผู้บริหาร
              </span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 text-xs text-rose-950 max-w-2xl">
                <p className="font-semibold text-sm text-rose-900">
                  รีเซ็ตข้อมูลวันลาและสถิติการลาทั้งหมดในระบบ
                </p>
                <p className="text-slate-600 leading-relaxed">
                  การกดปุ่มนี้จะลบรายการใบลาทั้งหมดในระบบ และปรับยอดสถิติวันลาสะสมของข้าราชการครูและบุคลากรทุกคนให้เริ่มต้นใหม่ที่ 0 วัน (โควตาวันลาจะกลับคืนเต็มจำนวน)
                </p>
                <p className="text-slate-500 font-medium pt-1">
                  สถานะปัจจุบัน: มีข้อมูลคำขอลาในระบบ <strong className="text-rose-700">{leaveRecords.length}</strong> รายการ
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsResetModalOpen(true);
                  setResetPin('');
                  setResetError(null);
                }}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 py-3 rounded-2xl text-xs shadow-md transition-all cursor-pointer shrink-0"
              >
                <RotateCcw className="w-4 h-4 text-white" />
                รีเซ็ตวันลาทั้งหมด
              </button>
            </div>
          </div>
        )}

        {/* Save button (Always visible at bottom) */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-white px-8 py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            <Save className="w-4 h-4 text-amber-400" />
            บันทึกการตั้งค่าข้อมูลโรงเรียน
          </button>
        </div>
      </form>

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-700">
                <div className="p-2 bg-rose-100 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">
                    ยืนยันการรีเซ็ตวันลาทั้งหมด
                  </h3>
                  <p className="text-xs text-slate-500">
                    กรุณากรอกรหัสผ่าน 1234 เพื่อยืนยัน
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsResetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 space-y-2">
              <p className="font-bold text-rose-800">คำเตือนสำคัญ:</p>
              <p className="text-slate-700 leading-relaxed">
                ระบบจะล้างรายการคำขอลาทั้งหมด (<strong className="text-rose-700">{leaveRecords.length} รายการ</strong>) และรีเซ็ตยอดสถิติจำนวนวันลาของบุคลากรทุกคนให้เป็น 0 วัน การกระทำนี้ไม่สามารถย้อนกลับได้
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                กรุณายืนยันรหัสความปลอดภัย (1234):
              </label>
              <input
                type="password"
                maxLength={4}
                value={resetPin}
                onChange={(e) => {
                  setResetPin(e.target.value);
                  setResetError(null);
                }}
                placeholder="กรอกรหัส 1234"
                autoFocus
                className="w-full text-center text-xl tracking-[0.5em] font-mono py-3 bg-slate-50 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-hidden"
              />
              {resetError && (
                <p className="text-xs text-rose-600 font-semibold text-center animate-in fade-in">
                  {resetError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                ยืนยันรีเซ็ตวันลา
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
