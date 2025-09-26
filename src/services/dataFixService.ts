import { supabase } from '../config/supabaseConfig';
import { safeLog } from '../utils/securityUtils';

/**
 * Fix missing worker names in existing records
 */
export const fixWorkerNames = async (): Promise<void> => {
  try {
    // Get all user profiles
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, display_name, email');

    if (profileError) {
      safeLog('Could not fetch user profiles', profileError.message);
      return;
    }

    if (!profiles || profiles.length === 0) {
      safeLog('No user profiles found');
      return;
    }

    // Fix sales records
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('id, worker_id, worker_name')
      .or('worker_name.is.null,worker_name.eq.Unknown,worker_name.eq.Worker');

    if (!salesError && sales) {
      for (const sale of sales) {
        const profile = profiles.find((p: any) => p.id === sale.worker_id);
        if (profile) {
          const workerName = profile.display_name || profile.email?.split('@')[0] || 'Worker';
          await supabase
            .from('sales')
            .update({ worker_name: workerName })
            .eq('id', sale.id);
        }
      }
      safeLog(`Fixed ${sales.length} sales records`);
    }

    // Fix expense records
    const { data: expenses, error: expenseError } = await supabase
      .from('expenses')
      .select('id, worker_id, worker_name')
      .or('worker_name.is.null,worker_name.eq.Unknown,worker_name.eq.Worker');

    if (!expenseError && expenses) {
      for (const expense of expenses) {
        const profile = profiles.find((p: any) => p.id === expense.worker_id);
        if (profile) {
          const workerName = profile.display_name || profile.email?.split('@')[0] || 'Worker';
          await supabase
            .from('expenses')
            .update({ worker_name: workerName })
            .eq('id', expense.id);
        }
      }
      safeLog(`Fixed ${expenses.length} expense records`);
    }

  } catch (error) {
    safeLog('Error fixing worker names', error);
  }
};

/**
 * Ensure user profile exists for current user
 */
export const ensureUserProfile = async (): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if profile exists
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist, create it
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          email: user.email,
          display_name: user.email?.split('@')[0] || 'User',
          role: 'owner' // Default to owner for existing users
        });

      if (insertError) {
        safeLog('Could not create user profile', insertError.message);
      } else {
        safeLog('Created user profile');
      }
    }
  } catch (error) {
    safeLog('Error ensuring user profile', error);
  }
};