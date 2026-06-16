'use client';

// Global unified pricing: $3.99 one-time, no regional variation.
// This file is kept for import compatibility but always returns the global price.

export interface RegionalPrice {
  amount: string;
  currency: string;
  symbol: string;
  raw: number;
}

export function useRegionalPrice(): RegionalPrice {
  return {
    amount: '$3.99',
    currency: 'USD',
    symbol: '$',
    raw: 3.99,
  };
}
