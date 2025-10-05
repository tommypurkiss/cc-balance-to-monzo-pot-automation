import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

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

    const clientId = process.env.TRUELAYER_CLIENT_ID;
    const clientSecret = process.env.TRUELAYER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Missing TrueLayer credentials in environment variables' },
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
      'https://auth.truelayer.com/connect/token',
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
      'Token refresh error:',
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
