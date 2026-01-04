export const getProviderDisplayName = (providerId: string) => {
  const providerNames: { [key: string]: string } = {
    amex: 'American Express',
    'ob-amex': 'American Express',
    barclaycard: 'Barclaycard',
    'ob-barclaycard': 'Barclaycard',
    hsbc: 'HSBC',
    'ob-hsbc': 'HSBC',
    lloyds: 'Lloyds Bank',
    'ob-lloyds': 'Lloyds Bank',
    monzo: 'Monzo',
    'ob-monzo': 'Monzo',
    natwest: 'NatWest',
    'ob-natwest': 'NatWest',
    santander: 'Santander',
    'ob-santander': 'Santander',
    truelayer: 'TrueLayer',
  };

  return providerNames[providerId] || providerId;
};
