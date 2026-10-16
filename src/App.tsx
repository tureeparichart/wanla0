/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Personnel, 
  LeaveRecord, 
  SchoolSettings, 
  AuditLog,
  LeaveStatus 
} from './types/leave';
import { 
  getStoredPersonnel, 
  savePersonnel, 
  getStoredLeaveRecords, 
  saveLeaveRecords, 
  getStoredSchoolSettings, 
  saveSchoolSettings, 
  getStoredAuditLogs, 
  addAuditLog, 
  getActiveUserId, 
  setActiveUserId,
  syncWithGoogleSheets,
  fetchDatabaseFromServer,
  syncDatabaseToServer,
  fetchRecordsFromGoogleSheets,
  mergeLeaveRecords,
  sendLineNotification,
  formatNewLeaveLineMessage,
  formatAcademicReviewLineMessage,
  formatDirectorDecisionLineMessage
} from './services/storageService';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PinModal } from './components/PinModal';
import { Dashboard } from './components/Dashboard';
import { LeaveForm } from './components/LeaveForm';
import { PersonnelList } from './components/PersonnelList';
import { ApprovalCenter } from './components/ApprovalCenter';
import { LeaveHistoryAndReports } from './components/LeaveHistoryAndReports';
import { OrganizationSettings } from './components/OrganizationSettings';
import { OfficialLeaveSlipModal } from './components/OfficialLeaveSlipModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { LineSettingsModal } from './components/LineSettingsModal';
import { LoginRoleModal } from './components/LoginRoleModal';
import { Building2, LogIn, CheckCircle2 } from 'lucide-react';

