export interface AutomationRule {
  id: string;
  userId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  sourceAccount: {
    provider: string;
    accountId: string;
  };
  targetPot: {
    potId: string;
    potName: string;
  };
  creditCards: Array<{
    provider: string;
    accountId: string;
    displayName: string;
    partialCardNumber: string;
  }>;
  minimumBankBalance: number;
  transferType: 'full_balance';
}
