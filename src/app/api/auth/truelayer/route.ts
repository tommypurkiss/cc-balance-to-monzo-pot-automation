import { NextRequest, NextResponse } from 'next/server';
import { getTrueLayerRedirectUri, getBaseUrl } from '@/lib/urls';

function generateRandomState(length: number = 32): string {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let state = '';
  for (let index = 0; index < length; index++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    state += charset[randomIndex];
  }
  return state;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider'); // Optional provider parameter
  const userId = searchParams.get('userId'); // User ID from authenticated user

  const clientId = process.env.TRUELAYER_CLIENT_ID;
  const clientSecret = process.env.TRUELAYER_CLIENT_SECRET;
  const redirectUri = getTrueLayerRedirectUri();

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      {
        error:
          'Missing TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET or TRUELAYER_REDIRECT_URI env var',
        instructions: {
          step1:
            'Go to https://console.truelayer.com/ and create a client application',
          step2: `Set redirect URI to: ${getBaseUrl()}/api/auth/truelayer/callback`,
          step3:
            'Create .env.local file with your TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET, and TRUELAYER_REDIRECT_URI',
          step4: 'Restart the dev server',
        },
      },
      { status: 500 }
    );
  }

  // Generate state that includes both random string and user ID
  const randomState = generateRandomState();
  const state = userId ? `${randomState}:${userId}` : randomState;

  const url = new URL('https://auth.truelayer.com/');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set(
    'scope',
    'info accounts balance transactions cards offline_access'
  );
  if (provider) {
    url.searchParams.set('providers', provider);
  }
  url.searchParams.set('state', state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set('truelayer_oauth_state', state, {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    path: '/',
    maxAge: 60 * 30, // 30 minutes
  });

  // Store the provider in the cookie for the callback (if specified)
  if (provider) {
    response.cookies.set('truelayer_provider', provider, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      path: '/',
      maxAge: 60 * 30, // 30 minutes
    });
  }

  return response;
}
