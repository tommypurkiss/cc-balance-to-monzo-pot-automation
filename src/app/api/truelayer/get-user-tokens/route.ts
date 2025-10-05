import { NextRequest, NextResponse } from 'next/server';
import { getAllEncryptedTokensForUser, decryptTokens } from '@/lib/firestore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('userId');

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    // Get all encrypted tokens for the user
    const encryptedTokens = await getAllEncryptedTokensForUser(user_id);

    // Decrypt the tokens
    const decryptedTokens = await Promise.all(
      encryptedTokens.map(async (encryptedToken) => {
        const decrypted = await decryptTokens(encryptedToken);
        return {
          provider: encryptedToken.provider,
          access_token: decrypted.access_token,
          refresh_token: decrypted.refresh_token,
          expires_at: decrypted.expires_at,
          created_at: encryptedToken.created_at,
          deleted: encryptedToken.deleted,
        };
      })
    );

    return NextResponse.json(decryptedTokens);
  } catch (error) {
    console.error('Error retrieving user tokens:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve user tokens' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing required field: user_id' },
        { status: 400 }
      );
    }

    // Get all encrypted tokens for the user
    const encryptedTokens = await getAllEncryptedTokensForUser(user_id);

    // Decrypt the tokens
    const decryptedTokens = await Promise.all(
      encryptedTokens.map(async (encryptedToken) => {
        const decrypted = await decryptTokens(encryptedToken);
        return {
          provider: encryptedToken.provider,
          access_token: decrypted.access_token,
          refresh_token: decrypted.refresh_token,
          expires_at: decrypted.expires_at,
          created_at: encryptedToken.created_at,
        };
      })
    );

    return NextResponse.json(decryptedTokens);
  } catch (error) {
    console.error('Error retrieving user tokens:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve user tokens' },
      { status: 500 }
    );
  }
}
