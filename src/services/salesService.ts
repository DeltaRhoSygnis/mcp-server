import { supabase } from '../config/supabaseConfig';
import type { Sale, Product } from '../types';
import { safeLog } from '../utils/securityUtils';
import { fixWorkerNames } from './dataFixService';
import { parseSaleFromVoice } from './geminiService';

export const getSales = async (limitCount: number = 50): Promise<Sale[]> => {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select('id, created_at, items, total, payment, change_due, worker_id, worker_name')
      .order('created_at', { ascending: false })
      .limit(Math.min(limitCount, 100));

    if (error) {
      safeLog('Sales fetch error', error.message);
      return [];
    }

    // Fix worker names in background if needed
    const hasUnknownWorkers = data?.some((sale: any) => 
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
    safeLog('Error fetching sales', error);
    throw new Error('Failed to fetch sales');
  }
};

export const recordSale = async (saleData: {
  items?: { productId: string; quantity: number }[]; // Optional for manual input
  transcript?: string; // New: Voice transcript for AI parsing
  payment?: number; // Optional if in transcript
  products?: Product[]; // Needed for parsing
}): Promise<string> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let items: { productId: string; quantity: number }[] = [];
    let total = 0;
    let finalPayment = saleData.payment || 0;

    if (saleData.transcript && saleData.products) {
      // Parse voice transcript using AI
      const parsed = await parseSaleFromVoice(saleData.transcript, saleData.products);
      
      // Map parsed items to product IDs (assuming products have id and name)
      items = parsed.items.map((item: { productName: string; quantity: number }) => {
        const product = saleData.products?.find((p: Product) => p.name === item.productName);
        if (!product) throw new Error(`Product ${item.productName} not found`);
        return { productId: product.id, quantity: item.quantity };
      });
      
      finalPayment = parsed.payment;
    } else if (saleData.items) {
      // Manual input fallback
      items = saleData.items;
    } else {
      throw new Error('Either items or transcript with products must be provided');
    }

    // Calculate total from items
    const productIds = items.map(item => item.productId);
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (!products) throw new Error('Products not found');

    for (const item of items) {
      const product = products.find((p: any) => p.id === item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      
      const itemTotal = product.price * item.quantity;
      total += itemTotal;
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
        items: items.map(item => {
          const product = products.find((p: any) => p.id === item.productId);
          return {
            productId: item.productId,
            productName: product?.name,
            quantity: item.quantity,
            price: product?.price
          };
        }),
        subtotal: total,
        total,
        payment: finalPayment,
        change_due: finalPayment - total,
        worker_id: user.id,
        worker_name: workerName,
        source: saleData.transcript ? 'voice_parsed' : 'manual' // Track source
      })
      .select()
      .single();

    if (saleError) throw saleError;
    return sale.id;
  } catch (error) {
    safeLog('Error recording sale', error);
    throw new Error('Failed to record sale: ' + (error as Error).message);
  }
};