import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Helper function to create headers
function createHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'X-PSU-IP': '127.0.0.1',
    'X-Client-Correlation-Id': `proxy-${Date.now()}`,
  };
}

// Helper function to validate request parameters
function validateRequest(url: URL) {
  const token = url.searchParams.get('token');
  const endpoint = url.searchParams.get('endpoint');

  if (!token) {
    return {
      error: NextResponse.json(
        { error: 'Missing access token' },
        { status: 400 }
      ),
      token: null,
      endpoint: null,
    };
  }

  if (!endpoint) {
    return {
      error: NextResponse.json(
        { error: 'Missing endpoint parameter' },
        { status: 400 }
      ),
      token: null,
      endpoint: null,
    };
  }

  // Basic token format validation
  if (token.length < 10) {
    return {
      error: NextResponse.json(
        { error: 'Invalid token format - token too short' },
        { status: 400 }
      ),
      token: null,
      endpoint: null,
    };
  }

  return { error: null, token, endpoint };
}

// Helper function to handle errors
function handleError(error: unknown, method: string) {
  const errorObj = error as {
    message?: string;
    response?: {
      data?: unknown;
      status?: number;
    };
    config?: {
      url?: string;
      method?: string;
    };
  };

  console.error(`TrueLayer proxy ${method} error:`, {
    message: errorObj.message,
    response: errorObj.response?.data,
    status: errorObj.response?.status,
    config: {
      url: errorObj.config?.url,
      method: errorObj.config?.method,
    },
  });

  return NextResponse.json(
    {
      error: 'Failed to fetch data',
      details: errorObj.response?.data || errorObj.message,
      method,
    },
    { status: errorObj.response?.status || 500 }
  );
}

export async function GET(request: NextRequest) {
  console.log('TrueLayer proxy GET request received');

  const url = new URL(request.url);
  const validation = validateRequest(url);

  if (validation.error) {
    return validation.error;
  }

  const { token, endpoint } = validation;

  try {
    console.log(`Making GET request to: https://api.truelayer.com${endpoint}`);
    console.log(`Token (first 50 chars): ${token!.substring(0, 50)}...`);

    const response = await axios.get(`https://api.truelayer.com${endpoint}`, {
      headers: createHeaders(token!),
    });

    console.log(`GET request successful, status: ${response.status}`);
    return NextResponse.json(response.data);
  } catch (error: unknown) {
    const errorObj = error as {
      response?: {
        status?: number;
        data?: unknown;
      };
      config?: {
        headers?: Record<string, string>;
      };
    };

    // Enhanced error logging for 401 errors
    if (errorObj.response?.status === 401) {
      console.error('401 Unauthorized - Token may be invalid or expired:', {
        endpoint,
        tokenPreview: token!.substring(0, 50) + '...',
        errorDetails: errorObj.response?.data,
        headers: errorObj.config?.headers,
      });
    }
    return handleError(error, 'GET');
  }
}

export async function POST(request: NextRequest) {
  console.log('TrueLayer proxy POST request received');

  const url = new URL(request.url);
  const validation = validateRequest(url);

  if (validation.error) {
    return validation.error;
  }

  const { token, endpoint } = validation;

  try {
    const body = (await request.json()) as unknown;
    console.log(`Making POST request to: https://api.truelayer.com${endpoint}`);

    const response = await axios.post(
      `https://api.truelayer.com${endpoint}`,
      body,
      {
        headers: createHeaders(token!),
      }
    );

    console.log(`POST request successful, status: ${response.status}`);
    return NextResponse.json(response.data);
  } catch (error: unknown) {
    return handleError(error, 'POST');
  }
}

export async function PUT(request: NextRequest) {
  console.log('TrueLayer proxy PUT request received');

  const url = new URL(request.url);
  const validation = validateRequest(url);

  if (validation.error) {
    return validation.error;
  }

  const { token, endpoint } = validation;

  try {
    const body = (await request.json()) as unknown;
    console.log(`Making PUT request to: https://api.truelayer.com${endpoint}`);

    const response = await axios.put(
      `https://api.truelayer.com${endpoint}`,
      body,
      {
        headers: createHeaders(token!),
      }
    );

    console.log(`PUT request successful, status: ${response.status}`);
    return NextResponse.json(response.data);
  } catch (error: unknown) {
    return handleError(error, 'PUT');
  }
}

export async function DELETE(request: NextRequest) {
  console.log('TrueLayer proxy DELETE request received');

  const url = new URL(request.url);
  const validation = validateRequest(url);

  if (validation.error) {
    return validation.error;
  }

  const { token, endpoint } = validation;

  try {
    console.log(
      `Making DELETE request to: https://api.truelayer.com${endpoint}`
    );

    const response = await axios.delete(
      `https://api.truelayer.com${endpoint}`,
      {
        headers: createHeaders(token!),
      }
    );

    console.log(`DELETE request successful, status: ${response.status}`);
    return NextResponse.json(response.data);
  } catch (error: unknown) {
    return handleError(error, 'DELETE');
  }
}

// Handle unsupported methods
export async function OPTIONS() {
  console.log('TrueLayer proxy OPTIONS request received');
  return new NextResponse(null, { status: 200 });
}
