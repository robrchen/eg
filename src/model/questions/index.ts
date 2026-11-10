import type { QuestionDef } from '../types';
import { Q2_1 } from './q2-1';
import { Q2_2 } from './q2-2';
import { Q2_3 } from './q2-3';

/** 可練習的題目（第二站） */
export const QUESTIONS: QuestionDef[] = [Q2_1, Q2_2, Q2_3];
const KEY = 'yishipei:question';

/** 目前題目：網址 ?q=q2-2 優先，其次上次選的，預設第一題 */
export function currentQuestion(): QuestionDef {
  let id: string | null = null;
  try { id = new URLSearchParams(location.search).get('q') ?? localStorage.getItem(KEY); } catch { /* ignore */ }
  return QUESTIONS.find(q => q.id === id) ?? QUESTIONS[0];
}

/** 換題：記住選擇後重新載入（各題的接線進度分開保存） */
export function switchQuestion(id: string): void {
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
  const u = new URL(location.href);
  u.searchParams.delete('q');
  location.href = u.toString();
}
