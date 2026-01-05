
export interface User {
  name: string;
  phone: string;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  photo?: string;
  timestamp: number;
}

export interface Project {
  id: string;
  name: string;
  phone: string;
  progress: number;
}

export interface Note {
  id: string;
  text: string;
  timestamp: number;
}

export type Page = 'home' | 'accounting' | 'notes' | 'projects';
export type Lang = 'zh' | 'en';

export interface VoiceCommandResponse {
  action: 'add_expense' | 'add_note' | 'add_project' | 'unknown';
  data: {
    amount?: number;
    description?: string;
    text?: string;
    name?: string;
    phone?: string;
  };
  feedback: string;
}
