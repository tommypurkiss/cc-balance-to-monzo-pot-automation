import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { storeEncryptedTokens } from '@/lib/firestore';
import { getTrueLayerRedirectUri } from '@/lib/urls';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Retrieve the stored state and provider from cookies
  const storedState = request.cookies.get('truelayer_oauth_state')?.value;
  const provider =
    request.cookies.get('truelayer_provider')?.value || 'truelayer';

  // Extract user ID from state parameter (format: "randomState:userId")
  const userId = state?.includes(':') ? state.split(':')[1] : null;

  console.log('🔍 TrueLayer OAuth Callback - URL:', request.url);
  console.log('🔍 Callback parameters:', {
    code: code?.substring(0, 20) + '...',
    state,
    error,
    errorDescription,
  });

  if (error) {
    console.error('❌ TrueLayer authorization error:', error, errorDescription);
    const redirectUrl = new URL('/oauth-callback', request.url);
    redirectUrl.searchParams.set('truelayer_error', 'true');
    redirectUrl.searchParams.set('error_message', errorDescription || error);
    redirectUrl.searchParams.set('provider', provider);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    console.error('❌ No authorization code received from TrueLayer.');
    const redirectUrl = new URL('/oauth-callback', request.url);
    redirectUrl.searchParams.set('truelayer_error', 'true');
    redirectUrl.searchParams.set(
      'error_message',
      'No authorization code received.'
    );
    redirectUrl.searchParams.set('provider', provider);
    return NextResponse.redirect(redirectUrl);
  }

  // Validate state parameter (extract random part for comparison)
  const randomStatePart = state?.includes(':') ? state.split(':')[0] : state;
  const storedRandomStatePart = storedState?.includes(':')
    ? storedState.split(':')[0]
    : storedState;

  if (!state || !storedState || randomStatePart !== storedRandomStatePart) {
    console.error('❌ State mismatch during TrueLayer OAuth callback.');
    const redirectUrl = new URL('/oauth-callback', request.url);
    redirectUrl.searchParams.set('truelayer_error', 'true');
    redirectUrl.searchParams.set(
      'error_message',
      'State mismatch. Possible CSRF attack.'
    );
    redirectUrl.searchParams.set('provider', provider);
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const clientId = process.env.TRUELAYER_CLIENT_ID;
    const clientSecret = process.env.TRUELAYER_CLIENT_SECRET;
    const redirectUri = getTrueLayerRedirectUri();

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'TrueLayer credentials not configured in environment variables.'
      );
    }

    console.log('🔄 Exchanging authorization code for tokens...');
    console.log('🔄 Using client ID:', clientId);
    console.log('🔄 Using redirect URI:', redirectUri);

    // Exchange authorization code for access token
    const tokenResponse = await axios.post<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    }>(
      'https://auth.truelayer.com/connect/token',
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

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Calculate expiration timestamp
    const expiresAt = Date.now() + expires_in * 1000;

    // Get the actual provider from user info
    let actualProvider = provider;
    try {
      interface UserInfoResponse {
        results?: Array<{
          provider?: {
            provider_id?: string;
          };
        }>;
      }

      const userInfoResponse = await axios.get<UserInfoResponse>(
        'https://api.truelayer.com/data/v1/me',
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );

      if (
        userInfoResponse.data?.results &&
        Array.isArray(userInfoResponse.data.results) &&
        userInfoResponse.data.results[0]
      ) {
        const userInfo = userInfoResponse.data.results[0];
        if (userInfo?.provider?.provider_id) {
          actualProvider = userInfo.provider.provider_id;
        }
      }
    } catch (err) {
      console.log('Could not fetch user info to determine provider:', err);
    }

    console.log('✅ Tokens received successfully:', {
      access_token: access_token.substring(0, 20) + '...',
      expires_in,
      refresh_token: refresh_token
        ? refresh_token.substring(0, 20) + '...'
        : 'NOT_PROVIDED',
      actualProvider,
    });

    // Store tokens in Firestore (secure, persistent storage)
    try {
      if (!userId) {
        console.warn(
          '⚠️ No user ID provided - tokens will not be stored persistently'
        );
        // Still continue with the flow, but tokens won't be stored in Firestore
      } else {
        console.log('✅ Using user ID from query params:', userId);

        await storeEncryptedTokens(
          {
            access_token,
            refresh_token: refresh_token || '',
            expires_in,
            token_type: 'Bearer',
            scope: 'info accounts balance transactions cards offline_access',
          },
          userId,
          actualProvider
        );
      }

      console.log('✅ Tokens stored securely in Firestore');
    } catch (error) {
      console.warn('⚠️ Failed to store tokens in Firestore:', error);
      // Continue anyway - tokens will be available via URL params for localStorage fallback
    }

    // Redirect with success
    const redirectUrl = new URL('/oauth-callback', request.url);
    redirectUrl.searchParams.set('truelayer_success', 'true');
    redirectUrl.searchParams.set('provider', actualProvider);
    redirectUrl.searchParams.set('access_token', access_token);
    redirectUrl.searchParams.set('refresh_token', refresh_token);
    redirectUrl.searchParams.set('expires_in', String(expires_in));
    redirectUrl.searchParams.set('expires_at', String(expiresAt));

    return NextResponse.redirect(redirectUrl);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = (
      error as { response?: { data?: { error_description?: string } } }
    )?.response?.data;
    console.error(
      '❌ Token exchange or callback processing error:',
      errorDetails || errorMessage
    );
    const redirectUrl = new URL('/oauth-callback', request.url);
    redirectUrl.searchParams.set('truelayer_error', 'true');
    redirectUrl.searchParams.set(
      'error_message',
      errorDetails?.error_description || errorMessage
    );
    redirectUrl.searchParams.set('provider', provider);
    return NextResponse.redirect(redirectUrl);
  } finally {
    // Clear the state and provider cookies
    const response = NextResponse.next();
    response.cookies.set('truelayer_oauth_state', '', { maxAge: 0 });
    response.cookies.set('truelayer_provider', '', { maxAge: 0 });
  }
}
