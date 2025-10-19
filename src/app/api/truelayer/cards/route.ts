import { NextRequest, NextResponse } from 'next/server';
import {
  getAllEncryptedTokensForUser,
  decryptTokens,
  refreshTokens,
} from '@/lib/firestore';

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

    // Get all tokens from Firestore
    const allEncryptedTokens = await getAllEncryptedTokensForUser(userId);
    if (!allEncryptedTokens || allEncryptedTokens.length === 0) {
      return NextResponse.json(
        {
          error: 'No tokens found for user. Please connect TrueLayer first.',
        },
        { status: 404 }
      );
    }

    // Find the first available TrueLayer token (not Monzo)
    const truelayerToken = allEncryptedTokens.find(
      (token: any) => token.provider !== 'monzo' && !token.deleted
    );

    if (!truelayerToken) {
      return NextResponse.json(
        {
          error:
            'No TrueLayer tokens found. Please connect your bank accounts first.',
        },
        { status: 404 }
      );
    }

    // Check if tokens are expired and refresh if needed
    const { expires_at, refresh_token } = await decryptTokens(truelayerToken);
    let access_token: string;

    if (Date.now() >= expires_at) {
      if (refresh_token && refresh_token.trim() !== '') {
        const refreshedTokens = await refreshTokens(
          userId,
          truelayerToken.provider
        );
        const { access_token: newToken } = await decryptTokens(refreshedTokens);
        access_token = newToken;
      } else {
        return NextResponse.json(
          {
            error:
              'Access token expired and no refresh token available. Please reconnect your account.',
          },
          { status: 401 }
        );
      }
    } else {
      const { access_token: firestoreToken } =
        await decryptTokens(truelayerToken);
      access_token = firestoreToken;
    }

    // Fetch cards from TrueLayer (try cards endpoint first)
    const cardsResponse = await fetch(
      'https://api.truelayer.com/data/v1/cards',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!cardsResponse.ok) {
      const errorData = await cardsResponse.text();
      console.error('❌ Failed to fetch cards from TrueLayer:');
      console.error('Status:', cardsResponse.status, cardsResponse.statusText);
      console.error(
        'Headers:',
        Object.fromEntries(cardsResponse.headers.entries())
      );
      console.error('Error Data:', errorData);
      return NextResponse.json(
        { error: 'Failed to fetch cards from TrueLayer' },
        { status: cardsResponse.status }
      );
    }

    const cardsData = (await cardsResponse.json()) as { results?: any[] };
    const cards = cardsData.results || [];

    // Fetch balance for each card
    const cardsWithBalances = await Promise.all(
      cards.map(async (card: any): Promise<any> => {
        try {
          const balanceResponse = await fetch(
            `https://api.truelayer.com/data/v1/cards/${card.account_id}/balance`,
            {
              headers: {
                Authorization: `Bearer ${access_token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (balanceResponse.ok) {
            const balanceData = (await balanceResponse.json()) as {
              results?: any[];
            };
            return {
              ...card,
              balance: balanceData.results?.[0]?.available || 0,
              currency: balanceData.results?.[0]?.currency || 'GBP',
            };
          } else {
            console.error(
              `Failed to fetch balance for card ${(card as any).account_id}`
            );
            return {
              ...card,
              balance: null,
              currency: 'GBP',
            };
          }
        } catch (error) {
          console.error(
            `Error fetching balance for card ${(card as any).account_id}:`,
            error
          );
          return {
            ...card,
            balance: null,
            currency: 'GBP',
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      cards: cardsWithBalances,
    });
  } catch (error) {
    console.error('Error fetching cards:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
