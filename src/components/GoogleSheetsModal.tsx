import React, { useState, useEffect } from 'react';
import { 
  SchoolSettings, 
  LeaveRecord, 
  Personnel 
} from '../types/leave';
import { 
  GOOGLE_APPS_SCRIPT_TEMPLATE, 
  syncWithGoogleSheets,
  syncDatabaseToServer,
  fetchDatabaseFromGoogleWebApp,
  sendLineNotification,
  formatNewLeaveLineMessage
} from '../services/storageService';
import { 
  Sheet, 
  X, 
  Copy, 
  Check, 
  RefreshCw, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  Server,
  Database,
  Layers,
  ShieldCheck,
  Send,
  MessageCircle,
  Users,
  FileText,
  Award,
  Calendar,
  Settings as SettingsIcon,
  Clock
} from 'lucide-react';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SchoolSettings;
  onSaveCloudUrls: (googleUrl: string, autoSync: boolean) => void;
  leaveRecords: LeaveRecord[];
  allPersonnel: Personnel[];
  onTriggerSyncAll?: () => Promise<void>;
  onPullFromSheet?: () => Promise<any>;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveCloudUrls,
  leaveRecords,
  allPersonnel,
  onTriggerSyncAll,
  onPullFromSheet,
}) => {
  const [sheetsUrl, setSheetsUrl] = useState(settings.googleSheetsWebhookUrl || '');
  const [autoSync, setAutoSync] = useState(settings.isAutoSyncEnabled !== false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isTestingLine, setIsTestingLine] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const DATABASE_TABLES = [
    { name: 'Personnel', th: 'ข้อมูลบุคลากร', icon: Users, desc: 'รายชื่อ ตำแหน่ง วิทยฐานะ สิทธิ์ผู้ใช้งาน', color: 'bg-blue-50 text-blue-700 border-blue-200', count: allPersonnel.length },
    { name: 'LeaveRequests', th: 'บันทึกคำขอลา', icon: FileText, desc: 'คำขอลา วันที่ลา สถานะ ลายเซ็น ความเห็น', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', count: leaveRecords.length },
    { name: 'LeaveRights', th: 'สิทธิวันลาคงเหลือ', icon: Award, desc: 'โควต้า ใช้ไป คงเหลือ รายบุคคล', color: 'bg-purple-50 text-purple-700 border-purple-200', count: allPersonnel.length * 7 },
    { name: 'LeaveTypes', th: 'ประเภทการลา', icon: Layers, desc: 'หลักเกณฑ์และเงื่อนไขการลาตามระเบียบ', color: 'bg-amber-50 text-amber-700 border-amber-200', count: settings.quotas?.length || 7 },
    { name: 'Holidays', th: 'ปฏิทินวันหยุด', icon: Calendar, desc: 'วันหยุดราชการประจำปี คำนวณวันทำการ', color: 'bg-rose-50 text-rose-700 border-rose-200', count: 18 },
    { name: 'Settings', th: 'การตั้งค่าระบบ', icon: SettingsIcon, desc: 'ข้อมูลโรงเรียน ปีงบประมาณ โทเค็น LINE', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', count: 1 },
    { name: 'Users', th: 'บัญชีผู้ใช้งาน', icon: ShieldCheck, desc: 'สิทธิ์ระบบและรหัส PIN ปลอดภัย', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', count: allPersonnel.length },
    { name: 'Logs', th: 'ประวัติการใช้งาน', icon: Clock, desc: 'Audit Log บันทึกทุกกิจกรรมของระบบ', color: 'bg-slate-100 text-slate-700 border-slate-300', count: 'Auto' },
  ];

  useEffect(() => {
    if (settings.googleSheetsWebhookUrl) {
      setSheetsUrl(settings.googleSheetsWebhookUrl);
    }
    setAutoSync(settings.isAutoSyncEnabled !== false);
  }, [settings.googleSheetsWebhookUrl, settings.isAutoSyncEnabled, isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleSaveAndSync = async () => {
    onSaveCloudUrls(sheetsUrl.trim(), autoSync);
    setIsSyncing(true);
    setSyncStatus(null);

    const results: string[] = [];
    let hasError = false;

    try {
      // 1. Sync to Central Server persistent store
      const serverRes = await syncDatabaseToServer({
        personnelList: allPersonnel,
        leaveRecords,
        settings: {
          ...settings,
          googleSheetsWebhookUrl: sheetsUrl.trim(),
          isAutoSyncEnabled: autoSync,
          lastSyncedAt: new Date().toISOString()
        },
        auditLogs: []
      });

      if (serverRes.success) {
        results.push('ฐานข้อมูลเซิร์ฟเวอร์: เรียบร้อย');
      }

      // 2. Sync to Google Sheets (8 Tables) if provided
      if (sheetsUrl.trim()) {
        const sheetsRes = await syncWithGoogleSheets(sheetsUrl.trim(), leaveRecords, allPersonnel, settings);
        if (sheetsRes.success) {
          results.push('Google Sheets 8 ตาราง: ซิงค์สำเร็จ (ตรวจสอบ Unique ID ป้องกันสร้างซ้ำ)');
        } else {
          results.push(`Google Sheets: ${sheetsRes.message}`);
          hasError = true;
        }
      }

      if (onTriggerSyncAll) {
        await onTriggerSyncAll();
      }

      if (results.length === 0) {
        setSyncStatus({ 
          type: 'success', 
          message: 'บันทึกการตั้งค่าลงฐานข้อมูลกลางสำเร็จ (พร้อมทำงานแบบเรียลไทม์ทุกเครื่อง)' 
        });
      } else if (hasError) {
        setSyncStatus({ 
          type: 'error', 
          message: results.join(' • ') 
        });
      } else {
        setSyncStatus({ 
          type: 'success', 
          message: 'ซิงค์ฐานข้อมูล 8 ตารางสำเร็จครบถ้วน: ' + results.join(' | ') 
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setSyncStatus({ type: 'error', message: `ข้อผิดพลาดในการซิงค์: ${errorMsg}` });
    } finally {
      setIsSyncing(false);
    }
  };

  // Quick test sending LINE group notification
  const handleTestLineNotify = async () => {
    setIsTestingLine(true);
    setSyncStatus(null);

    const sampleMessage = [
      `🔔 แจ้งเตือนบันทึกคำขอลาออนไลน์`,
      `โรงเรียนบ้านห้วยไคร้ สพป.สุโขทัย เขต 2`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📋 เลขที่คำขอ: ลร.04/2570`,
      `👤 ผู้ขอลา: นายชัชวาลย์ ใจภักดี`,
      `💼 ตำแหน่ง: ครู ชำนาญการ`,
      `📌 ประเภทการลา: ลาป่วย`,
      `📅 วันที่ลา: 15 ต.ค. 2569 (1 วันทำการ)`,
      `📝 เหตุผล: 123`,
      `📞 เบอร์โทรติดต่อ: 087-654-3210`
    ].join('\n');

    try {
      const res = await sendLineNotification(settings, sampleMessage);
      if (res.success) {
        setSyncStatus({
          type: 'success',
          message: 'ส่งข้อความทดสอบเข้ากลุ่ม LINE (Group ID: Cd6926103d0753bbc0bc55f449083f47a) สำเร็จเรียบร้อยแล้ว!'
        });
      } else {
        setSyncStatus({
          type: 'error',
          message: `ไม่สามารถส่งแจ้งเตือน LINE: ${res.message}`
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setSyncStatus({ type: 'error', message: `ข้อผิดพลาด: ${errorMsg}` });
    } finally {
      setIsTestingLine(false);
    }
  };

  // Pull latest records from Google Sheets into the web app
  const handlePullFromSheet = async () => {
    setIsPulling(true);
    setSyncStatus(null);
    try {
      if (onPullFromSheet) {
        await onPullFromSheet();
        setSyncStatus({
          type: 'success',
          message: 'ดึงข้อมูลล่าสุดจาก Google Sheets มาแสดงผลเรียบร้อยแล้ว'
        });
      } else if (onTriggerSyncAll) {
        await onTriggerSyncAll();
        setSyncStatus({
          type: 'success',
          message: 'ดึงข้อมูลล่าสุดจาก Google Sheets มาแสดงผลเรียบร้อยแล้ว'
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setSyncStatus({ type: 'error', message: `เกิดข้อผิดพลาดในการดึงข้อมูล: ${errorMsg}` });
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-6 sm:p-8 border border-slate-200 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-slate-100">
          <div className="w-12 h-12 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-2xl flex items-center justify-center font-bold shadow-md shadow-emerald-500/20 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold text-slate-800">
                Google Sheets ฐานข้อมูลกลาง 8 ตาราง + LINE Messaging API
              </h3>
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                เชื่อมต่อทุกเครื่อง
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ตรวจสอบก่อนสร้าง • ห้ามสร้างซ้ำ • แต่ละ Record ใช้ Unique ID • แจ้งเตือนเข้ากลุ่ม LINE อัตโนมัติ
            </p>
          </div>
        </div>

        {/* Guarantees Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5 text-xs">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-emerald-950">ตรวจสอบก่อนสร้างชีต</p>
              <p className="text-[11px] text-emerald-800">Check before create อัตโนมัติ</p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center gap-2.5">
            <Zap className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <p className="font-bold text-blue-950">ห้ามสร้างซ้ำ (Upsert)</p>
              <p className="text-[11px] text-blue-800">ตรวจ Unique ID อัปเดตแถวเดิม</p>
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 flex items-center gap-2.5">
            <MessageCircle className="w-5 h-5 text-purple-600 shrink-0" />
            <div>
              <p className="font-bold text-purple-950">แจ้งเตือนกลุ่ม LINE อัตโนมัติ</p>
              <p className="text-[11px] text-purple-800">Group ID: Cd692610... ทันทีที่ยื่น</p>
            </div>
          </div>
        </div>

        {/* 8 Database Tables Grid */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              โครงสร้างฐานข้อมูล 8 ตาราง (Sheets Structure)
            </h4>
            <span className="text-[11px] text-slate-400">ครบถ้วนตามข้อกำหนดทุกเรคคอร์ด</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {DATABASE_TABLES.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.name} className={`${t.color} border rounded-2xl p-2.5 flex flex-col justify-between`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold text-xs">{t.name}</span>
                    <Icon className="w-4 h-4 opacity-70" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{t.th}</p>
                    <p className="text-[10px] opacity-80 line-clamp-1 mt-0.5">{t.desc}</p>
                  </div>
                  <div className="mt-2 pt-1 border-t border-black/10 flex justify-between items-center text-[10px]">
                    <span className="opacity-75">จำนวนเรคคอร์ด:</span>
                    <span className="font-bold">{t.count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Webhook Configuration */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Sheet className="w-4 h-4 text-emerald-600" />
              URL ของ Google Apps Script Web App (Webhook URL)
            </label>
            <input
              type="url"
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-hidden"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              ปลายทาง Web App ที่นำโค้ดด้านล่างไป Deploy ไว้เพื่อรับข้อมูล 8 ตารางและส่งแจ้งเตือนเข้า LINE Group
            </p>
          </div>

          {/* Auto-Sync Toggle */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <span className="font-bold text-slate-800 text-xs sm:text-sm block">
                  เปิดระบบซิงค์อัตโนมัติแบบเรียลไทม์ทุกอุปกรณ์
                </span>
                <span className="text-[11px] text-slate-500">
                  เมื่อครูยื่นใบลา หรือ ผอ. อนุมัติ ข้อมูลจะถูกบันทึกลง 8 ตารางและส่งเข้ากลุ่ม LINE ทันที
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input 
                type="checkbox" 
                checked={autoSync} 
                onChange={(e) => setAutoSync(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={handlePullFromSheet}
              disabled={isPulling || isSyncing}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="ดึงข้อมูลคำขอลาและฐานข้อมูลกลางจาก Google Sheets มาแสดงผลเดี๋ยวนี้"
            >
              {isPulling ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  กำลังดึงข้อมูลจาก Sheet...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  ดึงข้อมูลล่าสุดจาก Google Sheets
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleTestLineNotify}
              disabled={isTestingLine}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isTestingLine ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  กำลังส่ง LINE...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  ทดสอบส่ง LINE เข้ากลุ่ม
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSaveAndSync}
              disabled={isSyncing}
              className="bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  กำลังซิงค์ 8 ตาราง...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  บันทึก &amp; ซิงค์ 8 ตารางขึ้น Google Sheets
                </>
              )}
            </button>
          </div>

          {/* Sync Status Banner */}
          {syncStatus && (
            <div className={`p-4 rounded-2xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in ${
              syncStatus.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' 
                : 'bg-rose-50 text-rose-800 border border-rose-300'
            }`}>
              {syncStatus.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span className="leading-relaxed">{syncStatus.message}</span>
            </div>
          )}
        </div>

        {/* Step-by-Step Instructions & Code for Google Sheets */}
        <div className="space-y-4">
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-2.5 text-xs text-slate-700">
            <h4 className="font-bold text-emerald-950 flex items-center gap-1.5 text-sm">
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              โค้ด Google Apps Script ใหม่ล่าสุด (8 ตาราง + LINE Messaging API + Unique ID):
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2 text-[11px]">
              <div className="bg-white p-2.5 rounded-xl border border-emerald-100 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                <span><strong>ตรวจสอบก่อนสร้าง:</strong> สร้าง 8 ชีตพร้อมหัวตารางสีน้ำเงินเป็นทางการอัตโนมัติ</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-emerald-100 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                <span><strong>ป้องกันการสร้างซ้ำ:</strong> เช็ค Unique ID ทุกครั้ง ถ้ามีแล้วอัปเดต ถ้าไม่มีเพิ่มใหม่</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-emerald-100 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">3</span>
                <span><strong>LINE Group อัตโนมัติ:</strong> ยื่นใบลาปุ๊บ ส่งข้อความเข้ากลุ่ม LINE ของโรงเรียนทันที</span>
              </div>
            </div>

            <p className="font-bold text-slate-800 text-[11px] pt-1">
              ขั้นตอนการนำโค้ดไปติดตั้งใน Google Sheets:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 leading-relaxed pl-1 text-[11px] sm:text-xs">
              <li>เปิดไฟล์ <strong>Google Sheets</strong> ของโรงเรียน</li>
              <li>ไปที่เมนู <strong>ส่วนขยาย (Extensions)</strong> &gt; <strong>Apps Script</strong></li>
              <li>ลบโค้ดเดิมใน <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-emerald-900">Code.gs</code> ออกทั้งหมด แล้วกดปุ่ม <strong>คัดลอกโค้ด Apps Script</strong> ด้านล่างนี้ไปวาง</li>
              <li>คลิกปุ่ม <strong>การทำให้ใช้งานได้ (Deploy)</strong> &gt; <strong>การทำให้ใช้งานได้ใหม่ (New deployment)</strong></li>
              <li>เลือกประเภท: <strong>เว็บแอป (Web App)</strong> &gt; สิทธิ์เข้าถึงเลือก: <strong>ทุกคน (Anyone)</strong> &gt; กด <strong>ทำให้ใช้งานได้ (Deploy)</strong></li>
              <li>คัดลอก <strong>Web App URL</strong> มาวางในช่องด้านบน แล้วกดปุ่ม <strong>บันทึก &amp; ซิงค์ 8 ตาราง</strong></li>
            </ol>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-slate-800 text-slate-200 px-4 py-2.5 flex items-center justify-between text-xs">
              <span className="font-mono font-bold text-amber-400">Code.gs (Apps Script รองรับ 8 ตาราง + LINE Messaging API)</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    คัดลอกเรียบร้อยแล้ว!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    คัดลอกโค้ด Apps Script
                  </>
                )}
              </button>
            </div>

            <pre className="p-4 bg-slate-900 text-slate-300 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto">
              {GOOGLE_APPS_SCRIPT_TEMPLATE}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
