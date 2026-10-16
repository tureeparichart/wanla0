import React, { useState } from 'react';
import { 
  Personnel, 
  LeaveRecord, 
  SchoolSettings 
} from '../types/leave';
import { 
  formatThaiDate, 
  formatThaiFullDate, 
  getLeaveTypeLabel, 
  getStatusBadgeInfo, 
  exportLeaveRecordsToCsv 
} from '../services/storageService';
import { Avatar } from './Avatar';
import { 
  History, 
  BarChart3, 
  FileText, 
  Printer, 
  FileDown, 
  Download, 
  Search, 
  Filter, 
  PieChart, 
  Users, 
  Eye, 
  Ban, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Calendar,
  Sheet,
  FolderOpen,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

interface LeaveHistoryAndReportsProps {
  currentPersonnel: Personnel;
  allPersonnel: Personnel[];
  leaveRecords: LeaveRecord[];
  settings: SchoolSettings;
  onViewLeaveSlip: (record: LeaveRecord) => void;
  onCancelLeave?: (recordId: string, reason?: string) => void;
}

export const LeaveHistoryAndReports: React.FC<LeaveHistoryAndReportsProps> = ({
  currentPersonnel,
  allPersonnel,
  leaveRecords,
  settings,
  onViewLeaveSlip,
  onCancelLeave,
}) => {
  // Sub-tabs: 1. ประวัติการลา | 2. สถิติและกราฟ | 3. รายงานสรุปทางการ A4/PDF
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'charts' | 'memorandum'>('history');

  // Filters (Perpetual - works across all dates without fiscal year barrier)
  const [selectedPersonnelFilter, setSelectedPersonnelFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Custom date range filter (optional, default to all-time or full year range)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Cancellation States
  const [cancellingRecord, setCancellingRecord] = useState<LeaveRecord | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isQuickLookupOpen, setIsQuickLookupOpen] = useState<boolean>(false);
  const [quickSearchRef, setQuickSearchRef] = useState<string>('');
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Print helper notice
  const [pdfHelperNotice, setPdfHelperNotice] = useState<string | null>(null);

  // Check if current personnel is authorized to cancel leave records
  const canCancelLeave = 
    currentPersonnel.role === 'director' || 
    currentPersonnel.role === 'academic_head' || 
    currentPersonnel.role === 'admin' ||
    currentPersonnel.id === settings.directorId ||
    currentPersonnel.id === settings.academicHeadId;

  // Filter records
  const filtered = leaveRecords.filter(r => {
    const matchesPerson = selectedPersonnelFilter === 'all' || r.personnelId === selectedPersonnelFilter;
    const matchesType = selectedTypeFilter === 'all' || r.leaveType === selectedTypeFilter;
    
    // Optional date filter if set
    const matchesStart = !startDate || r.startDate >= startDate;
    const matchesEnd = !endDate || r.startDate <= endDate;

    const person = allPersonnel.find(p => p.id === r.personnelId);
    const personName = person ? `${person.prefix}${person.firstName} ${person.lastName}` : '';
    const matchesSearch = !searchTerm.trim() || 
      personName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.reason && r.reason.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesPerson && matchesType && matchesStart && matchesEnd && matchesSearch;
  }).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  // Active records (non-cancelled)
  const activeFiltered = filtered.filter(r => r.status !== 'cancelled');

  // Key metrics
  const totalLeavesCount = activeFiltered.length;
  const totalLeaveDays = activeFiltered.reduce((acc, r) => acc + r.totalDays, 0);
  const approvedLeaves = activeFiltered.filter(r => r.status === 'approved');
  const approvedLeavesCount = approvedLeaves.length;
  const approvedLeaveDays = approvedLeaves.reduce((acc, r) => acc + r.totalDays, 0);

  // Group by leave type for chart
  const typeMap: Record<string, { days: number; count: number; title: string }> = {};
  settings.quotas.forEach(q => {
    typeMap[q.leaveType] = { days: 0, count: 0, title: q.title };
  });
  activeFiltered.forEach(r => {
    if (typeMap[r.leaveType]) {
      typeMap[r.leaveType].days += r.totalDays;
      typeMap[r.leaveType].count += 1;
    }
  });

  // Calculate statistics classified by individual personnel (จำแนกตามรายบุคคล)
  const personnelStats = allPersonnel.map((p, idx) => {
    const pRecords = activeFiltered.filter(r => r.personnelId === p.id);
    const sickDays = pRecords.filter(r => r.leaveType === 'sick').reduce((sum, r) => sum + r.totalDays, 0);
    const personalDays = pRecords.filter(r => r.leaveType === 'personal').reduce((sum, r) => sum + r.totalDays, 0);
    const otherDays = pRecords.filter(r => !['sick', 'personal'].includes(r.leaveType)).reduce((sum, r) => sum + r.totalDays, 0);
    const totalPersonDays = sickDays + personalDays + otherDays;
    const totalPersonTimes = pRecords.length;

    return {
      no: idx + 1,
      id: p.id,
      name: `${p.prefix}${p.firstName} ${p.lastName}`,
      position: p.position + (p.academicStanding ? ` (${p.academicStanding})` : ''),
      sickDays,
      personalDays,
      otherDays,
      totalPersonDays,
      totalPersonTimes,
    };
  });

  const totalSickDays = activeFiltered.filter(r => r.leaveType === 'sick').reduce((s, r) => s + r.totalDays, 0);
  const totalPersonalDays = activeFiltered.filter(r => r.leaveType === 'personal').reduce((s, r) => s + r.totalDays, 0);
  const totalOtherDays = activeFiltered.filter(r => !['sick', 'personal'].includes(r.leaveType)).reduce((s, r) => s + r.totalDays, 0);
  const personnelRankList = [...personnelStats].sort((a, b) => b.totalPersonDays - a.totalPersonDays);

  const director = allPersonnel.find(p => p.id === settings.directorId);

  // Handle Cancel
  const handleConfirmCancel = () => {
    if (!cancellingRecord) return;
    if (onCancelLeave) {
      onCancelLeave(cancellingRecord.id, cancelReason.trim() || 'ยกเลิกตามคำขอ/ดุลยพินิจผู้บริหาร');
    }
    setNotificationMsg({
      type: 'success',
      text: `ยกเลิกใบลาเลขที่ ${cancellingRecord.referenceNumber} สำเร็จแล้ว และคืนสิทธิวันลาเรียบร้อย`
    });
    setCancellingRecord(null);
    setCancelReason('');
    setTimeout(() => setNotificationMsg(null), 5000);
  };

  // Handle Print A4 / Save PDF
  const handlePrintOrPdf = (isPdf = false) => {
    setActiveSubTab('memorandum');

    if (isPdf) {
      setPdfHelperNotice('กำลังเปิดหน้าต่างบันทึก PDF: ในช่องปลายทาง (Destination) ให้เลือก "บันทึกเป็น PDF" หรือ "Save as PDF"');
      setTimeout(() => setPdfHelperNotice(null), 8000);
    }

    const originalTitle = document.title;
    if (isPdf) {
      document.title = `บันทึกข้อความ_รายงานสรุปสถิติการลา_${settings.schoolName || 'โรงเรียนบ้านห้วยไคร้'}`;
    }

    setTimeout(() => {
      window.print();
      if (isPdf) {
        setTimeout(() => {
          document.title = originalTitle;
        }, 1500);
      }
    }, 200);
  };

  const googleSheetUrl = settings.googleSheetUrl || `https://docs.google.com/spreadsheets/d/${settings.googleSheetId || '17-pHOOF_bSojwTDUyXNI7bV-jFPQ8zcvsabgwTG-RbM'}/edit`;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {notificationMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notificationMsg.text}</span>
          </div>
          <button onClick={() => setNotificationMsg(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PDF Helper Notification */}
      {pdfHelperNotice && (
        <div className="bg-rose-50 border border-rose-300 text-rose-900 px-4 py-3 rounded-2xl text-xs font-medium flex items-center justify-between shadow-xs no-print animate-in fade-in">
          <div className="flex items-center gap-2">
            <FileDown className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{pdfHelperNotice}</span>
          </div>
          <button onClick={() => setPdfHelperNotice(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer ml-2 text-sm font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Header Banner & Sub-Tabs Navigation (ควบรวม 3 เมนูไว้ด้วยกัน) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs no-print space-y-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-blue-100 text-blue-900 font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                ระบบจัดการวันลาตลอดการใช้งาน (ไม่จำกัดปีงบประมาณ)
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
              ประวัติ สถิติ และรายงานการลา
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              โรงเรียนบ้านห้วยไคร้ สพป.สุโขทัย เขต 2 • ควบรวมประวัติการลา แดชบอร์ดสถิติ และรายงานทางการ A4/PDF
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Access to Google Sheets */}
            <a
              href={googleSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3.5 py-2.5 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="เปิด Google Sheets สถิติการลาทั้งหมด"
            >
              <Sheet className="w-4 h-4 text-emerald-600" />
              <span>เปิด Google Sheets</span>
              <ExternalLink className="w-3 h-3 text-emerald-500" />
            </a>

            <button
              onClick={() => handlePrintOrPdf(true)}
              className="flex items-center gap-1.5 bg-rose-700 hover:bg-rose-600 text-white px-3.5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="บันทึกรายงานสรุปเป็น PDF (Print A4 View)"
            >
              <FileDown className="w-4 h-4 text-rose-200" />
              <span>บันทึกเป็น PDF</span>
            </button>

            <button
              onClick={() => handlePrintOrPdf(false)}
              className="flex items-center gap-1.5 bg-blue-900 hover:bg-blue-800 text-white px-3.5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="สั่งพิมพ์รายงานบันทึกข้อความเสนอ ผอ. แบบ A4"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>พิมพ์รายงาน A4</span>
            </button>

            <button
              onClick={() => exportLeaveRecordsToCsv(activeFiltered, allPersonnel)}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="ดาวน์โหลดไฟล์ Excel / CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>ส่งออก CSV</span>
            </button>
          </div>
        </div>

        {/* Unified Sub-Tabs Navigation Switcher */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-2xl text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-white text-blue-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 text-blue-600" />
            <span>1. ประวัติการลาทั้งหมด ({filtered.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('charts')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'charts'
                ? 'bg-white text-blue-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PieChart className="w-4 h-4 text-indigo-600" />
            <span>2. สถิติและกราฟวิเคราะห์</span>
          </button>

          <button
            onClick={() => setActiveSubTab('memorandum')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'memorandum'
                ? 'bg-white text-blue-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-600" />
            <span>3. รายงานสรุปเสนอ ผอ. (แบบพิมพ์ A4 / บันทึก PDF)</span>
          </button>
        </div>

        {/* Universal Filter Bar (Hidden in Print) */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs filter-bar">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">เลือกบุคลากร:</label>
            <select
              value={selectedPersonnelFilter}
              onChange={(e) => setSelectedPersonnelFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
            >
              <option value="all">-- แสดงบุคลากรทุกคน --</option>
              {allPersonnel.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.prefix}{p.firstName} {p.lastName} ({p.position})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">ประเภทการลา:</label>
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
            >
              <option value="all">-- ทุกประเภทการลา --</option>
              {settings.quotas.map((q) => (
                <option key={q.leaveType} value={q.leaveType}>{q.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">ค้นหาคำสำคัญ:</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ชื่อ, เลขที่คำขอ, เหตุผล..."
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-end gap-2">
            {canCancelLeave && (
              <button
                onClick={() => {
                  setIsQuickLookupOpen(true);
                  setQuickSearchRef('');
                }}
                className="w-full flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 px-3 py-2 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
                title="ค้นหาและยกเลิกใบลาตามเลขที่คำขอ"
              >
                <Ban className="w-3.5 h-3.5 text-rose-600" />
                <span>ยกเลิกตามเลขที่</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Aggregate Overview Cards (Always accessible, hidden in Print) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <p className="text-xs text-slate-500 font-medium">รวมจำนวนครั้งที่ลา</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1">{totalLeavesCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">รายการที่แสดง</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <p className="text-xs text-slate-500 font-medium">รวมวันทำการที่ลา</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-blue-900 mt-1">
            {totalLeaveDays} <span className="text-xs font-normal">วัน</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">คำนวณหักวันหยุดแล้ว</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <p className="text-xs text-slate-500 font-medium">อนุมัติแล้ว</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-1">
            {approvedLeaveDays} <span className="text-xs font-normal">วัน</span>
          </p>
          <p className="text-[11px] text-emerald-700 font-medium mt-0.5">({approvedLeavesCount} ครั้ง)</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <p className="text-xs text-slate-500 font-medium">เฉลี่ยต่อการลาหนึ่งครั้ง</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-indigo-700 mt-1">
            {totalLeavesCount > 0 ? (totalLeaveDays / totalLeavesCount).toFixed(1) : 0} <span className="text-xs font-normal">วัน/ครั้ง</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">อัตราเฉลี่ย</p>
        </div>
      </div>

      {/* ──────────────── SUB-TAB 1: ประวัติการลาทั้งหมด ──────────────── */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden no-print">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-semibold text-slate-700">ไม่พบประวัติการลาตามเงื่อนไขที่เลือก</p>
              <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนตัวกรองบุคลากรหรือประเภทการลา</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">เลขที่คำขอ</th>
                    <th className="py-3.5 px-4 font-semibold">ผู้ขอลา</th>
                    <th className="py-3.5 px-4 font-semibold">ประเภทการลา</th>
                    <th className="py-3.5 px-4 font-semibold">ช่วงวันที่ลา</th>
                    <th className="py-3.5 px-4 font-semibold text-center">จำนวนวัน</th>
                    <th className="py-3.5 px-4 font-semibold text-center">สถานะ</th>
                    <th className="py-3.5 px-4 font-semibold text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((record) => {
                    const person = allPersonnel.find(p => p.id === record.personnelId);
                    const statusInfo = getStatusBadgeInfo(record.status);

                    return (
                      <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-blue-900">
                          {record.referenceNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <Avatar prefix={person?.prefix} gender={person?.gender} size="sm" />
                            <div>
                              <p className="font-semibold text-slate-800">
                                {person ? `${person.prefix}${person.firstName} ${person.lastName}` : record.personnelId}
                              </p>
                              <p className="text-[11px] text-slate-500">{person?.position}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {getLeaveTypeLabel(record.leaveType)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <div>
                            {formatThaiDate(record.startDate)}
                            {record.startDate !== record.endDate && ` - ${formatThaiDate(record.endDate)}`}
                          </div>
                          {record.isHalfDay && (
                            <span className="text-[10px] text-amber-700 font-medium">
                              ({record.halfDayPeriod === 'morning' ? 'ครึ่งวันเช้า' : 'ครึ่งวันบ่าย'})
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                          {record.totalDays}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${statusInfo.bg}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onViewLeaveSlip(record)}
                              className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-xl font-medium cursor-pointer transition-colors"
                              title="ดูใบลาและพิมพ์"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>ดูใบลา</span>
                            </button>

                            {record.status !== 'cancelled' && canCancelLeave && (
                              <button
                                onClick={() => {
                                  setCancellingRecord(record);
                                  setCancelReason('');
                                }}
                                className="inline-flex items-center gap-1 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-xl font-medium cursor-pointer transition-colors"
                                title={`ยกเลิกใบลาเลขที่ ${record.referenceNumber}`}
                              >
                                <Ban className="w-3.5 h-3.5 text-rose-600" />
                                <span>ยกเลิก</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ──────────────── SUB-TAB 2: สถิติและกราฟวิเคราะห์ ──────────────── */}
      {activeSubTab === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
          {/* Chart 1: Leaves by Type */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <PieChart className="w-5 h-5 text-blue-600" />
                สถิติการลาแยกตามประเภท (จำนวนวัน)
              </h3>
              <span className="text-xs text-slate-400 font-medium">รวมทั้งหมด</span>
            </div>

            <div className="space-y-3">
              {Object.entries(typeMap).map(([typeKey, data]) => {
                const percent = totalLeaveDays > 0 ? Math.round((data.days / totalLeaveDays) * 100) : 0;
                return (
                  <div key={typeKey} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{data.title}</span>
                      <span className="font-bold text-slate-800">
                        {data.days} วัน ({data.count} ครั้ง / {percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 2: Top Personnel Leave Ranking */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                สถิติการลาจำแนกตามรายบุคคล
              </h3>
              <span className="text-xs text-slate-400 font-medium">เรียงตามวันลาสูงสุด</span>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {personnelRankList.map((item, index) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/80 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      index === 0 ? 'bg-amber-400 text-blue-950' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-800">{item.name}</p>
                      <p className="text-[11px] text-slate-400">{item.position}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-blue-900 text-sm">{item.totalPersonDays} วัน</span>
                    <p className="text-[10px] text-slate-400">{item.totalPersonTimes} ครั้ง</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── SUB-TAB 3: รายงานสรุปเสนอ ผอ. สำหรับพิมพ์ A4 / บันทึก PDF ──────────────── */}
      {/* Note: This block is also the printable target for @media print */}
      <div 
        id="printable-memorandum-report" 
        className={`bg-white rounded-3xl p-6 sm:p-10 border border-slate-300 shadow-md print-page font-sarabun text-slate-900 ${
          activeSubTab === 'memorandum' ? 'block' : 'hidden print:block'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between mb-6 pb-4 border-b border-slate-200 no-print gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-900" />
            <h3 className="font-bold text-base text-slate-800 font-sans">
              บันทึกข้อความรายงานสรุปสถิติการลาจำแนกตามรายบุคคล เสนอผู้อำนวยการ
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrintOrPdf(true)}
              className="flex items-center gap-1.5 bg-rose-700 hover:bg-rose-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer font-sans"
              title="บันทึกรายงานเป็นไฟล์ PDF"
            >
              <FileDown className="w-4 h-4 text-rose-200" />
              บันทึกเป็น PDF
            </button>
            <button
              onClick={() => handlePrintOrPdf(false)}
              className="flex items-center gap-1.5 bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer font-sans"
              title="สั่งพิมพ์รายงาน A4"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              พิมพ์รายงาน A4
            </button>
          </div>
        </div>

        {/* Official Government Memorandum Format */}
        <div className="space-y-4 max-w-5xl mx-auto text-sm leading-relaxed">
          {/* Header Title Centered - บันทึกข้อความ */}
          <div className="text-center py-2 mb-2">
            <h1 className="text-3xl font-extrabold tracking-widest text-slate-900 font-sarabun">บันทึกข้อความ</h1>
          </div>

          {/* Official Header Information Block */}
          <div className="border-b-2 border-slate-800 pb-3 space-y-2 font-sarabun text-sm sm:text-base">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-slate-900 shrink-0">ส่วนราชการ:</span>
              <span className="text-slate-800 font-medium">โรงเรียนบ้านห้วยไคร้ สพป.สุโขทัย เขต 2</span>
              {settings.phone && <span className="text-slate-700 ml-4 font-normal">โทรศัพท์: {settings.phone}</span>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-slate-900 shrink-0">ที่:</span>
                <span className="text-slate-800 font-medium"></span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-slate-900 shrink-0">วันที่:</span>
                <span className="text-slate-800 font-medium">{formatThaiFullDate(new Date().toISOString().slice(0, 10))}</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-slate-900 shrink-0">เรื่อง:</span>
              <span className="font-bold text-slate-900">รายงานสรุปสถิติการลาของข้าราชการครูและบุคลากรทางการศึกษา</span>
            </div>
          </div>

          <div className="pt-2">
            <p><strong>เรียน:</strong> ผู้อำนวยการโรงเรียนบ้านห้วยไคร้</p>
          </div>

          <p className="indent-8 text-justify">
            ตามที่กลุ่มบริหารงานบุคคลและงานสารบรรณ โรงเรียนบ้านห้วยไคร้ ได้ดำเนินงานระบบจัดการวันลาออนไลน์สำหรับข้าราชการครูและบุคลากรทางการศึกษา เพื่อให้การบริหารจัดการข้อมูลการลาเป็นไปด้วยความถูกต้อง เรียบร้อย และสอดคล้องตามระเบียบสำนักนายกรัฐมนตรีว่าด้วยการลาของข้าราชการ พ.ศ. 2555 นั้น
          </p>

          <p className="indent-8 text-justify">
            บัดนี้ ขอรายงานสรุปสถิติการลาของข้าราชการครูและบุคลากรทางการศึกษา โดยมีรายละเอียดการลาจำแนกตามรายบุคคล ดังนี้
          </p>

          {/* Individual Personnel Statistics Summary Table */}
          <div className="my-4 overflow-x-auto">
            <table className="w-full border-collapse border border-slate-400 text-xs">
              <thead>
                <tr className="bg-slate-100 font-semibold text-slate-900">
                  <th className="border border-slate-400 p-2 text-center w-10">ที่</th>
                  <th className="border border-slate-400 p-2 text-left">ชื่อ - นามสกุล</th>
                  <th className="border border-slate-400 p-2 text-left">ตำแหน่ง</th>
                  <th className="border border-slate-400 p-2 text-center w-14">ลาป่วย (วัน)</th>
                  <th className="border border-slate-400 p-2 text-center w-14">ลากิจ (วัน)</th>
                  <th className="border border-slate-400 p-2 text-center w-14">ลาอื่นๆ (วัน)</th>
                  <th className="border border-slate-400 p-2 text-center w-16 bg-blue-50 text-blue-950 font-bold">รวมวันลา (วัน)</th>
                  <th className="border border-slate-400 p-2 text-center w-14">รวม (ครั้ง)</th>
                  <th className="border border-slate-400 p-2 text-center w-16">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {personnelStats.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="border border-slate-400 p-1.5 text-center">{row.no}</td>
                    <td className="border border-slate-400 p-1.5 font-medium">{row.name}</td>
                    <td className="border border-slate-400 p-1.5 text-slate-700">{row.position}</td>
                    <td className="border border-slate-400 p-1.5 text-center">{row.sickDays > 0 ? row.sickDays : '-'}</td>
                    <td className="border border-slate-400 p-1.5 text-center">{row.personalDays > 0 ? row.personalDays : '-'}</td>
                    <td className="border border-slate-400 p-1.5 text-center">{row.otherDays > 0 ? row.otherDays : '-'}</td>
                    <td className="border border-slate-400 p-1.5 text-center font-bold text-blue-900 bg-blue-50/50">
                      {row.totalPersonDays > 0 ? row.totalPersonDays : '0'}
                    </td>
                    <td className="border border-slate-400 p-1.5 text-center text-slate-700">
                      {row.totalPersonTimes > 0 ? row.totalPersonTimes : '0'}
                    </td>
                    <td className="border border-slate-400 p-1.5 text-center text-slate-400">-</td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={3} className="border border-slate-400 p-2 text-center">
                    รวมทั้งสิ้น ({allPersonnel.length} คน)
                  </td>
                  <td className="border border-slate-400 p-2 text-center">{totalSickDays}</td>
                  <td className="border border-slate-400 p-2 text-center">{totalPersonalDays}</td>
                  <td className="border border-slate-400 p-2 text-center">{totalOtherDays}</td>
                  <td className="border border-slate-400 p-2 text-center text-blue-950 font-extrabold bg-blue-100/60">
                    {totalLeaveDays}
                  </td>
                  <td className="border border-slate-400 p-2 text-center font-bold">
                    {totalLeavesCount}
                  </td>
                  <td className="border border-slate-400 p-2 text-center text-slate-600">วันทำการ</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="indent-8 text-justify">
            จึงเรียนมาเพื่อโปรดทราบและพิจารณา
          </p>

          {/* Signatures Area - ผอ. รับรองคนเดียว */}
          <div className="flex justify-end pt-10 text-center text-xs sm:text-sm font-sarabun">
            <div className="space-y-2 min-w-[280px]">
              <p>(ลงชื่อ)....................................................................</p>
              <p className="font-medium">
                ({director ? `${director.prefix}${director.firstName} ${director.lastName}` : '....................................................................'})
              </p>
              <p className="font-medium">ตำแหน่ง ผู้อำนวยการ{settings.schoolName || 'โรงเรียนบ้านห้วยไคร้'}</p>
              <p className="text-slate-600">วันที่ .......... เดือน .................... พ.ศ. ..............</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Confirm Cancel Specific Leave Record */}
      {cancellingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in no-print">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-700">
                <div className="p-2 bg-rose-100 rounded-xl">
                  <Ban className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">
                    ยืนยันการยกเลิกใบลา
                  </h3>
                  <p className="text-xs text-slate-500">
                    เลขที่คำขอ: <strong className="text-blue-900">{cancellingRecord.referenceNumber}</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setCancellingRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                ระบุเหตุผลในการยกเลิกใบลา:
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                placeholder="เช่น ผู้ขอลายกเลิกภารกิจ, บันทึกผิดพลาด..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCancellingRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
              >
                <Ban className="w-4 h-4" />
                ยืนยันยกเลิกใบลาฉบับนี้
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Quick Search & Cancel by Request Number */}
      {isQuickLookupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in no-print">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-700">
                <div className="p-2 bg-rose-100 rounded-xl">
                  <Search className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">
                    ค้นหาและยกเลิกใบลาตามเลขที่คำขอ
                  </h3>
                  <p className="text-xs text-slate-500">
                    พิมพ์เลขที่คำขอ เช่น ลร.04/2570 เพื่อค้นหาและกดยกเลิก
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsQuickLookupOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={quickSearchRef}
                onChange={(e) => setQuickSearchRef(e.target.value)}
                placeholder="พิมพ์เลขที่คำขอ (เช่น ลร.04/2570 หรือ 04)..."
                autoFocus
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {(() => {
                const results = leaveRecords.filter(r => {
                  if (r.status === 'cancelled') return false;
                  if (!quickSearchRef.trim()) return true;
                  return r.referenceNumber.toLowerCase().includes(quickSearchRef.toLowerCase());
                });

                if (results.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      ไม่พบใบลาที่ตรงกับเลขที่ &quot;{quickSearchRef}&quot; หรือใบลาถูกยกเลิกแล้ว
                    </div>
                  );
                }

                return results.map(rec => {
                  const applicant = allPersonnel.find(p => p.id === rec.personnelId);
                  const statusInfo = getStatusBadgeInfo(rec.status);
                  return (
                    <div 
                      key={rec.id}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-xs transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-blue-900 font-bold">{rec.referenceNumber}</strong>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusInfo.bg}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="text-slate-800 font-semibold mt-0.5">
                          {applicant ? `${applicant.prefix}${applicant.firstName} ${applicant.lastName}` : rec.personnelId}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {getLeaveTypeLabel(rec.leaveType)} • {formatThaiDate(rec.startDate)} ({rec.totalDays} วัน)
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setIsQuickLookupOpen(false);
                          setCancellingRecord(rec);
                          setCancelReason('');
                        }}
                        className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer shadow-xs shrink-0"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        เลือกเพื่อยกเลิก
                      </button>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsQuickLookupOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
