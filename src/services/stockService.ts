import { supabase } from '../src/supabaseConfig';
import { recordSale, recordExpense } from './supabaseService';

export const applyParsedDataToStock = async (noteId: string, parsedData: any, userId: string) => {
  try {
    // Apply purchases - add to products or update stock
    if (parsedData.purchases) {
      for (const purchase of parsedData.purchases) {
        // Find or create product
        const { data: existingProduct } = await supabase
          .from('products')
          .select('*')
          .ilike('name', `%${purchase.product}%`)
          .single();

        if (existingProduct) {
          // Update existing product stock
          await supabase
            .from('products')
            .update({ 
              stock: existingProduct.stock + (purchase.bags * (purchase.units_per_bag || 1))
            })
            .eq('id', existingProduct.id);
        } else {
          // Create new product
          await supabase
            .from('products')
            .insert({
              name: purchase.product,
              price: 50, // Default price
              stock: purchase.bags * (purchase.units_per_bag || 1),
              category: 'chicken'
            });
        }

        // Record expense for purchase
        await recordExpense({
          description: `Purchased ${purchase.bags} bags of ${purchase.product}`,
          amount: purchase.bags * 500 // Estimate cost
        });
      }
    }

    // Apply sales - create sales records and reduce stock
    if (parsedData.sales) {
      for (const sale of parsedData.sales) {
        // Find chicken product
        const { data: product } = await supabase
          .from('products')
          .select('*')
          .ilike('name', '%chicken%')
          .single();

        if (product && product.stock >= sale.pieces) {
          // Create sale record
          await recordSale({
            items: [{
              productId: product.id,
              quantity: sale.pieces
            }],
            payment: sale.pieces * sale.price
          });

          // Update stock
          await supabase
            .from('products')
            .update({ stock: product.stock - sale.pieces })
            .eq('id', product.id);
        }
      }
    }

    // Apply cooking - reduce stock
    if (parsedData.cooking) {
      for (const cook of parsedData.cooking) {
        const { data: product } = await supabase
          .from('products')
          .select('*')
          .ilike('name', '%chicken%')
          .single();

        if (product) {
          const piecesToCook = cook.bags * 40; // Assume 40 pieces per bag
          await supabase
            .from('products')
            .update({ stock: Math.max(0, product.stock - piecesToCook) })
            .eq('id', product.id);
        }
      }
    }

    // Mark note as applied
    await supabase
      .from('notes')
      .update({ status: 'applied' })
      .eq('id', noteId);

    return { success: true };
  } catch (error) {
    console.error('Failed to apply stock data:', error);
    return { success: false, error: 'Failed to apply to stock' };
  }
};