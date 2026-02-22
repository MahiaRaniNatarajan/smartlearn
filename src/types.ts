export interface User {
  id: number;
  username: string;
  email: string;
  points: number;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  deadline: string;
  status: 'pending' | 'completed';
}

export interface Note {
  id: number;
  title: string;
  content: string;
  is_public: boolean;
  team_id?: number;
  author?: string;
  created_at: string;
}

export interface Team {
  id: number;
  name: string;
  created_by: number;
}

export interface Message {
  id: number;
  senderId: number;
  senderName?: string;
  teamId?: number;
  receiverId?: number;
  content: string;
  createdAt: string;
}

export interface StudyPlan {
  id: number;
  title: string;
  content: string;
  type: 'weekly' | 'monthly';
  start_date: string;
  created_at: string;
}
