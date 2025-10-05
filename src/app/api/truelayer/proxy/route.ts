import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const endpoint = url.searchParams.get('endpoint');

  if (!token) {
    return NextResponse.json(
      { error: 'Missing access token' },
      { status: 400 }
    );
  }

  if (!endpoint) {
    return NextResponse.json(
      { error: 'Missing endpoint parameter' },
      { status: 400 }
    );
  }

  try {
    const response = await axios.get(`https://api.truelayer.com${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'X-PSU-IP': '127.0.0.1',
        'X-Client-Correlation-Id': `proxy-${Date.now()}`,
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error(
      'TrueLayer proxy error:',
      error.response?.data || error.message
    );

    return NextResponse.json(
      {
        error: 'Failed to fetch data',
        details: error.response?.data || error.message,
      },
      { status: error.response?.status || 500 }
    );
  }
}