export default function App() {
  // 1. Core State
  const [personnelList, setPersonnelList] = useState<Personnel[]>(getStoredPersonnel);
  const [currentPersonnelId, setCurrentPersonnelId] = useState<string>(() => {
    const saved = localStorage.getItem('huaykhrai_active_user_id');
    if (!saved || saved === 'p-007') {
      localStorage.setItem('huaykhrai_active_user_id', 'p-demo');
      return 'p-demo';
    }
    return saved;
  });
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>(getStoredLeaveRecords);
  const [settings, setSettings] = useState<SchoolSettings>(getStoredSchoolSettings);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(getStoredAuditLogs);

  // Initial Login Role Pop-up State (disabled on load so user lands directly on Dashboard)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [hasSelectedRoleOnEntry, setHasSelectedRoleOnEntry] = useState<boolean>(true);
  const [welcomeToast, setWelcomeToast] = useState<{ name: string; position: string } | null>(null);

  // 2. Navigation & Security State (SPA module switcher)
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isPinUnlocked, setIsPinUnlocked] = useState<boolean>(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pendingTargetTab, setPendingTargetTab] = useState<string | null>(null);

  // 3. Responsive Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  // 4. Modals State
  const [viewingLeaveSlip, setViewingLeaveSlip] = useState<LeaveRecord | null>(null);
  const [isGoogleSheetsOpen, setIsGoogleSheetsOpen] = useState<boolean>(false);
  const [isLineModalOpen, setIsLineModalOpen] = useState<boolean>(false);

  // Current logged in personnel object
  const currentPersonnel = personnelList.find(p => p.id === currentPersonnelId) || personnelList[0];

  // Auto-dismiss welcome toast
  useEffect(() => {
    if (welcomeToast) {
      const timer = setTimeout(() => {
        setWelcomeToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [welcomeToast]);

  // Save changes to localStorage
  useEffect(() => {
    savePersonnel(personnelList);
  }, [personnelList]);

  useEffect(() => {
    saveLeaveRecords(leaveRecords);
  }, [leaveRecords]);

  useEffect(() => {
    saveSchoolSettings(settings);
  }, [settings]);

  // Helper for centralized server & cloud synchronization across devices (Google Sheets)
  const syncAllData = async (
    customRecords?: LeaveRecord[],
    customPersonnel?: Personnel[],
    customSettings?: SchoolSettings,
    customLogs?: AuditLog[],
    lineMessage?: string
  ) => {
    const recs = customRecords ?? leaveRecords;
    const pers = customPersonnel ?? personnelList;
    const sett = customSettings ?? settings;
    const logs = customLogs ?? auditLogs;

    // 1. Always sync to Central Server persistent store
    await syncDatabaseToServer({
      leaveRecords: recs,
      personnelList: pers,
      settings: sett,
      auditLogs: logs
    });

    // 2. Sync to Google Sheets if webhook configured and auto-sync is on (merges cleanly without deleting other devices' rows)
    if (sett.googleSheetsWebhookUrl && sett.isAutoSyncEnabled !== false) {
      syncWithGoogleSheets(sett.googleSheetsWebhookUrl, recs, pers, sett, lineMessage);
    }
  };

  // Cross-device synchronization on load & polling (unifies data from all devices via Google Sheets)
  useEffect(() => {
    let isMounted = true;

    const loadCentralData = async () => {
      let currentRecs = leaveRecords;

      // 1. Try server database first if running full-stack
      try {
        const serverData = await fetchDatabaseFromServer();
        if (serverData && isMounted) {
          if (serverData.leaveRecords && serverData.leaveRecords.length > 0) {
            currentRecs = serverData.leaveRecords;
            setLeaveRecords(serverData.leaveRecords);
            saveLeaveRecords(serverData.leaveRecords);
          }
          if (serverData.personnelList) {
            setPersonnelList(serverData.personnelList);
            savePersonnel(serverData.personnelList);
          }
          if (serverData.settings) {
            setSettings(serverData.settings);
            saveSchoolSettings(serverData.settings);
          }
          if (serverData.auditLogs) {
            setAuditLogs(serverData.auditLogs);
          }
        }
      } catch {
        // server-side not available (static hosting)
      }

      // 2. Fetch unified records from Google Sheets (source of truth for all devices)
      if (settings.googleSheetId) {
        try {
          const sheetRecords = await fetchRecordsFromGoogleSheets(settings.googleSheetId, personnelList);
          if (sheetRecords && sheetRecords.length > 0 && isMounted) {
            const merged = mergeLeaveRecords(currentRecs, sheetRecords);
            setLeaveRecords(merged);
            saveLeaveRecords(merged);
          }
        } catch {
          // ignore network hiccups
        }
      }
    };

    loadCentralData();

    // Background poll every 12 seconds to synchronize changes across all devices (mobile, tablet, PC)
    const interval = setInterval(async () => {
      if (!isMounted) return;
      await loadCentralData();
    }, 12000);

    const handleFocus = () => {
      loadCentralData();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [settings.googleSheetId]);

  // SPA module switching with PIN 1234 protection for Approvals and Organization Settings
  const handleSelectTab = (tabId: string) => {
    if (tabId === 'approvals' || tabId === 'organization') {
      if (!isPinUnlocked) {
        setPendingTargetTab(tabId);
        setIsPinModalOpen(true);
        return;
      }
    }
    setActiveTab(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePinSuccess = () => {
    setIsPinUnlocked(true);
    setIsPinModalOpen(false);
    if (pendingTargetTab) {
      setActiveTab(pendingTargetTab);
      setPendingTargetTab(null);
    }
  };

  const handleLockPin = () => {
    setIsPinUnlocked(false);
    if (activeTab === 'approvals' || activeTab === 'organization') {
      setActiveTab('dashboard');
    }
  };

  // Switch personnel user
  const handleSelectPersonnel = (person: Personnel) => {
    setCurrentPersonnelId(person.id);
    setActiveUserId(person.id);

    // If switching to a non-executive role, auto-lock PIN
    if (!['director', 'academic_head', 'admin'].includes(person.role)) {
      setIsPinUnlocked(false);
      if (activeTab === 'approvals' || activeTab === 'organization') {
        setActiveTab('dashboard');
      }
    }

    const updatedLogs = addAuditLog(
      `${person.prefix}${person.firstName} ${person.lastName}`,
      person.position,
      'สลับผู้ใช้งาน',
      `เข้าสู่ระบบในฐานะ ${person.prefix}${person.firstName} ${person.lastName} (${person.position})`
    );
    setAuditLogs(updatedLogs);
  };

  // Pop-up Login Role selection handler
  const handleLoginSelectPersonnel = (person: Personnel) => {
    handleSelectPersonnel(person);
    setHasSelectedRoleOnEntry(true);
    setIsLoginModalOpen(false);
    setWelcomeToast({
      name: `${person.prefix}${person.firstName} ${person.lastName}`,
      position: person.position
    });
  };

  // Quick switch to admin or director for convenience
  const handleQuickSwitchToDirector = () => {
    const director = personnelList.find(p => p.role === 'director') || personnelList[0];
    handleSelectPersonnel(director);
    setIsPinModalOpen(false);
  };

  // Submit leave handler
  const handleSubmitLeaveSuccess = (newRecord: LeaveRecord) => {
    const updated = [newRecord, ...leaveRecords];
    setLeaveRecords(updated);
    
    // Add audit log
    const updatedLogs = addAuditLog(
      `${currentPersonnel.prefix}${currentPersonnel.firstName} ${currentPersonnel.lastName}`,
      currentPersonnel.position,
      'ยื่นใบลาออนไลน์',
      `ยื่นขอใบลา ${newRecord.referenceNumber} (${newRecord.totalDays} วันทำการ)`
    );
    setAuditLogs(updatedLogs);

    const lineMsg = formatNewLeaveLineMessage(newRecord, currentPersonnel, settings);

    // Instant sync to Server DB and Google Sheets (with LINE message attached for Google Apps Script)
    syncAllData(updated, personnelList, settings, updatedLogs, lineMsg);

    // Auto-send LINE notification to school group
    if (settings.isLineNotifyEnabled && settings.lineChannelAccessToken && settings.lineGroupId) {
      sendLineNotification(settings, lineMsg);
    }
  };

  // Academic Head Approval Action
  const handleApproveByAcademicHead = (recordId: string, comment: string, signature: string) => {
    const now = new Date().toISOString();
    const updated = leaveRecords.map(r => {
      if (r.id === recordId) {
        return {
          ...r,
          academicHeadId: currentPersonnel.id,
          academicHeadComment: comment,
          academicHeadSignature: signature,
          academicHeadActionDate: now,
          status: 'pending_director' as const
        };
      }
      return r;
    });

    setLeaveRecords(updated);
    const record = leaveRecords.find(r => r.id === recordId);
    const updatedLogs = addAuditLog(
      `${currentPersonnel.prefix}${currentPersonnel.firstName} ${currentPersonnel.lastName}`,
      'หัวหน้าฝ่ายวิชาการ',
      'บันทึกความเห็นชอบใบลา',
      `ลงความเห็นชอบใบลา ${record?.referenceNumber || recordId} เสนอผู้อำนวยการสั่งการ`
    );
    setAuditLogs(updatedLogs);

    let lineMsg: string | undefined = undefined;
    if (record) {
      const applicant = personnelList.find(p => p.id === record.personnelId) || currentPersonnel;
      const headName = `${currentPersonnel.prefix}${currentPersonnel.firstName} ${currentPersonnel.lastName}`;
      lineMsg = formatAcademicReviewLineMessage(record, applicant, headName, comment);
    }

    syncAllData(updated, personnelList, settings, updatedLogs, lineMsg);

    if (settings.isLineNotifyEnabled && settings.lineChannelAccessToken && settings.lineGroupId && lineMsg) {
      sendLineNotification(settings, lineMsg);
    }
  };

  // Director Approval Action
  const handleApproveByDirector = (recordId: string, isApproved: boolean, comment: string, signature: string) => {
    const now = new Date().toISOString();
    const newStatus: LeaveStatus = isApproved ? 'approved' : 'rejected';
    const updated: LeaveRecord[] = leaveRecords.map(r => {
      if (r.id === recordId) {
        return {
          ...r,
          directorId: currentPersonnel.id,
          directorComment: comment,
          directorSignature: signature,
          directorActionDate: now,
          status: newStatus
        };
      }
      return r;
    });

    setLeaveRecords(updated);
    const record = leaveRecords.find(r => r.id === recordId);
    const updatedLogs = addAuditLog(
      `${currentPersonnel.prefix}${currentPersonnel.firstName} ${currentPersonnel.lastName}`,
      'ผู้อำนวยการโรงเรียน',
      isApproved ? 'อนุมัติการลา' : 'ไม่อนุมัติการลา',
      `${isApproved ? 'อนุมัติ' : 'ไม่อนุมัติ'}คำขอใบลา ${record?.referenceNumber || recordId}`
    );
    setAuditLogs(updatedLogs);

    let lineMsg: string | undefined = undefined;
    if (record) {
      const applicant = personnelList.find(p => p.id === record.personnelId) || currentPersonnel;
      const dirName = `${currentPersonnel.prefix}${currentPersonnel.firstName} ${currentPersonnel.lastName}`;
      lineMsg = formatDirectorDecisionLineMessage(record, applicant, dirName, isApproved, comment);
    }

    syncAllData(updated, personnelList, settings, updatedLogs, lineMsg);

    if (settings.isLineNotifyEnabled && settings.lineChannelAccessToken && settings.lineGroupId && lineMsg) {
      sendLineNotification(settings, lineMsg);
    }
  };

  // Personnel management handlers
  const handleAddPersonnel = (newPerson: Personnel) => {
    const updated = [...personnelList, newPerson];
    setPersonnelList(updated);
    const updatedLogs = addAuditLog(
      `${currentPersonnel.prefix}${currentPersonnel.firstName} ${currentPersonnel.lastName}`,
      currentPersonnel.position,
      'เพิ่มข้อมูลบุคลากร',
      `เพิ่มบุคลากรใหม่: ${newPerson.prefix}${newPerson.firstName} ${newPerson.lastName} (${newPerson.position})`
    );
    setAuditLogs(updatedLogs);
    syncAllData(leaveRecords, updated, settings, updatedLogs);
  };

  const handleUpdatePersonnel = (updatedPerson: Personnel) => {
    const updated = personnelList.map(p => p.id === updatedPerson.id ? updatedPerson : p);
    setPersonnelList(updated);
    const updatedLogs = addAuditLog(
      `${currentPersonnel.prefix}${currentPersonnel.firstName} ${currentPersonnel.lastName}`,
      currentPersonnel.position,
      'แก้ไขข้อมูลบุคลากร',
      `ปรับปรุงข้อมูล: ${updatedPerson.prefix}${updatedPerson.firstName} ${updatedPerson.lastName}`
    );
    setAuditLogs(updatedLogs);
    syncAllData(leaveRecords, updated, settings, updatedLogs);
  };

  const handleDeletePersonnel = (personId: string) => {
    const deletedPerson = personnelList.find(p => p.id === personId);
    const updated = personnelList.filter(p => p.id !== personId);
    setPersonnelList(updated);
    const updatedLogs = addAuditLog(
      `${currentPersonnel.prefix}${currentPersonnel.firstName} ${currentPersonnel.lastName}`,
      currentPersonnel.position,
      'ลบข้อมูลบุคลากร',
      `ลบบุคลากร: ${deletedPerson?.prefix || ''}${deletedPerson?.firstName || ''} ${deletedPerson?.lastName || ''}`
    );
    setAuditLogs(updatedLogs);
    syncAllData(leaveRecords, updated, settings, updatedLogs);
  };

  // School Settings Save
  const handleSaveSettings = (newSettings: SchoolSettings) => {
    setSettings(newSettings);
    saveSchoolSettings(newSettings);
    const updatedLogs = addAuditLog(
      `${currentPersonnel.prefix}${currentPersonnel.firstName} ${currentPersonnel.lastName}`,
      currentPersonnel.position,
      'ปรับปรุงข้อมูลโรงเรียน',
      'บันทึกข้อมูลโรงเรียน กำหนดโควต้าวันลา และการตั้งค่าคลาวด์'
    );
    setAuditLogs(updatedLogs);
    syncAllData(leaveRecords, personnelList, newSettings, updatedLogs);
  };

  // Reset All Leave Records
  const handleResetAllLeaveRecords = () => {
    const emptyRecords: LeaveRecord[] = [];
    setLeaveRecords(emptyRecords);
    saveLeaveRecords(emptyRecords);

    const updatedLogs = addAuditLog(
      `${currentPersonnel.prefix}${currentPersonnel.firstName} ${currentPersonnel.lastName}`,
      currentPersonnel.position,
      'รีเซ็ตวันลาทั้งหมด',
      `ล้างข้อมูลคำขอลาทั้งหมดในระบบ และรีเซ็ตสถิติวันลาของบุคลากรทุกคนเป็น 0 วัน`
    );
    setAuditLogs(updatedLogs);
    syncAllData(emptyRecords, personnelList, settings, updatedLogs);
  };

  // Cancel leave record handler
  const handleCancelLeaveRecord = (recordId: string, reason = 'ยกเลิกตามคำขอ/ดุลยพินิจ') => {
    const updated = leaveRecords.map(r => {
      if (r.id === recordId) {
        return {
          ...r,
          status: 'cancelled' as const,
          cancellationReason: reason,
          cancelledBy: `${currentPersonnel.prefix}${currentPersonnel.firstName} ${currentPersonnel.lastName}`,
          cancelledAt: new Date().toISOString()
        };
      }
      return r;
    });

    setLeaveRecords(updated);
    const record = leaveRecords.find(r => r.id === recordId);
    const updatedLogs = addAuditLog(
      `${currentPersonnel.prefix}${currentPersonnel.firstName} ${currentPersonnel.lastName}`,
      currentPersonnel.position,
      'ยกเลิกใบลา',
      `ยกเลิกใบลา ${record?.referenceNumber || recordId} (เหตุผล: ${reason})`
    );
    setAuditLogs(updatedLogs);
    syncAllData(updated, personnelList, settings, updatedLogs);
  };

  // Pending count for notification badges
  const pendingCount = leaveRecords.filter(r => r.status === 'pending_academic' || r.status === 'pending_director').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-['Prompt',sans-serif]">
      {/* 1. Left Responsive Sidebar (Desktop full, Tablet collapsible, Mobile drawer) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        pendingApprovalCount={pendingCount}
        isPinUnlocked={isPinUnlocked}
        settings={settings}
        currentPersonnel={currentPersonnel}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileDrawerOpen={isMobileDrawerOpen}
        onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
        onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
      />

      {/* 2. Main Right Container with responsive left padding for Sidebar */}
      <div className={`min-h-screen flex flex-col transition-all duration-300 ${
        isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64 lg:pl-72'
      }`}>
        {/* Header Bar */}
        <Header
          currentPersonnel={currentPersonnel}
          allPersonnel={personnelList}
          onSelectPersonnel={handleSelectPersonnel}
          settings={settings}
          leaveRecords={leaveRecords}
          isPinUnlocked={isPinUnlocked}
          onLockPin={handleLockPin}
          onRequestPin={(targetTab) => {
            setPendingTargetTab(targetTab);
            setIsPinModalOpen(true);
          }}
          onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
          onOpenLineModal={() => setIsLineModalOpen(true)}
          onNavigateTab={handleSelectTab}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
          onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
        />

        {/* 3. Main Single Page Application Content Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-5 sm:py-7">
          {!hasSelectedRoleOnEntry ? (
            <div className="py-16 sm:py-24 text-center max-w-lg mx-auto px-4 animate-in fade-in duration-300">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-blue-900 via-indigo-900 to-blue-950 text-amber-300 flex items-center justify-center shadow-xl mb-6 ring-8 ring-blue-100">
                <Building2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight mb-2">
                ยินดีต้อนรับสู่ระบบจัดการวันลาออนไลน์
              </h2>
              <p className="text-slate-600 font-medium text-sm sm:text-base mb-1">
                {settings.schoolName || 'โรงเรียนบ้านห้วยไคร้'} ({settings.schoolArea || 'สพป.สุโขทัย เขต 2'})
              </p>
              <p className="text-xs text-emerald-700 font-bold mb-6">
                ระบบจัดการวันลาตลอดการใช้งาน (ไม่จำกัดปีงบประมาณ)
              </p>

              <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-2xl text-xs sm:text-sm font-medium mb-6 shadow-xs flex items-center gap-3 text-left">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                <span>
                  กรุณากดเลือก <strong>เข้าสู่ระบบในฐานะ</strong> จากหน้าต่างป๊อปอัปเพื่อแสดงข้อมูลแดชบอร์ดและสถิติวันลา
                </span>
              </div>

              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="inline-flex items-center gap-2.5 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 hover:from-blue-800 hover:to-indigo-800 text-white font-semibold px-6 py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer text-sm"
              >
                <LogIn className="w-4 h-4 text-amber-300" />
                <span>กดเลือกเข้าสู่ระบบในฐานะ</span>
              </button>
            </div>
          ) : (
            <>
              {/* SPA Modules (Rendered in-place without page reload) */}
              {activeTab === 'dashboard' && (
                <Dashboard
                  currentPersonnel={currentPersonnel}
                  allPersonnel={personnelList}
                  settings={settings}
                  leaveRecords={leaveRecords}
                  onNavigateToApply={() => setActiveTab('apply')}
                  onNavigateToHistory={() => setActiveTab('reports')}
                  onViewLeaveSlip={(rec) => setViewingLeaveSlip(rec)}
                />
              )}

              {activeTab === 'apply' && (
                <LeaveForm
                  currentPersonnel={currentPersonnel}
                  allPersonnel={personnelList}
                  settings={settings}
                  leaveRecords={leaveRecords}
                  onSubmitSuccess={handleSubmitLeaveSuccess}
                  onViewLeaveSlip={(rec) => setViewingLeaveSlip(rec)}
                />
              )}

              {activeTab === 'approvals' && (
                <ApprovalCenter
                  currentPersonnel={currentPersonnel}
                  allPersonnel={personnelList}
                  leaveRecords={leaveRecords}
                  settings={settings}
                  onApproveByAcademicHead={handleApproveByAcademicHead}
                  onApproveByDirector={handleApproveByDirector}
                  onViewLeaveSlip={(rec) => setViewingLeaveSlip(rec)}
                />
              )}

              {/* Merged Module: ประวัติการลา รายงาน สถิติ&กราฟ */}
              {activeTab === 'reports' && (
                <LeaveHistoryAndReports
                  currentPersonnel={currentPersonnel}
                  allPersonnel={personnelList}
                  leaveRecords={leaveRecords}
                  settings={settings}
                  onViewLeaveSlip={(rec) => setViewingLeaveSlip(rec)}
                  onCancelLeave={handleCancelLeaveRecord}
                />
              )}

              {activeTab === 'personnel' && (
                <PersonnelList
                  personnelList={personnelList}
                  onAddPersonnel={handleAddPersonnel}
                  onUpdatePersonnel={handleUpdatePersonnel}
                  onDeletePersonnel={handleDeletePersonnel}
                  leaveRecords={leaveRecords}
                  settings={settings}
                  currentPersonnel={currentPersonnel}
                />
              )}

              {/* School Info & Settings (including Audit Log & Google Drive/Sheets) */}
              {activeTab === 'organization' && (
                <OrganizationSettings
                  settings={settings}
                  allPersonnel={personnelList}
                  onSaveSettings={handleSaveSettings}
                  currentPersonnel={currentPersonnel}
                  onOpenGoogleSheetsModal={() => setIsGoogleSheetsOpen(true)}
                  onOpenLineModal={() => setIsLineModalOpen(true)}
                  leaveRecords={leaveRecords}
                  onResetAllLeaveRecords={handleResetAllLeaveRecords}
                  auditLogs={auditLogs}
                />
              )}
            </>
          )}
        </main>

        {/* 4. Footer */}
        <footer className="bg-white border-t border-slate-200 py-5 px-4 text-center text-xs text-slate-500 no-print">
          <div className="max-w-7xl mx-auto space-y-1">
            <p className="font-semibold text-slate-700">
              ระบบจัดการวันลาออนไลน์ {settings.schoolName || 'โรงเรียนบ้านห้วยไคร้'} ({settings.schoolArea || 'สพป.สุโขทัย เขต 2'})
            </p>
            <p className="text-[11px] text-slate-500 pt-0.5 font-medium">
              พัฒนาโดย นางสาวอวยพร  วิจักษณ์ภาณุสิน
            </p>
          </div>
        </footer>
      </div>

      {/* Security PIN Modal (1234) */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingTargetTab(null);
        }}
        onSuccess={handlePinSuccess}
        targetTabName={pendingTargetTab === 'approvals' ? 'การอนุมัติ' : 'ข้อมูลหน่วยงาน'}
        currentPersonnel={currentPersonnel}
        onQuickSwitchToAdmin={handleQuickSwitchToDirector}
      />

      {/* Official Thai Government Leave Slip Modal (A4 Print / Save PDF) */}
      {viewingLeaveSlip && (
        <OfficialLeaveSlipModal
          record={viewingLeaveSlip}
          onClose={() => setViewingLeaveSlip(null)}
          allPersonnel={personnelList}
          settings={settings}
          leaveRecords={leaveRecords}
        />
      )}

      {/* Cloud Synchronization Modal (Google Sheets) */}
      <GoogleSheetsModal
        isOpen={isGoogleSheetsOpen}
        onClose={() => setIsGoogleSheetsOpen(false)}
        settings={settings}
        onSaveCloudUrls={(googleUrl, autoSync) => {
          const updated = { 
            ...settings, 
            googleSheetsWebhookUrl: googleUrl,
            isAutoSyncEnabled: autoSync,
            lastSyncedAt: new Date().toISOString()
          };
          setSettings(updated);
          saveSchoolSettings(updated);
          syncAllData(leaveRecords, personnelList, updated, auditLogs);
        }}
        leaveRecords={leaveRecords}
        allPersonnel={personnelList}
        onTriggerSyncAll={() => syncAllData(leaveRecords, personnelList, settings, auditLogs)}
      />

      {/* LINE Messaging API School Group Notification Modal */}
      <LineSettingsModal
        isOpen={isLineModalOpen}
        onClose={() => setIsLineModalOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        currentPersonnel={currentPersonnel}
      />

      {/* Role Selection Pop-up Modal (เข้าสู่ระบบในฐานะ) */}
      <LoginRoleModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        allPersonnel={personnelList}
        currentPersonnel={hasSelectedRoleOnEntry ? currentPersonnel : null}
        onSelectPersonnel={handleLoginSelectPersonnel}
        settings={settings}
        canDismiss={hasSelectedRoleOnEntry}
      />

      {/* Welcome Toast upon selecting role */}
      {welcomeToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <p className="font-semibold text-emerald-400">เข้าสู่ระบบสำเร็จ</p>
            <p className="text-slate-200">{welcomeToast.name} ({welcomeToast.position})</p>
          </div>
          <button
            onClick={() => setWelcomeToast(null)}
            className="text-slate-400 hover:text-white ml-2 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
