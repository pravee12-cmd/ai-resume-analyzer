export type ScreenId =
  | 'dashboard'
  | 'upload'
  | 'analysis'
  | 'matcher'
  | 'interview'
  | 'history'
  | 'auth';

export interface ActiveUser {
  id?: string;
  name: string;
  email: string;
  contactNumber: string;
  role: string;
  photoUrl?: string;
  sessionHash?: string;
  createdAt?: string;
  lastActive?: string;
}

export interface CandidateAnalysis {
  id: string;
  fileName?: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  greeting: string;
  targetRole: string;
  score: number;
  scoreStatus: string;
  scoreStatusColor: string;
  scoreIcon: string;
  gaugeStrokeColor: string;
  summaryText: string;
  formatVerified: boolean;
  formatStatusText: string;
  percentileText: string;
  matchPercentage: number;
  matchCircleColor: string;
  matchedCount: number;
  missingCount: number;
  totalReqCount: number;
  skillsDetected: string[];
  missingSkills: string[];
  strengths: string[];
  education: { degree: string; institution: string; year: string; gpa: string }[];
  experience: { title: string; company: string; duration: string; impact: string }[];
  projects: { name: string; stack: string; outcome: string }[];
  certifications: { name: string; issuer: string; year: string }[];
  showCriticalWarning: boolean;
  criticalWarningText?: string;
  remediationTip: string;
  actionBtnText: string;
}

export type ActivityCategory =
  | 'resume_upload'
  | 'analysis_complete'
  | 'password_change'
  | 'account_auth';

export interface ActivityLogItem {
  id: string;
  category: ActivityCategory;
  title: string;
  description: string;
  candidateName: string;
  candidateEmail: string;
  contactNumber?: string;
  metadata?: string;
  status: '200 OK' | 'VERIFIED' | 'UPDATED';
  timestamp: string;
}

export interface MockInterviewQuestion {
  id: string;
  category: 'Technical' | 'Behavioral';
  difficulty: 'Core' | 'Intermediate' | 'Advanced';
  focusArea: string;
  question: string;
  whyAsked: string;
  expectedKeyPoints: string[];
  sampleAnswerFramework: string;
}


