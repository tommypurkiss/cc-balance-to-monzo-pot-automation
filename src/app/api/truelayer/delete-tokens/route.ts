import { NextRequest, NextResponse } from 'next/server';

// Dynamic import to prevent client bundling
let getAdminDb: () => any;

async function initFirebaseAdmin() {
  if (!getAdminDb) {
    const firebaseModule = await import('@/lib/firebase-admin');
    getAdminDb = firebaseModule.getAdminDb;
  }
  return getAdminDb;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, provider } = body;

    if (!user_id || !provider) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id and provider' },
        { status: 400 }
      );
    }

    // Find and soft delete the token document for this user/provider combination
    const getAdminDbFunc = await initFirebaseAdmin();
    const adminDb = getAdminDbFunc();
    const snapshot = await adminDb
      .collection('user_tokens')
      .where('user_id', '==', user_id)
      .where('provider', '==', provider)
      .where('deleted', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    // Soft delete the document by setting deleted flag
    await snapshot.docs[0].ref.update({
      deleted: true,
      deleted_at: Date.now(),
      updated_at: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error soft deleting tokens:', error);
    return NextResponse.json(
      { error: 'Failed to delete tokens' },
      { status: 500 }
    );
  }
}
