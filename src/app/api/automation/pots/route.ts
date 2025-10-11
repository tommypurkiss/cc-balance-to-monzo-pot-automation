import { NextRequest, NextResponse } from 'next/server';
import { getAllEncryptedTokensForUser, decryptTokens } from '@/lib/firestore';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user's encrypted tokens from Firestore
    const encryptedTokens = await getAllEncryptedTokensForUser(userId);

    if (!encryptedTokens || encryptedTokens.length === 0) {
      return NextResponse.json(
        { error: 'No tokens found for user' },
        { status: 404 }
      );
    }

    // Find Monzo token (direct API access)
    const monzoEncryptedToken = encryptedTokens.find(
      (token: any) => token.provider === 'monzo' && !token.deleted
    );

    if (!monzoEncryptedToken) {
      // Check if user has TrueLayer Monzo token but not direct Monzo token
      const hasTrueLayerMonzo = encryptedTokens.find(
        (token: any) => token.provider === 'ob-monzo' && !token.deleted
      );

      if (hasTrueLayerMonzo) {
        return NextResponse.json(
          {
            error:
              'Direct Monzo API access required for automation. Please connect your Monzo account with write access using the "Connect Monzo" button in Step 1.',
          },
          { status: 404 }
        );
      } else {
        return NextResponse.json(
          {
            error:
              'No Monzo account connected. Please connect your Monzo account first.',
          },
          { status: 404 }
        );
      }
    }

    // Decrypt the access token
    const decryptedToken = await decryptTokens(monzoEncryptedToken);
    const accessToken = decryptedToken.access_token;

    // First, get the user's Monzo accounts to find the current account ID
    const accountsResponse = await fetch('https://api.monzo.com/accounts', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      console.error(
        'Monzo accounts API error:',
        accountsResponse.status,
        errorText
      );
      return NextResponse.json(
        { error: `Failed to fetch Monzo accounts: ${errorText}` },
        { status: accountsResponse.status }
      );
    }

    const accountsData = await accountsResponse.json();
    const currentAccount = accountsData.accounts?.find(
      (account: any) => account.type === 'uk_retail' && account.closed === false
    );

    if (!currentAccount) {
      return NextResponse.json(
        { error: 'No active Monzo current account found' },
        { status: 404 }
      );
    }

    // Fetch pots from Monzo API with current_account_id
    const potsResponse = await fetch(
      `https://api.monzo.com/pots?current_account_id=${currentAccount.id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!potsResponse.ok) {
      const errorText = await potsResponse.text();
      console.error('Monzo pots API error:', potsResponse.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch pots from Monzo: ${errorText}` },
        { status: potsResponse.status }
      );
    }

    const potsData = await potsResponse.json();
    const pots = potsData.pots || [];

    // Filter out pots that are deleted, not accessible, or special challenge pots
    const availablePots = pots.filter(
      (pot: any) =>
        !pot.deleted &&
        pot.name !== '1p Saving Challenge' &&
        !pot.name.toLowerCase().includes('1p saving challenge')
    );

    // Format pots for frontend
    const formattedPots = availablePots.map((pot: any) => ({
      id: pot.id,
      name: pot.name,
      balance: pot.balance,
      currency: pot.currency,
      style: pot.style,
      type: pot.type,
      created: pot.created,
    }));

    return NextResponse.json({
      pots: formattedPots,
      count: formattedPots.length,
    });
  } catch (error) {
    console.error('Error fetching Monzo pots:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
