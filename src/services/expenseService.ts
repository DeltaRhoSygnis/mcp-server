import { supabase } from '../src/supabaseConfig';
import type { Expense } from '../types';
import { safeLog } from '../utils/securityUtils';
import { fixWorkerNames } from './dataFixService';

export const getExpenses = async (limitCount: number = 50): Promise<Expense[]> => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('id, created_at, description, amount, worker_id, worker_name')
      .order('created_at', { ascending: false })
      .limit(Math.min(limitCount, 100));

    if (error) {
      safeLog.warn('Expenses fetch error', error.message);
      return [];
    }

    // Fix worker names in background if needed
    const hasUnknownWorkers = data?.some((expense: any) => 
      !expense.worker_name || expense.worker_name === 'Unknown' || expense.worker_name === 'Worker'
    );
    if (hasUnknownWorkers) {
      fixWorkerNames().catch(() => {}); // Silent background fix
    }

    return (data || []).map((expense: any) => ({
      id: expense.id,
      date: expense.created_at,
      description: expense.description,
      amount: expense.amount,
      workerId: expense.worker_id || '',
      workerName: expense.worker_name || 'Worker'
    }));
  } catch (error) {
    safeLog.error('Error fetching expenses', error);
    return [];
  }
};

export const recordExpense = async (expenseData: {
  amount: number;
  description: string;
}): Promise<string> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let workerName = 'Unknown Worker';
    
    // ALWAYS get fresh display name from user_profiles
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name, email')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        workerName = profile.display_name || profile.email?.split('@')[0] || user.email?.split('@')[0] || 'Unknown Worker';
      } else {
        // Fallback to auth user email
        workerName = user.email?.split('@')[0] || 'Unknown Worker';
      }
    } catch (profileError) {
      console.warn('Could not fetch user profile, using auth email:', profileError);
      workerName = user.email?.split('@')[0] || 'Unknown Worker';
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        description: expenseData.description,
        amount: expenseData.amount,
        worker_id: user.id,
        worker_name: workerName
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    safeLog.error('Error recording expense', error);
    throw new Error('Failed to record expense');
  }
};