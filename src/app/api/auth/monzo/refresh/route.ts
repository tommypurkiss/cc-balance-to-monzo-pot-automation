import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

/**
 * Refresh Monzo access token using refresh token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refresh_token } = body;

    if (!refresh_token) {
      return NextResponse.json(
        { error: 'Missing refresh token' },
        { status: 400 }
      );
    }

    const clientId = process.env.MONZO_CLIENT_ID;
    const clientSecret = process.env.MONZO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Missing Monzo credentials in environment variables' },
        { status: 500 }
      );
    }

    const tokenData = {
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh_token,
    };

    const response = await axios.post(
      'https://api.monzo.com/oauth2/token',
      new URLSearchParams(tokenData),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const {
      access_token,
      refresh_token: new_refresh_token,
      expires_in,
    } = response.data;

    return NextResponse.json({
      access_token,
      refresh_token: new_refresh_token,
      expires_in,
      token_type: 'Bearer',
    });
  } catch (error: any) {
    console.error(
      'Monzo token refresh error:',
      error.response?.data || error.message
    );

    return NextResponse.json(
      {
        error: 'Token refresh failed',
        details: error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}
