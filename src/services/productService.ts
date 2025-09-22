import { supabase } from '../src/supabaseConfig';
import type { Product } from '../types';
import { safeLog } from '../utils/securityUtils';

export const getProducts = async (): Promise<Product[]> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map((product: any) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      category: product.category || '',
      imageUrl: product.image_url || ''
    }));
  } catch (error) {
    safeLog.error('Error fetching products', error);
    throw new Error('Failed to fetch products');
  }
};

export const addProduct = async (productData: {
  name: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
}): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: productData.name,
        price: productData.price,
        stock: productData.stock,
        category: productData.category,
        image_url: productData.imageUrl,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    safeLog.error('Error adding product', error);
    throw new Error('Failed to add product');
  }
};

export const uploadProductImage = async (file: File): Promise<string> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `product-images/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    safeLog.error('Error uploading image', error);
    throw new Error('Failed to upload image');
  }
};