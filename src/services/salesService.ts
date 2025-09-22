import { supabase } from '../src/supabaseConfig';
import type { Sale } from '../types';
import { safeLog } from '../utils/securityUtils';
import { fixWorkerNames } from './dataFixService';

export const getSales = async (limitCount: number = 50): Promise<Sale[]> => {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select('id, created_at, items, total, payment, change_due, worker_id, worker_name')
      .order('created_at', { ascending: false })
      .limit(Math.min(limitCount, 100));

    if (error) {
      safeLog.warn('Sales fetch error', error.message);
      return [];
    }

    // Fix worker names in background if needed
    const hasUnknownWorkers = data?.some(sale => 
      !sale.worker_name || sale.worker_name === 'Unknown' || sale.worker_name === 'Worker'
    );
    if (hasUnknownWorkers) {
      fixWorkerNames().catch(() => {}); // Silent background fix
    }

    return (data || []).map((sale: any) => ({
      id: sale.id,
      date: sale.created_at,
      items: sale.items || [],
      total: sale.total,
      payment: sale.payment,
      change: sale.change_due,
      workerId: sale.worker_id || '',
      workerName: sale.worker_name || 'Worker'
    }));
  } catch (error) {
    safeLog.error('Error fetching sales', error);
    throw new Error('Failed to fetch sales');
  }
};

export const recordSale = async (saleData: {
  items: { productId: string; quantity: number }[];
  payment: number;
}): Promise<string> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let total = 0;
    const saleItems: any[] = [];

    const productIds = saleData.items.map(item => item.productId);
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (!products) throw new Error('Products not found');

    for (const item of saleData.items) {
      const product = products.find((p: any) => p.id === item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      
      const itemTotal = product.price * item.quantity;
      total += itemTotal;

      saleItems.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        price: product.price
      });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();
    
    const workerName = profile?.display_name || user.email?.split('@')[0] || 'User';
    
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        items: saleItems,
        subtotal: total,
        total,
        payment: saleData.payment,
        change_due: saleData.payment - total,
        worker_id: user.id,
        worker_name: workerName
      })
      .select()
      .single();

    if (saleError) throw saleError;
    return sale.id;
  } catch (error) {
    safeLog.error('Error recording sale', error);
    throw new Error('Failed to record sale: ' + (error as Error).message);
  }
};