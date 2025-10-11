import { NextRequest, NextResponse } from 'next/server';
import { getMonzoRedirectUri } from '@/lib/urls';
import crypto from 'crypto';

function generateRandomState(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Initiate Monzo OAuth flow
 * Redirects user to Monzo authorization page
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const clientId = process.env.MONZO_CLIENT_ID;
  const redirectUri = getMonzoRedirectUri();

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Monzo credentials not configured' },
      { status: 500 }
    );
  }

  // Generate state token for CSRF protection
  const state = generateRandomState();
  const stateWithUserId = `${state}:${userId}`;

  // Use the callback URL directly (like localhost)
  const redirectUriForMonzo = redirectUri;

  // Build Monzo authorization URL
  const authUrl = new URL('https://auth.monzo.com/');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('redirect_uri', redirectUriForMonzo);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('state', stateWithUserId);

  return NextResponse.redirect(authUrl.toString());
}
