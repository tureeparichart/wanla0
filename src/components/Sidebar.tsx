import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  CheckSquare, 
  BarChart3, 
  Building2, 
  Lock,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { SchoolSettings, Personnel } from '../types/leave';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  pendingApprovalCount: number;
  isPinUnlocked: boolean;
  settings: SchoolSettings;
  currentPersonnel: Personnel;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileDrawerOpen: boolean;
  onCloseMobileDrawer: () => void;
  onOpenGoogleSheets?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  pendingApprovalCount,
  isPinUnlocked,
  settings,
  currentPersonnel,
  isCollapsed,
  onToggleCollapse,
  isMobileDrawerOpen,
  onCloseMobileDrawer,
  onOpenGoogleSheets,
}) => {
  // Nav menu items:
  // - ควบรวม ประวัติการลา รายงาน สถิติ&กราฟ เข้าเป็น 'reports'
  // - ลบเมนูปฏิทินวันลาออก
  // - ย้าย Audit log ไปไว้ในเมนูข้อมูลโรงเรียน ('organization')
  const navItems = [
    {
      id: 'dashboard',
      label: 'แดชบอร์ด',
      icon: LayoutDashboard,
      requiresPin: false,
      desc: 'ภาพรวมและสถิติส่วนบุคคล'
    },
    {
      id: 'apply',
      label: 'ยื่นใบลา',
      icon: FileText,
      requiresPin: false,
      highlight: true,
      desc: 'ส่งคำขอลาออนไลน์'
    },
    {
      id: 'approvals',
      label: 'การอนุมัติ',
      icon: CheckSquare,
      requiresPin: true,
      badge: pendingApprovalCount > 0 ? pendingApprovalCount : undefined,
      desc: 'สำหรับหัวหน้าวิชาการ & ผอ.'
    },
    {
      id: 'reports',
      label: 'ประวัติ สถิติ และรายงาน',
      icon: BarChart3,
      requiresPin: false,
      desc: 'ประวัติลา สถิติกราฟ & พิมพ์ A4/PDF'
    },
    {
      id: 'personnel',
      label: 'ข้อมูลบุคลากร',
      icon: Users,
      requiresPin: false,
      desc: 'รายชื่อครูและบุคลากร'
    },
    {
      id: 'organization',
      label: 'ข้อมูลโรงเรียน & ตั้งค่า',
      icon: Building2,
      requiresPin: true,
      desc: 'ตั้งค่าระบบ, Sheets, Drive, LINE, Audit'
    }
  ];

  const handleItemClick = (id: string) => {
    onSelectTab(id);
    onCloseMobileDrawer();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 select-none">
      {/* 1. Header / School Crest */}
      <div className={`p-4 border-b border-slate-800 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-3 shrink-0`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-amber-400 text-blue-950 flex items-center justify-center font-bold text-lg shadow-md border-2 border-amber-300 shrink-0">
            <Building2 className="w-6 h-6 text-blue-950" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="font-bold text-sm tracking-tight text-white truncate">
                {settings.schoolName || 'โรงเรียนบ้านห้วยไคร้'}
              </h1>
              <p className="text-[11px] text-slate-400 truncate">
                สพป.สุโขทัย เขต 2
              </p>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobileDrawer}
          className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          title="ปิดเมนู"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Navigation Items List (SPA In-Page Module Switcher) */}
      <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
        {!isCollapsed && (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
            โมดูลการทำงาน (SPA)
          </p>
        )}

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-3'} rounded-2xl text-xs sm:text-sm font-medium transition-all cursor-pointer relative group text-left ${
                isActive
                  ? 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-md shadow-blue-900/30 font-semibold'
                  : item.highlight
                    ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-400/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-5 h-5 shrink-0 ${
                  isActive 
                    ? 'text-amber-400' 
                    : item.highlight 
                      ? 'text-amber-400' 
                      : 'text-slate-400 group-hover:text-slate-200'
                }`} />
                {!isCollapsed && (
                  <div className="min-w-0 truncate">
                    <p className="truncate leading-tight">{item.label}</p>
                    <p className="text-[10px] text-slate-400 truncate font-normal mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Badge & Lock indicator */}
              {!isCollapsed && (
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {item.requiresPin && !isPinUnlocked && (
                    <span title="ต้องใส่รหัส PIN ผู้บริหาร (1234)">
                      <Lock className={`w-3.5 h-3.5 ${isActive ? 'text-blue-300' : 'text-slate-500'}`} />
                    </span>
                  )}

                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}

              {/* Collapsed Badge Dot */}
              {isCollapsed && item.badge !== undefined && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Bottom Collapse Toggle */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0">
        <div className="hidden md:flex justify-end">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center gap-2 p-2 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-xl transition-colors cursor-pointer"
            title={isCollapsed ? 'ขยาย Sidebar' : 'ย่อ Sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>ย่อเมนูด้านข้าง</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop & Tablet Sidebar (Fixed on left, responsive width) */}
      <aside 
        className={`hidden md:block fixed top-0 bottom-0 left-0 z-30 transition-all duration-300 no-print sidebar-container ${
          isCollapsed ? 'w-20' : 'w-64 lg:w-72'
        } shadow-xl`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Slide-over with hamburger menu backdrop) */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden no-print animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            onClick={onCloseMobileDrawer}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs drawer-backdrop"
          />

          {/* Drawer Content */}
          <div className="fixed top-0 bottom-0 left-0 w-72 max-w-[85vw] shadow-2xl z-50 animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
