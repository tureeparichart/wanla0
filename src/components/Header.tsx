import React, { useState } from 'react';
import { 
  Personnel, 
  SchoolSettings, 
  LeaveRecord 
} from '../types/leave';
import { 
  Building2, 
  UserCheck, 
  Lock, 
  Unlock, 
  Bell, 
  ChevronDown, 
  CalendarDays, 
  LogIn, 
  Cloud,
  Menu,
  Sheet,
  FolderOpen,
  ExternalLink
} from 'lucide-react';
import { formatThaiDate } from '../services/storageService';
import { Avatar } from './Avatar';

interface HeaderProps {
  currentPersonnel: Personnel;
  allPersonnel: Personnel[];
  onSelectPersonnel: (person: Personnel) => void;
  settings: SchoolSettings;
  leaveRecords: LeaveRecord[];
  isPinUnlocked: boolean;
  onLockPin: () => void;
  onRequestPin: (targetTab: string) => void;
  onOpenGoogleSheets?: () => void;
  onOpenLineModal?: () => void;
  onNavigateTab: (tab: string) => void;
  onOpenLoginModal?: () => void;
  onOpenMobileDrawer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPersonnel,
  allPersonnel,
  onSelectPersonnel,
  settings,
  leaveRecords,
  isPinUnlocked,
  onLockPin,
  onRequestPin,
  onOpenGoogleSheets,
  onNavigateTab,
  onOpenLoginModal,
  onOpenMobileDrawer,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Pending counts for notifications
  const pendingAcademicCount = leaveRecords.filter(r => r.status === 'pending_academic').length;
  const pendingDirectorCount = leaveRecords.filter(r => r.status === 'pending_director').length;
  const totalPending = (currentPersonnel.role === 'academic_head') 
    ? pendingAcademicCount 
    : (currentPersonnel.role === 'director') 
      ? pendingDirectorCount 
      : (currentPersonnel.role === 'admin')
        ? pendingAcademicCount + pendingDirectorCount
        : 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const formattedToday = formatThaiDate(todayStr);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'director':
        return <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-medium border border-amber-300">ผู้อำนวยการ</span>;
      case 'academic_head':
        return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-medium border border-purple-300">หัวหน้าวิชาการ</span>;
      case 'admin':
        return <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-0.5 rounded-full font-medium border border-rose-300">ผู้ดูแลระบบ</span>;
      default:
        return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-medium border border-blue-300">ครู / บุคลากร</span>;
    }
  };

  const isExecutiveOrAdmin = ['director', 'academic_head', 'admin'].includes(currentPersonnel.role);
  const googleSheetUrl = settings.googleSheetUrl || `https://docs.google.com/spreadsheets/d/${settings.googleSheetId || '17-pHOOF_bSojwTDUyXNI7bV-jFPQ8zcvsabgwTG-RbM'}/edit`;
  const driveFolderUrl = settings.googleDriveFolderUrl || 'https://drive.google.com/drive/folders/1Kor6QbWoqa_Z2d-D--6mjf-FBM0rVwkV';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs no-print app-header">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white px-3 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Menu Button */}
            {onOpenMobileDrawer && (
              <button
                onClick={onOpenMobileDrawer}
                className="md:hidden p-2 -ml-1 text-slate-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                title="เปิดเมนูด้านข้าง (Hamburger Menu)"
                aria-label="เปิดเมนู"
              >
                <Menu className="w-6 h-6 text-amber-400" />
              </button>
            )}

            {/* School Crest / Emblem Badge */}
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-blue-950 flex items-center justify-center font-bold text-base shadow-md border border-amber-300 shrink-0">
              <Building2 className="w-5 h-5 text-blue-950" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base tracking-tight text-white truncate">
                  ระบบจัดการวันลาออนไลน์
                </h1>
              </div>
              <p className="text-[11px] text-blue-200 truncate">
                {settings.schoolName || 'โรงเรียนบ้านห้วยไคร้'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-blue-200 shrink-0">
            {/* Quick Open Google Sheets */}
            <a
              href={googleSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1.5 bg-emerald-700/60 hover:bg-emerald-600/70 text-emerald-200 border border-emerald-500/50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              title="เปิด Google Sheets ID: 17-pHOOF_bSojwTDUyXNI7bV-jFPQ8zcvsabgwTG-RbM"
            >
              <Sheet className="w-3.5 h-3.5 text-emerald-300" />
              <span>Google Sheet การลา</span>
            </a>

            <div className="flex items-center gap-1.5 bg-blue-800/60 px-3 py-1 rounded-lg border border-blue-700/50">
              <CalendarDays className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="hidden sm:inline">วันนี้: </span>
              <strong className="text-white font-medium">{formattedToday}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Main Personnel Switcher & Action Controls */}
      <div className="px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5 bg-white">
        {/* Left: Quick Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 hidden sm:inline">
            เข้าสู่ระบบในฐานะ:
          </span>

          {/* Personnel Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-xl transition-all shadow-2xs text-left cursor-pointer group"
            >
              <Avatar 
                prefix={currentPersonnel.prefix} 
                gender={currentPersonnel.gender} 
                size="sm" 
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate max-w-[130px] sm:max-w-[180px]">
                    {currentPersonnel.prefix}{currentPersonnel.firstName} {currentPersonnel.lastName}
                  </span>
                  {getRoleBadge(currentPersonnel.role)}
                </div>
                <p className="text-[11px] text-slate-500 truncate max-w-[160px] sm:max-w-[220px]">
                  {currentPersonnel.position} {currentPersonnel.academicStanding}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 ml-1 transition-transform" />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        เลือกผู้ใช้งานบุคลากร
                      </p>
                      <p className="text-[11px] text-slate-500">
                        สลับผู้ใช้เพื่อทดสอบการทำงานของครู, หัวหน้าวิชาการ, ผอ.
                      </p>
                    </div>
                    <UserCheck className="w-4 h-4 text-blue-600" />
                  </div>

                  <div className="max-h-80 overflow-y-auto p-1 divide-y divide-slate-50">
                    {allPersonnel.map((person) => {
                      const isSelected = person.id === currentPersonnel.id;
                      return (
                        <button
                          key={person.id}
                          onClick={() => {
                            onSelectPersonnel(person);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
                            isSelected 
                              ? 'bg-blue-50 border border-blue-200' 
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <Avatar 
                            prefix={person.prefix} 
                            gender={person.gender} 
                            size="sm" 
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-xs sm:text-sm font-medium truncate ${isSelected ? 'text-blue-900 font-semibold' : 'text-slate-800'}`}>
                                {person.prefix}{person.firstName} {person.lastName}
                              </span>
                              {getRoleBadge(person.role)}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {person.position} • {person.department || 'โรงเรียนบ้านห้วยไคร้'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {onOpenLoginModal && (
                    <div className="p-2 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onOpenLoginModal();
                        }}
                        className="w-full py-2 px-3 text-xs font-semibold text-blue-700 hover:text-blue-900 hover:bg-blue-100/70 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        เปิดหน้าต่างเลือกเข้าสู่ระบบในฐานะ (ป๊อปอัป)
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {onOpenLoginModal && (
            <button
              onClick={onOpenLoginModal}
              className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
              title="เปิดหน้าต่างเลือกเข้าสู่ระบบในฐานะ"
            >
              <LogIn className="w-3.5 h-3.5 text-blue-700" />
              <span className="hidden sm:inline">เลือกบทบาท</span>
            </button>
          )}
        </div>

        {/* Right: Cloud Sync, Notifications, Executive Mode */}
        <div className="flex items-center gap-2">
          {/* Cloud Sync Button */}
          {onOpenGoogleSheets && (
            <button
              onClick={onOpenGoogleSheets}
              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              title="ตั้งค่าและซิงค์ข้อมูล Google Sheets ทันที"
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">ซิงค์คลาวด์</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            </button>
          )}

          {/* Notification Badge if Pending Approvals */}
          {totalPending > 0 && (
            <button
              onClick={() => onNavigateTab('approvals')}
              className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer animate-pulse-subtle transition-all"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>รอพิจารณา: {totalPending}</span>
            </button>
          )}

          {/* Executive PIN Lock / Unlock */}
          {isExecutiveOrAdmin && (
            isPinUnlocked ? (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 px-2.5 py-1.5 rounded-xl text-xs">
                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-medium hidden sm:inline">ปลดล็อกแล้ว</span>
                <button
                  onClick={onLockPin}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold ml-1 underline cursor-pointer"
                  title="ล็อกโหมดผู้บริหาร"
                >
                  ล็อก
                </button>
              </div>
            ) : (
              <button
                onClick={() => onRequestPin('approvals')}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors"
                title="ใส่รหัสผ่าน PIN 1234 สำหรับผู้บริหาร"
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">รหัสผู้บริหาร</span>
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
};
