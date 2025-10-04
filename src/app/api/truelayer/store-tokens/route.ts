import { NextRequest, NextResponse } from 'next/server';
import { storeEncryptedTokens } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      access_token,
      refresh_token,
      expires_in,
      token_type,
      scope,
      user_id,
    } = body;

    if (!access_token || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: access_token and user_id' },
        { status: 400 }
      );
    }

    // Store tokens in Firestore
    await storeEncryptedTokens(
      {
        access_token,
        refresh_token: refresh_token || '',
        expires_in,
        token_type: token_type || 'Bearer',
        scope:
          scope || 'info accounts balance transactions cards offline_access',
      },
      user_id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error storing tokens:', error);
    return NextResponse.json(
      { error: 'Failed to store tokens' },
      { status: 500 }
    );
  }
}
