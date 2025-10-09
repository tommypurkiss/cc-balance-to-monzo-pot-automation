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
  console.log('MONZO API TESTING: OAuth initiation started');

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  console.log('MONZO API TESTING: User ID:', userId);

  if (!userId) {
    console.log('MONZO API TESTING: ERROR - No user ID provided');
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const clientId = process.env.MONZO_CLIENT_ID;
  const redirectUri = getMonzoRedirectUri();

  console.log('MONZO API TESTING: Client ID exists:', !!clientId);
  console.log('MONZO API TESTING: Redirect URI from env:', redirectUri);

  if (!clientId || !redirectUri) {
    console.log('MONZO API TESTING: ERROR - Missing credentials');
    return NextResponse.json(
      { error: 'Monzo credentials not configured' },
      { status: 500 }
    );
  }

  // Generate state token for CSRF protection
  const state = generateRandomState();
  const stateWithUserId = `${state}:${userId}`;

  console.log(
    'MONZO API TESTING: Generated state token:',
    state.substring(0, 10) + '...'
  );

  // Use the callback URL directly (like localhost)
  const redirectUriForMonzo = redirectUri;

  console.log('MONZO API TESTING: Callback URL:', redirectUriForMonzo);

  // Build Monzo authorization URL
  const authUrl = new URL('https://auth.monzo.com/');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('redirect_uri', redirectUriForMonzo);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('state', stateWithUserId);

  console.log('MONZO API TESTING: Redirecting to Monzo OAuth');
  console.log('MONZO API TESTING: Auth URL:', authUrl.toString());

  return NextResponse.redirect(authUrl.toString());
}
