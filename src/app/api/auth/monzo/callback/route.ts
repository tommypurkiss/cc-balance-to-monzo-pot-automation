import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { encrypt } from '@/lib/encryptionService';
import { getAdminDb } from '@/lib/firebase-admin';

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
  console.log('MONZO API TESTING: Callback route hit');

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  console.log('MONZO API TESTING: Code exists:', !!code);
  console.log('MONZO API TESTING: State exists:', !!state);
  console.log(
    'MONZO API TESTING: Code (first 20 chars):',
    code?.substring(0, 20) + '...'
  );

  if (!code || !state) {
    console.log('MONZO API TESTING: ERROR - Missing code or state');
    return NextResponse.json(
      { error: 'Missing authorization code or state' },
      { status: 400 }
    );
  }

  console.log('MONZO API TESTING: Processing OAuth callback...');

  // Extract userId from state (format: "state:userId")
  const [, userId] = state.split(':');
  console.log('MONZO API TESTING: Extracted user ID:', userId);

  if (!userId) {
    console.log('MONZO API TESTING: ERROR - Invalid state format');
    return NextResponse.json(
      { error: 'Invalid state parameter' },
      { status: 400 }
    );
  }

  const clientId = process.env.MONZO_CLIENT_ID;
  const clientSecret = process.env.MONZO_CLIENT_SECRET;

  // Redirect URI is our confirmation page
  const confirmPageUrl = new URL('/auth/monzo-confirm', request.url);
  const redirectUri = confirmPageUrl.toString();

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing Monzo configuration' },
      { status: 500 }
    );
  }

  try {
    console.log('MONZO API TESTING: Starting token exchange...');
    console.log(
      'MONZO API TESTING: Client ID:',
      clientId?.substring(0, 10) + '...'
    );
    console.log('MONZO API TESTING: Redirect URI:', redirectUri);

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
    console.log('MONZO API TESTING: ✅ Token exchange successful');
    console.log(
      'MONZO API TESTING: Full token response:',
      JSON.stringify(tokens, null, 2)
    );
    console.log(
      'MONZO API TESTING: Access token received:',
      !!tokens.access_token
    );
    console.log(
      'MONZO API TESTING: Refresh token received:',
      !!tokens.refresh_token
    );
    console.log('MONZO API TESTING: Expires in:', tokens.expires_in, 'seconds');
    console.log('MONZO API TESTING: Monzo user ID:', tokens.user_id);

    // Check if access_token is present (refresh_token is optional for pre-verification apps)
    if (!tokens.access_token) {
      console.error('MONZO API TESTING: ❌ Missing access_token!');
      throw new Error('Missing access_token from Monzo response');
    }

    // Log if refresh_token is missing (expected for pre-verification apps)
    if (!tokens.refresh_token) {
      console.log(
        'MONZO API TESTING: ⚠️ No refresh_token (normal for pre-verification apps)'
      );
      console.log(
        'MONZO API TESTING: Token will expire in:',
        tokens.expires_in / 3600,
        'hours'
      );
    }

    console.log('MONZO API TESTING: Encrypting tokens...');
    console.log(
      `🔍 FRONTEND MONZO ENCRYPTION DEBUG: Access token length: ${tokens.access_token.length}`
    );
    console.log(
      `🔍 FRONTEND MONZO ENCRYPTION DEBUG: Access token first 50 chars: ${tokens.access_token.substring(0, 50)}...`
    );

    // Encrypt and store tokens in Firestore
    const encryptedTokens: any = {
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

    console.log(
      `🔍 FRONTEND MONZO ENCRYPTION DEBUG: Encrypted access token length: ${encryptedTokens.access_token.length}`
    );
    console.log(
      `🔍 FRONTEND MONZO ENCRYPTION DEBUG: Encrypted access token first 50 chars: ${encryptedTokens.access_token.substring(0, 50)}...`
    );

    // Only encrypt and store refresh_token if it exists
    if (tokens.refresh_token) {
      encryptedTokens.refresh_token = await encrypt(tokens.refresh_token);
      console.log('MONZO API TESTING: Refresh token included');
    }

    console.log('MONZO API TESTING: Storing tokens in Firestore...');

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
      console.log('MONZO API TESTING: Found existing tokens, updating...');
      await adminDb
        .collection('user_tokens')
        .doc(docId)
        .update({
          ...encryptedTokens,
          created_at: existingSnapshot.docs[0].data().created_at,
          updated_at: Date.now(),
        });
      console.log(
        'MONZO API TESTING: ✅ Updated existing Monzo tokens in Firestore'
      );
    } else {
      // Create new document
      console.log('MONZO API TESTING: No existing tokens, creating new...');
      await adminDb.collection('user_tokens').add(encryptedTokens);
      console.log('MONZO API TESTING: ✅ Stored new Monzo tokens in Firestore');
    }

    console.log('MONZO API TESTING: ✅ OAuth flow completed successfully!');

    // Return success - the frontend will handle redirect
    return NextResponse.json({
      success: true,
      message: 'Monzo automation enabled successfully',
    });
  } catch (error: any) {
    console.error('MONZO API TESTING: ❌ ERROR in OAuth callback');
    console.error(
      'MONZO API TESTING: Error details:',
      error.response?.data || error.message
    );
    console.error('MONZO API TESTING: Error status:', error.response?.status);

    return NextResponse.json(
      {
        error: 'Failed to complete authorization',
        details: error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}
