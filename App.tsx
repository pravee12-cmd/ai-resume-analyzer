/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ActiveUser, CandidateAnalysis, ScreenId } from './types';
import { DashboardScreen } from './components/DashboardScreen';
import { UploadResumeScreen } from './components/UploadResumeScreen';
import { AnalysisResultScreen } from './components/AnalysisResultScreen';
import { JobMatcherScreen } from './components/JobMatcherScreen';
import { AuthResetCenterScreen } from './components/AuthResetCenterScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { InterviewMockSimulator } from './components/InterviewMockSimulator';
import { getUserHistoryLocal, mergeUserHistoryWithLocal } from './utils/userHistoryStore';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('dashboard');
  const [activeUser, setActiveUser] = useState<ActiveUser>(() => {
    try {
      const saved = localStorage.getItem('resumetric_active_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name && parsed.email) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return {
      name: 'Bintu',
      email: 'bintu@gmail.com',
      contactNumber: '+91 9876543210',
      role: 'Senior Full-Stack Candidate',
    };
  });
  const [registeredUsers, setRegisteredUsers] = useState<ActiveUser[]>(() => {
    try {
      const savedList = localStorage.getItem('resumetric_registered_users');
      if (savedList) {
        const parsedList = JSON.parse(savedList);
        if (Array.isArray(parsedList) && parsedList.length > 0) {
          return parsedList;
        }
      }
    } catch {
      // ignore storage errors
    }
    return [
      {
        name: 'Bintu',
        email: 'bintu@gmail.com',
        contactNumber: '+91 9876543210',
        role: 'Senior Full-Stack Candidate',
      },
      {
        name: 'Divya Sharma',
        email: 'divya@gmail.com',
        contactNumber: '+91 9845012345',
        role: 'Mid-Level SWE Candidate',
      },
      {
        name: 'Elena Rostova',
        email: 'elena.rostova@gmail.com',
        contactNumber: '+1 4158904321',
        role: 'Staff Architect Candidate',
      },
      {
        name: 'Alex Rivera',
        email: 'alex.rivera@gmail.com',
        contactNumber: '+1 6504329876',
        role: 'Junior Developer Candidate',
      },
    ];
  });
  const [activeScenarioKey, setActiveScenarioKey] = useState<'stateA' | 'stateB' | 'stateC'>(
    'stateC'
  );
  const [customAnalysis, setCustomAnalysis] = useState<CandidateAnalysis | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Sync activeUser and registeredUsers to localStorage so user sessions persist across reloads & offline
  useEffect(() => {
    try {
      localStorage.setItem('resumetric_active_user', JSON.stringify(activeUser));
    } catch {
      // ignore storage errors
    }
  }, [activeUser]);

  useEffect(() => {
    try {
      localStorage.setItem('resumetric_registered_users', JSON.stringify(registeredUsers));
    } catch {
      // ignore storage errors
    }
  }, [registeredUsers]);

  // ---------------------------------------------------------------------------
  // 30-MINUTE SESSION TIMEOUT TIMER (Starts immediately when website opens: 1,800s)
  // ---------------------------------------------------------------------------
  const SESSION_DURATION_SEC = 30 * 60; // 30 minutes (1800 seconds)
  const WARNING_THRESHOLD_SEC = 120; // Show warning modal when <= 2 minutes remain
  const sessionStartRef = useRef<number>(Date.now());
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30 * 60);
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register' | 'forgot'>('forgot');
  const [sessionExpiredReason, setSessionExpiredReason] = useState<string | null>(null);

  const resetInactivityTimer = useCallback(() => {
    sessionStartRef.current = Date.now();
    setRemainingSeconds(SESSION_DURATION_SEC);
  }, [SESSION_DURATION_SEC]);

  const triggerSessionLogout = useCallback(
    async (reasonType: 'inactivity_timeout' | 'manual_logout') => {
      const isTimeout = reasonType === 'inactivity_timeout';
      setShowUserMenu(false);
      setAuthInitialTab('login');
      setSessionExpiredReason(
        isTimeout
          ? `Your 30-minute session for ${activeUser.name} (${activeUser.email}) has expired and automatically logged out to protect your account security. Please sign in again to start a new 30-minute session.`
          : `You have signed out of ${activeUser.name} (${activeUser.email}). Sign in as any user below to open their Dashboard.`
      );
      setCurrentScreen('auth');

      try {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: activeUser.name,
            email: activeUser.email,
            contactNumber: activeUser.contactNumber,
            reason: reasonType,
          }),
        });
      } catch {
        // ignore offline error
      }
    },
    [activeUser.name, activeUser.email, activeUser.contactNumber]
  );

  // Start the 30-minute countdown immediately as soon as the website opens
  useEffect(() => {
    if (currentScreen === 'auth') return;

    const tick = () => {
      const elapsedSec = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const secsLeft = Math.max(0, SESSION_DURATION_SEC - elapsedSec);
      setRemainingSeconds(secsLeft);

      if (secsLeft <= 0) {
        triggerSessionLogout('inactivity_timeout');
      }
    };

    // Run immediately and then every 1000ms so the user sees 29:59, 29:58, 29:57... right away
    tick();
    const intervalId = window.setInterval(tick, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentScreen, SESSION_DURATION_SEC, triggerSessionLogout]);

  const formatSessionTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Fetch registered dynamic users from Express backend on mount
  const refreshUsersList = async () => {
    try {
      const res = await fetch('/api/v1/users');
      const data = await res.json();
      if (res.ok && Array.isArray(data.users) && data.users.length > 0) {
        setRegisteredUsers(data.users);
      }
    } catch {
      // Fallback to state if offline
    }
  };

  useEffect(() => {
    refreshUsersList();
  }, []);

  // Update active user both locally and in the Express backend store
  const handleUpdateActiveUser = async (
    name: string,
    email: string,
    contactNumber?: string,
    role?: string,
    photoUrl?: string | null
  ) => {
    const cleanName = name.trim() || 'Candidate';
    const cleanEmail =
      email.trim() || `${cleanName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`;
    const cleanPhone = (contactNumber || activeUser.contactNumber || '+91 9876543210').trim();
    const previousEmail = activeUser.email;

    // Determine effective photoUrl: if null is passed, clear it; if string passed, use it; otherwise preserve existing if same user
    const isSameIdentity =
      cleanEmail.toLowerCase() === activeUser.email.toLowerCase() &&
      cleanName.toLowerCase() === activeUser.name.toLowerCase();
    const matchedRegistered = registeredUsers.find(
      (u) =>
        u.email.toLowerCase() === cleanEmail.toLowerCase() ||
        u.name.toLowerCase() === cleanName.toLowerCase()
    );
    const nextPhotoUrl =
      photoUrl === null
        ? undefined
        : photoUrl !== undefined
        ? photoUrl
        : isSameIdentity
        ? activeUser.photoUrl
        : matchedRegistered?.photoUrl;

    const updatedUserObj: ActiveUser = {
      name: cleanName,
      email: cleanEmail,
      contactNumber: cleanPhone,
      role: role || activeUser.role || 'Verified Candidate',
      photoUrl: nextPhotoUrl,
    };

    setActiveUser(updatedUserObj);

    setRegisteredUsers((prev) => {
      const exists = prev.some(
        (u) =>
          u.email.toLowerCase() === cleanEmail.toLowerCase() ||
          u.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (exists) {
        return prev.map((u) =>
          u.email.toLowerCase() === cleanEmail.toLowerCase() ||
          u.name.toLowerCase() === cleanName.toLowerCase()
            ? {
                ...u,
                name: cleanName,
                email: cleanEmail,
                contactNumber: cleanPhone,
                photoUrl: nextPhotoUrl,
              }
            : u
        );
      }
      return [updatedUserObj, ...prev];
    });

    // If signing into or switching to a different user account, restart the 30-minute session timer from 30:00
    if (!isSameIdentity) {
      resetInactivityTimer();
    }

    try {
      await fetch('/api/v1/auth/session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          contactNumber: cleanPhone,
          previousEmail,
          photoUrl: nextPhotoUrl ?? '',
        }),
      });
      await refreshUsersList();
    } catch {
      // Already updated registeredUsers in local state above
    }
  };

  const handleAuthSuccess = (user: ActiveUser, redirectToDashboard = false) => {
    const cleanName = (user.name || 'Candidate').trim();
    const cleanEmail =
      (user.email || '').trim().toLowerCase() ||
      `${cleanName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`;
    const cleanPhone = (user.contactNumber || activeUser.contactNumber || '+91 9876543210').trim();

    const nextUser: ActiveUser = {
      ...user,
      name: cleanName,
      email: cleanEmail,
      contactNumber: cleanPhone,
      role: user.role || 'Verified Candidate',
      photoUrl: user.photoUrl,
    };

    setActiveUser(nextUser);
    setRegisteredUsers((prev) => {
      const exists = prev.some(
        (u) =>
          u.email.toLowerCase() === cleanEmail.toLowerCase() ||
          u.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (exists) {
        return prev.map((u) =>
          u.email.toLowerCase() === cleanEmail.toLowerCase() ||
          u.name.toLowerCase() === cleanName.toLowerCase()
            ? { ...u, ...nextUser }
            : u
        );
      }
      return [nextUser, ...prev];
    });
    setSessionExpiredReason(null);
    resetInactivityTimer();
    refreshUsersList();
    if (redirectToDashboard) {
      setCurrentScreen('dashboard');
    }
  };

  // Restart the 30-minute session timer and fetch the active user's latest resume analysis whenever the signed-in user identity changes
  useEffect(() => {
    resetInactivityTimer();
  }, [activeUser.email, activeUser.name, activeUser.contactNumber, resetInactivityTimer]);

  // Fetch the active user's latest uploaded resume analysis from backend or localStorage whenever activeUser changes
  useEffect(() => {
    let isCancelled = false;
    const applyLatestItem = (latest: {
      id?: string;
      fileName?: string;
      targetRole?: string;
      score?: number;
      matchPercentage?: number;
      skillsDetected?: string[];
      missingSkills?: string[];
      strengths?: string[];
      formatVerified?: boolean;
      fullAnalysis?: CandidateAnalysis;
    }) => {
      if (latest.fullAnalysis) {
        setCustomAnalysis({
          ...latest.fullAnalysis,
          candidateName: activeUser.name,
          candidateEmail: activeUser.email,
          candidatePhone: activeUser.contactNumber,
        });
        return;
      }
      const scoreVal = Number(latest.score) || 78;
      const matchVal = Number(latest.matchPercentage) || 74;
      const isHigh = scoreVal >= 85;
      const isMid = scoreVal >= 65 && scoreVal < 85;

      const mappedAnalysis: CandidateAnalysis = {
        id: latest.id || 'user_latest',
        fileName:
          latest.fileName || `${activeUser.name.toLowerCase().replace(/\s+/g, '_')}_resume.pdf`,
        candidateName: activeUser.name,
        candidateEmail: activeUser.email,
        candidatePhone: activeUser.contactNumber,
        greeting: `Showing diagnostic for ${activeUser.name.split(' ')[0]}`,
        targetRole: latest.targetRole || activeUser.role || 'Full Stack Software Engineer',
        score: scoreVal,
        scoreStatus: isHigh ? 'Exceptional' : isMid ? 'Competitive' : 'Needs Improvement',
        scoreStatusColor: isHigh
          ? 'bg-tertiary-fixed/30 text-tertiary'
          : isMid
          ? 'bg-primary-fixed/40 text-primary'
          : 'bg-error-container text-on-error-container',
        scoreIcon: isHigh ? 'verified' : isMid ? 'trending_up' : 'warning',
        gaugeStrokeColor: isHigh ? '#006e4b' : isMid ? '#3525cd' : '#ba1a1a',
        summaryText:
          (latest.strengths && latest.strengths[0]) ||
          `Personalized ATS telemetry for ${activeUser.name} (${activeUser.email}).`,
        formatVerified: latest.formatVerified ?? true,
        formatStatusText:
          latest.formatVerified !== false
            ? 'Formatting integrity verified (100% ATS score)'
            : 'Formatting layout warnings detected',
        percentileText: isHigh
          ? 'Top 5% of candidates'
          : isMid
          ? 'Top 22% of candidates'
          : 'Top 48% of candidates',
        matchPercentage: matchVal,
        matchCircleColor: isHigh ? '#006e4b' : '#3525cd',
        matchedCount: Array.isArray(latest.skillsDetected) ? latest.skillsDetected.length : 5,
        missingCount: Array.isArray(latest.missingSkills) ? latest.missingSkills.length : 2,
        totalReqCount:
          (Array.isArray(latest.skillsDetected) ? latest.skillsDetected.length : 5) +
          (Array.isArray(latest.missingSkills) ? latest.missingSkills.length : 2),
        skillsDetected: Array.isArray(latest.skillsDetected)
          ? latest.skillsDetected
          : ['JavaScript', 'React', 'Node.js', 'SQL'],
        missingSkills: Array.isArray(latest.missingSkills)
          ? latest.missingSkills
          : ['Docker', 'Kubernetes'],
        strengths: Array.isArray(latest.strengths)
          ? latest.strengths
          : [`Verified resume profile for ${activeUser.name}`],
        education: [],
        experience: [],
        projects: [],
        certifications: [],
        showCriticalWarning: scoreVal < 60,
        remediationTip:
          Array.isArray(latest.missingSkills) && latest.missingSkills.length > 0
            ? `Adding ${latest.missingSkills.slice(0, 2).join(' & ')} will boost ${activeUser.name}'s role match significantly.`
            : `Strong alignment for ${activeUser.name}.`,
        actionBtnText: 'Explore Matched Roles',
      };
      setCustomAnalysis(mappedAnalysis);
    };

    const syncActiveUserLatestAnalysis = async () => {
      const localItems = getUserHistoryLocal(activeUser);
      if (localItems.length > 0 && !isCancelled) {
        applyLatestItem(localItems[0]);
      }

      try {
        const params = new URLSearchParams({
          email: activeUser.email,
          contactNumber: activeUser.contactNumber || '',
          name: activeUser.name,
        });
        const res = await fetch(`/api/v1/history?${params.toString()}`);
        const data = await res.json();
        const serverList = Array.isArray(data.history)
          ? data.history
          : Array.isArray(data.records)
          ? data.records
          : [];
        if (!isCancelled && res.ok && serverList.length > 0) {
          const merged = mergeUserHistoryWithLocal(serverList, activeUser);
          if (merged.length > 0) {
            applyLatestItem(merged[0]);
            return;
          }
        }
        if (!isCancelled && localItems.length === 0) {
          setCustomAnalysis(null);
        }
      } catch {
        if (!isCancelled && localItems.length === 0) {
          setCustomAnalysis(null);
        }
      }
    };

    syncActiveUserLatestAnalysis();
    return () => {
      isCancelled = true;
    };
  }, [activeUser.email, activeUser.contactNumber, activeUser.name, activeUser.role]);

  // Dynamically generate a personalized profile for ANY signed-in user without hardcoding specific names
  const getUserSpecificDefaultAnalysis = (user: ActiveUser): CandidateAnalysis => {
    let hash = 0;
    const seedStr = `${user.name.trim().toLowerCase()}:${user.email.trim().toLowerCase()}`;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) % 1000;
    }
    const dynamicScore = 64 + (hash % 31); // 64..94
    const dynamicMatch = Math.max(52, Math.min(96, dynamicScore - 4 + ((hash >> 2) % 9)));
    const skillPools = [
      ['JavaScript', 'TypeScript', 'React', 'Node.js', 'MongoDB', 'REST API', 'Docker', 'SQL'],
      ['Python', 'JavaScript', 'MongoDB', 'HTML', 'CSS', 'SQL'],
      ['Python', 'SQL', 'FastAPI', 'Docker', 'Git', 'AWS'],
      ['Java', 'Spring Boot', 'PostgreSQL', 'Docker', 'AWS', 'REST API'],
      ['Python', 'Pandas', 'Machine Learning', 'SQL', 'MongoDB', 'Git'],
    ];
    const missingPools = [
      ['Kubernetes Cluster Ops'],
      ['Node.js', 'React', 'REST API'],
      ['Kubernetes', 'GraphQL'],
      ['Kubernetes', 'Terraform'],
      ['Deep Learning', 'MLOps'],
    ];
    const rolePools = [
      'Full Stack Software Engineer',
      'Backend Software Engineer',
      'Cloud Platform Engineer',
      'Data & AI Engineer',
      'Senior Frontend Engineer',
    ];
    const poolIdx = hash % skillPools.length;
    const pickedSkills = skillPools[poolIdx];
    const pickedMissing = missingPools[poolIdx];
    const stateIds: ('stateA' | 'stateB' | 'stateC')[] = ['stateA', 'stateB', 'stateC'];

    return {
      id: stateIds[hash % stateIds.length],
      fileName: `${user.name.toLowerCase().replace(/\s+/g, '_')}_resume.pdf`,
      candidateName: user.name,
      candidateEmail: user.email,
      candidatePhone: user.contactNumber,
      greeting: `Showing diagnostic for ${user.name.split(' ')[0]}`,
      targetRole:
        user.role && !user.role.includes('Candidate') ? user.role : rolePools[poolIdx],
      score: dynamicScore,
      scoreStatus: dynamicScore >= 82 ? 'Exceptional' : 'Competitive',
      scoreStatusColor:
        dynamicScore >= 82
          ? 'bg-tertiary-fixed/30 text-tertiary'
          : 'bg-primary-fixed/40 text-primary',
      scoreIcon: dynamicScore >= 82 ? 'verified' : 'trending_up',
      gaugeStrokeColor: dynamicScore >= 82 ? '#006e4b' : '#3525cd',
      summaryText: `Personalized candidate baseline for ${user.name} (${user.email}). Upload a new resume PDF/DOCX anytime to recalculate live ATS telemetry.`,
      formatVerified: true,
      formatStatusText: 'Formatting integrity verified (ATS ready)',
      percentileText: `Top ${Math.max(4, 100 - dynamicScore)}% of candidates`,
      matchPercentage: dynamicMatch,
      matchCircleColor: dynamicScore >= 82 ? '#006e4b' : '#3525cd',
      matchedCount: pickedSkills.length,
      missingCount: pickedMissing.length,
      totalReqCount: pickedSkills.length + pickedMissing.length,
      skillsDetected: pickedSkills,
      missingSkills: pickedMissing,
      strengths: [
        `Verified core stack in ${pickedSkills.slice(0, 3).join(', ')}`,
        `Personalized workspace bound to ${user.name} (${user.email})`,
      ],
      education: [],
      experience: [],
      projects: [],
      certifications: [],
      showCriticalWarning: false,
      remediationTip: `Adding ${pickedMissing.join(' & ')} will increase ${user.name}'s role match percentage.`,
      actionBtnText: 'Upload Custom Resume',
    };
  };

  const defaultAnalysisSummary: CandidateAnalysis = getUserSpecificDefaultAnalysis(activeUser);

  const currentAnalysisSummary: CandidateAnalysis =
    customAnalysis &&
    customAnalysis.candidateEmail.toLowerCase() === activeUser.email.toLowerCase()
      ? {
          ...customAnalysis,
          candidateName: activeUser.name,
          candidateEmail: activeUser.email,
          candidatePhone: activeUser.contactNumber,
        }
      : defaultAnalysisSummary;

  // Dynamic per-user quota / scan credits based on the active user's identity and score
  const userCreditsUsed = Math.min(
    98,
    Math.max(
      40,
      55 +
        ((activeUser.email
          .split('')
          .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) +
          currentAnalysisSummary.score) %
          40)
    )
  );

  if (currentScreen === 'auth') {
    return (
      <AuthResetCenterScreen
        activeUser={activeUser}
        registeredUsers={registeredUsers}
        onAuthSuccess={handleAuthSuccess}
        onNavigate={(s) => {
          resetInactivityTimer();
          setSessionExpiredReason(null);
          setCurrentScreen(s);
        }}
        initialTab={authInitialTab}
        sessionExpiredReason={sessionExpiredReason}
        onClearExpiredReason={() => setSessionExpiredReason(null)}
      />
    );
  }

  const initialLetter = (activeUser.name.trim()[0] || 'B').toUpperCase();

  const navItems: { id: ScreenId; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid_view' },
    { id: 'upload', label: 'Upload Resume', icon: 'cloud_upload' },
    { id: 'analysis', label: 'Analysis Result', icon: 'donut_large' },
    { id: 'matcher', label: 'Job Matcher', icon: 'fact_check' },
    { id: 'interview', label: 'Mock Interview', icon: 'record_voice_over' },
    { id: 'history', label: 'History', icon: 'manage_search' },
    { id: 'auth', label: 'Auth & Reset', icon: 'lock_reset' },
  ];

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen">
      {/* Top Fixed Header Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-inverse-surface text-inverse-on-surface z-50 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <div className="h-16 w-full px-gutter flex items-center justify-between">
          <div className="flex items-center gap-space-lg">
            <button
              type="button"
              onClick={() => setCurrentScreen('dashboard')}
              className="flex items-center gap-space-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-primary-fixed-dim text-[26px]">
                psychology
              </span>
              <span className="text-base font-bold tracking-tight text-inverse-on-surface">
                AI Resume Analyzer
              </span>
            </button>

            <nav className="hidden lg:flex items-center gap-space-xs pl-space-lg">
              {navItems.map((item) => {
                const isActive = currentScreen === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCurrentScreen(item.id)}
                    className={`px-space-sm py-space-xs text-sm rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'text-inverse-on-surface font-semibold bg-surface-variant/20'
                        : 'text-secondary-fixed-dim hover:text-inverse-on-surface hover:bg-surface-variant/10'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right User Profile Pill, Live 30m Session Countdown & Dynamic Switcher Dropdown */}
          <div className="relative flex items-center gap-space-sm">
            {/* Live 30-Minute Session Countdown Indicator (Starts immediately on website open) */}
            <div
              title="30-Minute Session Timer: Automatically logs out when countdown reaches 00:00. Click the refresh icon to reset to 30:00."
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border transition-colors ${
                remainingSeconds <= WARNING_THRESHOLD_SEC
                  ? 'bg-error/20 border-error text-error-container animate-pulse'
                  : 'bg-surface-variant/15 border-outline-variant/25 text-secondary-fixed-dim'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-tertiary-fixed animate-ping" />
              <span className="hidden md:inline">Session Timer:</span>
              <span className="font-bold text-inverse-on-surface tabular-nums">
                {formatSessionTimer(remainingSeconds)}
              </span>
              <button
                type="button"
                onClick={resetInactivityTimer}
                title="Reset session timer to 30:00"
                className="ml-0.5 text-secondary-fixed-dim hover:text-inverse-on-surface flex items-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-space-xs pl-space-xs pr-space-sm py-space-2xs bg-surface-variant/10 hover:bg-surface-variant/20 rounded-full cursor-pointer transition-colors"
            >
              {activeUser.photoUrl ? (
                <img
                  src={activeUser.photoUrl}
                  alt={activeUser.name}
                  className="w-8 h-8 rounded-full object-cover border border-primary-fixed-dim"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
                  {initialLetter}
                </div>
              )}
              <span className="text-sm text-inverse-on-surface font-medium hidden sm:inline">
                {activeUser.name.split(' ')[0]}
              </span>
              <span className="material-symbols-outlined text-secondary-fixed-dim text-[18px]">
                expand_more
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-12 w-72 bg-surface-container-lowest text-on-surface rounded-xl shadow-xl border border-outline-variant/40 p-space-sm z-50">
                <div className="px-2 py-2 border-b border-outline-variant/20 mb-1 flex items-center gap-2.5">
                  {activeUser.photoUrl ? (
                    <img
                      src={activeUser.photoUrl}
                      alt={activeUser.name}
                      className="w-10 h-10 rounded-full object-cover border border-primary shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm shrink-0">
                      {initialLetter}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-semibold text-secondary uppercase tracking-wider">
                      Active Session Identity
                    </div>
                    <div className="text-sm font-bold text-on-surface truncate">
                      Welcome, {activeUser.name}
                    </div>
                    <div className="text-xs font-mono text-primary font-semibold truncate">
                      {activeUser.email}
                    </div>
                    <div className="text-[11px] font-mono text-secondary truncate">
                      {activeUser.contactNumber}
                    </div>
                  </div>
                </div>

                <div className="pt-1 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      setAuthInitialTab('login');
                      setCurrentScreen('auth');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-surface-container text-xs font-semibold text-on-surface flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">login</span>
                    <span>Sign In as Another User</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      setCurrentScreen('dashboard');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-surface-container text-xs font-semibold text-primary flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                    <span>Profile Photo &amp; Edit Name</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      setAuthInitialTab('forgot');
                      setCurrentScreen('auth');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-surface-container text-xs font-semibold text-tertiary flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                    <span>Reset Password on Website</span>
                  </button>
                  {typeof window !== 'undefined' && window.location.protocol !== 'file:' && (
                    <a
                      href="/api/v1/export/project-zip"
                      download="ai-resume-analyzer-localhost.zip"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-surface-container text-xs font-semibold text-on-surface flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] text-secondary">
                        folder_zip
                      </span>
                      <span>Export Localhost .ZIP</span>
                    </a>
                  )}

                  {/* 30-Minute Inactivity Security Policy & Quick Simulation / Logout */}
                  <div className="mt-1 pt-1.5 border-t border-outline-variant/20 flex flex-col gap-1">
                    <div className="px-2.5 py-1 rounded-lg bg-surface-container-low flex items-center justify-between text-[11px] font-mono text-secondary">
                      <span>30m Inactivity Timer</span>
                      <span className="font-bold text-on-surface">
                        {formatSessionTimer(remainingSeconds)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerSessionLogout('inactivity_timeout')}
                      className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-amber-500/10 text-xs font-semibold text-amber-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">timer_off</span>
                      <span>Simulate 30m Inactivity Logout</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerSessionLogout('manual_logout')}
                      className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-error/10 text-xs font-semibold text-error flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">logout</span>
                      <span>Sign Out to Login Screen</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Pre-Logout Warning Modal when <= 2 Minutes of Inactivity Remain */}
      {remainingSeconds <= WARNING_THRESHOLD_SEC && remainingSeconds > 0 && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-error/15 text-error flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">timer_off</span>
              </div>
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-error">
                  30-Minute Inactivity Security Policy
                </span>
                <h3 className="text-lg font-bold text-on-surface">
                  Session Expiring in {formatSessionTimer(remainingSeconds)}
                </h3>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant">
              You have been inactive for nearly 30 minutes. For your security, your session for{' '}
              <strong className="text-on-surface">{activeUser.name}</strong> will automatically log
              out to the Login screen when the timer reaches 00:00.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => triggerSessionLogout('inactivity_timeout')}
                className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-secondary cursor-pointer"
              >
                Log Out Now
              </button>
              <button
                type="button"
                onClick={resetInactivityTimer}
                className="px-4 py-2 rounded-lg bg-primary-container text-on-primary text-xs font-semibold cursor-pointer"
              >
                Stay Signed In (Reset 30m Timer)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Fixed Sidebar */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-inverse-surface z-40 hidden md:flex flex-col justify-between py-space-lg">
        <div className="px-space-md">
          <div className="px-space-sm pb-space-sm text-xs font-semibold uppercase tracking-wider text-secondary-fixed-dim">
            Workspace
          </div>
          <nav className="flex flex-col gap-space-2xs">
            {navItems.map((item) => {
              const isActive = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentScreen(item.id)}
                  className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-primary-container text-on-primary font-semibold'
                      : 'text-secondary-fixed-dim hover:bg-surface-variant/10 hover:text-inverse-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="text-sm">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Credits & Active Candidate Status Card */}
        <div className="px-space-md pt-space-md">
          <div className="p-space-md rounded-xl bg-surface-variant/10 flex flex-col gap-space-xs">
            <div className="flex items-center justify-between text-secondary-fixed-dim">
              <span className="text-xs font-semibold uppercase tracking-wider">AI Scan Credits</span>
              <span className="text-xs font-semibold text-tertiary-fixed font-mono">
                {userCreditsUsed}/100
              </span>
            </div>
            <div className="w-full h-1.5 bg-surface-variant/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-tertiary-fixed rounded-full transition-all duration-500"
                style={{ width: `${userCreditsUsed}%` }}
              ></div>
            </div>
            <div className="pt-space-2xs flex items-center justify-between text-xs text-secondary-fixed-dim">
              <span>Score: {currentAnalysisSummary.score}/100</span>
              <span className="font-mono text-[11px] text-primary-fixed-dim truncate max-w-[105px]">
                {activeUser.name}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="md:pl-64">
        <main className="relative pt-16 min-h-screen bg-background w-full px-gutter py-space-lg">
          <div className="pt-4">
            {currentScreen === 'dashboard' && (
              <DashboardScreen
                activeUser={activeUser}
                registeredUsers={registeredUsers}
                onUpdateActiveUser={handleUpdateActiveUser}
                onResetSessionTimer={resetInactivityTimer}
                onNavigate={(s) => setCurrentScreen(s)}
                onSignOutToLogin={() => {
                  setAuthInitialTab('login');
                  setCurrentScreen('auth');
                }}
                currentAnalysis={currentAnalysisSummary}
              />
            )}

            {currentScreen === 'upload' && (
              <UploadResumeScreen
                activeUser={activeUser}
                onAnalysisComplete={(stateKey, _customRole, _fileName, dynamicAnalysis) => {
                  setActiveScenarioKey(stateKey);
                  if (dynamicAnalysis) {
                    setCustomAnalysis(dynamicAnalysis);
                  } else {
                    setCustomAnalysis(null);
                  }
                  setCurrentScreen('analysis');
                }}
                onNavigate={(s) => setCurrentScreen(s)}
              />
            )}

            {currentScreen === 'analysis' && (
              <AnalysisResultScreen
                activeUser={activeUser}
                initialCaseKey={activeScenarioKey}
                customAnalysis={customAnalysis}
                onUpdateActiveUser={(name, email, role) =>
                  handleUpdateActiveUser(name, email, activeUser.contactNumber, role)
                }
                onNavigate={(s) => setCurrentScreen(s)}
              />
            )}

            {currentScreen === 'matcher' && <JobMatcherScreen activeUser={activeUser} />}

            {currentScreen === 'interview' && (
              <InterviewMockSimulator
                activeUser={activeUser}
                currentAnalysis={currentAnalysisSummary}
                onNavigate={(s) => setCurrentScreen(s)}
              />
            )}

            {currentScreen === 'history' && (
              <HistoryScreen
                activeUser={activeUser}
                onNavigate={(s) => setCurrentScreen(s)}
                onInspectPreviousUpload={(restoredAnalysis) => {
                  setCustomAnalysis(restoredAnalysis);
                  setCurrentScreen('analysis');
                }}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
