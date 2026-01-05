export interface MonzoPot {
  id: string;
  name: string;
  balance: number;
  currency: string;
  style: Record<string, unknown>;
  type: string;
  created: string;
}
