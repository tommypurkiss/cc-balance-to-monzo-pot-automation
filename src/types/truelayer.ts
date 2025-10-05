export interface TrueLayerTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface TrueLayerAccount {
  account_id: string;
  account_type: string;
  account_number: {
    iban?: string;
    number?: string;
    sort_code?: string;
    swift_bic?: string;
  };
  currency: string;
  display_name: string;
  provider: {
    display_name: string;
    logo_uri: string;
    provider_id: string;
  };
  update_timestamp: string;
}

export interface TrueLayerBalance {
  available: number;
  current: number;
  overdraft?: number;
  update_timestamp: string;
}

export interface TrueLayerTransaction {
  transaction_id: string;
  timestamp: string;
  description: string;
  transaction_type: string;
  transaction_category: string;
  amount: number;
  currency: string;
  merchant_name?: string;
  meta: {
    bank_transaction_id?: string;
    provider_transaction_category?: string;
  };
}

export interface TrueLayerAccountsResponse {
  results: TrueLayerAccount[];
}

export interface TrueLayerBalanceResponse {
  results: TrueLayerBalance[];
}

export interface TrueLayerTransactionsResponse {
  results: TrueLayerTransaction[];
}

export interface EncryptedTokens {
  access_token: string;
  refresh_token?: string; // Optional for Monzo pre-verification apps
  expires_at: number;
  scope: string;
  provider: string;
  user_id: string;
  created_at: number;
  updated_at: number;
  deleted?: boolean;
  deleted_at?: number;
}
