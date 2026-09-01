export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';

export interface Task {
  id: string;
  title: string;
  assignee: string;
  status: TaskStatus;
  flagged: boolean;
}
