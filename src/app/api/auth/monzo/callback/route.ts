import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { encrypt } from '@/lib/encryptionService';
import { getMonzoRedirectUri } from '@/lib/urls';

interface MonzoTokenResponse {
  access_token: string;
  client_id: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
  user_id: string;
  scope?: string;
}

/**
 * Handle Monzo OAuth callback
 * Exchange authorization code for access token
 * This is now called from the frontend confirmation page, not directly from Monzo
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Missing authorization code or state' },
      { status: 400 }
    );
  }

  // Extract userId from state (format: "state:userId")
  const [, userId] = state.split(':');

  if (!userId) {
    return NextResponse.json(
      { error: 'Invalid state parameter' },
      { status: 400 }
    );
  }

  const clientId = process.env.MONZO_CLIENT_ID;
  const clientSecret = process.env.MONZO_CLIENT_SECRET;

  // Redirect URI for OAuth token exchange should be the callback URL
  const redirectUri = getMonzoRedirectUri();

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing Monzo configuration' },
      { status: 500 }
    );
  }

  try {
    const tokenResponse = await axios.post<MonzoTokenResponse>(
      'https://api.monzo.com/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const tokens = tokenResponse.data;

    // Check if access_token is present (refresh_token is optional for pre-verification apps)
    if (!tokens.access_token) {
      console.error('MONZO API TESTING: ❌ Missing access_token!');
      throw new Error('Missing access_token from Monzo response');
    }

    // Log if refresh_token is missing (expected for pre-verification apps)
    if (!tokens.refresh_token) {
      // No refresh_token (normal for pre-verification apps)
    }

    // Encrypt and store tokens in Firestore
    const encryptedTokens: {
      access_token: string;
      expires_at: number;
      scope: string;
      provider: string;
      user_id: string;
      monzo_user_id: string;
      created_at: number;
      updated_at: number;
      deleted: boolean;
      refresh_token?: string;
    } = {
      access_token: await encrypt(tokens.access_token),
      expires_at: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope || 'monzo-api-access',
      provider: 'monzo',
      user_id: userId,
      monzo_user_id: tokens.user_id,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted: false,
    };

    // Only encrypt and store refresh_token if it exists
    if (tokens.refresh_token) {
      encryptedTokens.refresh_token = await encrypt(tokens.refresh_token);
    }

    const { getAdminDb } = await import('@/lib/firebase-admin');
    const adminDb = getAdminDb();
    const existingSnapshot = await adminDb
      .collection('user_tokens')
      .where('user_id', '==', userId)
      .where('provider', '==', 'monzo')
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      // Update existing document
      const docId = existingSnapshot.docs[0].id;
      await adminDb
        .collection('user_tokens')
        .doc(docId)
        .update({
          ...encryptedTokens,
          created_at: existingSnapshot.docs[0].data().created_at,
          updated_at: Date.now(),
        });
    } else {
      // Create new document
      await adminDb.collection('user_tokens').add(encryptedTokens);
    }

    // Redirect to success page after successful token exchange
    const successUrl = new URL('/auth/monzo-confirm', request.url);
    successUrl.searchParams.append('success', 'true');
    successUrl.searchParams.append('userId', userId);

    return NextResponse.redirect(successUrl.toString());
  } catch (error: unknown) {
    console.error('MONZO API TESTING: ❌ ERROR in OAuth callback');

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = (
      error as { response?: { data?: unknown; status?: number } }
    )?.response;

    console.error(
      'MONZO API TESTING: Error details:',
      errorDetails?.data || errorMessage
    );
    console.error('MONZO API TESTING: Error status:', errorDetails?.status);

    return NextResponse.json(
      {
        error: 'Failed to complete authorization',
        details: errorDetails?.data || errorMessage,
      },
      { status: 500 }
    );
  }
}
