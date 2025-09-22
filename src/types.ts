

export interface Sale {
  id: string;
  date: string; // ISO string
  items: { productId: string; name: string; quantity: number; price: number }[];
  total: number;
  payment: number;
  change: number;
  workerId: string;
  workerName: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
}

export interface Worker {
  id:string;
  name: string;
}

export interface Expense {
    id: string;
    date: string;
    description: string;
    amount: number;
    workerId: string;
    workerName: string;
}

export interface Theme {
  name: string;
  id: string;
  category: string;
}

export interface ForecastDataPoint {
    day: string;
    predictedSales: number;
}

export interface AIInsights {
    insights: string[];
    risks: string[];
    opportunities: string[];
}

export interface Note {
  id: string;
  date: string; // ISO string
  category: 'Delivery Note' | 'Reminder' | 'Supply Cost' | 'Internal Expense' | 'Other';
  title: string;
  description: string;
  amount?: number;
}

export interface ParsedSaleItem {
    product: Product;
    quantity: number;
}

export interface ParsedSale {
    items: ParsedSaleItem[];
    payment: number;
    total: number;
}

export interface ParsedSaleFromAI {
    items: {
        productName: string;
        quantity: number;
    }[];
    payment: number;
}
