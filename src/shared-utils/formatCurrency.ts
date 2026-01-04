export const formatCurrency = (
  amount: number,
  currency: string,
  isMonzo: boolean = false
) => {
  // Monzo API returns amounts in pennies (minor units), so divide by 100
  const displayAmount = isMonzo ? amount / 100 : amount;

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency,
  }).format(displayAmount);
};
