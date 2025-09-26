/**
 * Business Intelligence Type Definitions
 * Comprehensive types for chicken business operations and AI analysis
 */

import type { ContextualAdvice } from '../services/aiStoreAdvisor';

// Core business advice interface extending ContextualAdvice
export interface BusinessAdvice extends ContextualAdvice {
  business_impact: 'low' | 'medium' | 'high' | 'critical';
  recommended_timeline: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  cost_estimate?: number;
  expected_roi?: number;
  implementation_difficulty: 'easy' | 'moderate' | 'challenging' | 'complex';
  category: 'operations' | 'finance' | 'supply_chain' | 'staffing' | 'customer_service';
}

// Chicken business pattern recognition
export interface ChickenBusinessPattern {
  pattern_id: string;
  pattern_type: 'sales' | 'inventory' | 'customer' | 'seasonal' | 'operational' | 'expense';
  pattern_name: string;
  description: string;
  frequency: number;
  confidence_score: number;
  impact_level: 'low' | 'medium' | 'high';
  data_points: any[];
  first_detected: string;
  last_seen: string;
  triggers: string[];
  correlations?: ChickenBusinessPattern[];
  business_type: 'purchase' | 'processing' | 'distribution' | 'cooking' | 'sales' | 'general';
  learned_patterns: Record<string, any>; // Add this for pattern storage
}

// Enhanced business memory with chicken-specific context
export interface ChickenBusinessMemory {
  id: string;
  pattern_type: string;
  pattern_data: {
    products?: string[];
    quantities?: number[];
    prices?: number[];
    times?: string[];
    weather_conditions?: string[];
    customer_demographics?: any;
    seasonal_factors?: string[];
  };
  frequency: number;
  success_rate: number;
  confidence: number;
  business_context: {
    location?: string;
    business_size: 'small' | 'medium' | 'large';
    menu_type: 'fried' | 'grilled' | 'mixed' | 'specialty';
    target_market: string[];
  };
  last_seen: string;
  created_at: string;
}

// Operational insights specific to chicken business
export interface ChickenOperationalInsight {
  insight_id: string;
  category: 'cooking' | 'inventory' | 'sales' | 'customer_service' | 'efficiency' | 'quality';
  title: string;
  description: string;
  recommended_action: string;
  urgency: 'low' | 'medium' | 'high' | 'immediate';
  data_source: 'pos' | 'inventory' | 'notes' | 'patterns' | 'ai_analysis';
  supporting_data: any;
  created_at: string;
}

// Sales pattern analysis
export interface ChickenSalesPattern {
  pattern_id: string;
  product_name: string;
  sales_trend: 'increasing' | 'decreasing' | 'stable' | 'seasonal';
  peak_hours: number[];
  peak_days: number[];
  average_quantity: number;
  price_sensitivity: 'low' | 'medium' | 'high';
  seasonal_factors: {
    month: number;
    multiplier: number;
    reason?: string;
  }[];
  customer_preferences: {
    preparation_style?: string;
    portion_size?: string;
    price_range?: string;
  };
}

// Inventory optimization recommendations
export interface ChickenInventoryAdvice {
  product_id: string;
  product_name: string;
  current_stock: number;
  recommended_stock: number;
  reorder_point: number;
  reorder_quantity: number;
  reasoning: string;
  cost_impact: number;
  risk_level: 'low' | 'medium' | 'high';
  shelf_life_considerations: string;
  supplier_recommendations?: string[];
}

// Financial performance insights
export interface ChickenFinancialInsight {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  profit_margin: number;
  top_selling_products: {
    product_name: string;
    quantity_sold: number;
    revenue: number;
    profit_margin: number;
  }[];
  expense_breakdown: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  cost_per_serving: {
    product_name: string;
    cost: number;
    selling_price: number;
    margin: number;
  }[];
  recommendations: BusinessAdvice[];
}

// Customer behavior analysis
export interface ChickenCustomerInsight {
  customer_segment: string;
  typical_order_size: number;
  preferred_products: string[];
  visit_frequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
  price_sensitivity: 'low' | 'medium' | 'high';
  peak_visit_times: string[];
  seasonal_preferences: {
    season: string;
    preferred_products: string[];
    order_modifications: string[];
  }[];
  loyalty_indicators: {
    repeat_customer: boolean;
    average_spend: number;
    referral_potential: 'low' | 'medium' | 'high';
  };
}

// Quality control insights
export interface ChickenQualityInsight {
  quality_metric: 'cooking_time' | 'oil_temperature' | 'seasoning' | 'presentation' | 'freshness';
  current_score: number;
  target_score: number;
  improvement_needed: boolean;
  specific_issues: string[];
  recommended_actions: string[];
  impact_on_sales: 'low' | 'medium' | 'high';
  monitoring_frequency: 'continuous' | 'hourly' | 'daily' | 'weekly';
}

// Staff performance and training insights
export interface ChickenStaffInsight {
  staff_member?: string;
  performance_area: 'cooking' | 'customer_service' | 'inventory' | 'cleanliness' | 'efficiency';
  current_performance: number;
  target_performance: number;
  strengths: string[];
  improvement_areas: string[];
  training_recommendations: string[];
  impact_on_business: 'low' | 'medium' | 'high';
}

// Comprehensive business health dashboard
export interface ChickenBusinessHealthDashboard {
  overall_health_score: number;
  last_updated: string;
  key_metrics: {
    daily_sales: number;
    profit_margin: number;
    customer_satisfaction: number;
    inventory_efficiency: number;
    operational_efficiency: number;
  };
  alerts: BusinessAdvice[];
  trends: {
    sales_trend: 'up' | 'down' | 'stable';
    profit_trend: 'up' | 'down' | 'stable';
    customer_trend: 'up' | 'down' | 'stable';
  };
  recommendations: BusinessAdvice[];
  patterns_detected: ChickenBusinessPattern[];
}

// All types are already exported via their individual interface declarations above