import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export interface AutomationRule {
  id: string;
  userId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Transfer Configuration
  sourceAccount: {
    provider: string; // 'monzo' for direct Monzo API
    accountId: string; // Monzo main account ID
  };

  targetPot: {
    potId: string; // Monzo pot ID
    potName: string; // For display purposes
  };

  // Credit Cards to Monitor
  creditCards: Array<{
    provider: string; // 'ob-amex', 'ob-barclaycard', etc.
    accountId: string; // TrueLayer account ID
    displayName: string; // For display
    partialCardNumber: string; // For display
  }>;

  // Safety Settings
  minimumBankBalance: number; // Don't transfer if bank balance <= this amount (in pence)

  // Transfer Logic
  transferType: 'full_balance'; // For now, only full balance
}

// GET - Fetch user's automation rules
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const automationRef = db.collection('automation_rules').doc(userId);
    const automationDoc = await automationRef.get();

    if (!automationDoc.exists) {
      return NextResponse.json({
        rules: [],
        count: 0,
      });
    }

    const automationData = automationDoc.data();
    const rules = automationData?.rules || [];

    return NextResponse.json({
      rules,
      count: rules.length,
    });
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create or update automation rule
// export async function POST(request: NextRequest): Promise<NextResponse> {
//   try {
//     const body = await request.json();
//     const {
//       userId,
//       sourceAccount,
//       targetPot,
//       creditCards,
//       minimumBankBalance,
//     } = body;

//     if (
//       !userId ||
//       !sourceAccount ||
//       !targetPot ||
//       !creditCards ||
//       minimumBankBalance === undefined
//     ) {
//       return NextResponse.json(
//         { error: 'Missing required fields' },
//         { status: 400 }
//       );
//     }

//     // Validate minimum bank balance (should be positive number in pence)
//     if (typeof minimumBankBalance !== 'number' || minimumBankBalance < 0) {
//       return NextResponse.json(
//         { error: 'Minimum bank balance must be a positive number' },
//         { status: 400 }
//       );
//     }

//     // Validate credit cards array
//     if (!Array.isArray(creditCards) || creditCards.length === 0) {
//       return NextResponse.json(
//         { error: 'At least one credit card must be selected' },
//         { status: 400 }
//       );
//     }

//     const db = getAdminDb();
//     const automationRef = db.collection('automation_rules').doc(userId);

//     // Create the automation rule
//     const automationRule: AutomationRule = {
//       id: `rule_${Date.now()}`,
//       userId,
//       isActive: true,
//       createdAt: new Date(),
//       updatedAt: new Date(),
//       sourceAccount,
//       targetPot,
//       creditCards,
//       minimumBankBalance,
//       transferType: 'full_balance',
//     };

//     // For now, we'll store one rule per user (can be extended later)
//     await automationRef.set({
//       rules: [automationRule],
//       updatedAt: new Date(),
//     });

//     return NextResponse.json({
//       success: true,
//       rule: automationRule,
//     });
//   } catch (error) {
//     console.error('Error creating automation rule:', error);
//     return NextResponse.json(
//       { error: 'Internal server error' },
//       { status: 500 }
//     );
//   }
// }
// POST - Create or update automation rule
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      userId,
      ruleId, // Add this to check if we're editing
      sourceAccount,
      targetPot,
      creditCards,
      minimumBankBalance,
    } = body;

    if (
      !userId ||
      !sourceAccount ||
      !targetPot ||
      !creditCards ||
      minimumBankBalance === undefined
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate minimum bank balance (should be positive number in pence)
    if (typeof minimumBankBalance !== 'number' || minimumBankBalance < 0) {
      return NextResponse.json(
        { error: 'Minimum bank balance must be a positive number' },
        { status: 400 }
      );
    }

    // Validate credit cards array
    if (!Array.isArray(creditCards) || creditCards.length === 0) {
      return NextResponse.json(
        { error: 'At least one credit card must be selected' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const automationRef = db.collection('automation_rules').doc(userId);
    const automationDoc = await automationRef.get();

    let rules: AutomationRule[] = [];

    if (automationDoc.exists) {
      const automationData = automationDoc.data();
      rules = automationData?.rules || [];
    }

    if (ruleId) {
      // UPDATE existing rule
      const ruleIndex = rules.findIndex((rule) => rule.id === ruleId);

      if (ruleIndex === -1) {
        return NextResponse.json(
          { error: 'Automation rule not found' },
          { status: 404 }
        );
      }

      // Update the existing rule
      rules[ruleIndex] = {
        ...rules[ruleIndex],
        sourceAccount,
        targetPot,
        creditCards,
        minimumBankBalance,
        updatedAt: new Date(),
      };

      await automationRef.set({
        rules,
        updatedAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        rule: rules[ruleIndex],
      });
    } else {
      // CREATE new rule
      const newRule: AutomationRule = {
        id: `rule_${Date.now()}`,
        userId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceAccount,
        targetPot,
        creditCards,
        minimumBankBalance,
        transferType: 'full_balance',
      };

      // Add new rule to existing rules array
      rules.push(newRule);

      await automationRef.set({
        rules,
        updatedAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        rule: newRule,
      });
    }
  } catch (error) {
    console.error('Error creating/updating automation rule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update automation rule
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { userId, ruleId, updates } = body;

    if (!userId || !ruleId || !updates) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const automationRef = db.collection('automation_rules').doc(userId);
    const automationDoc = await automationRef.get();

    if (!automationDoc.exists) {
      return NextResponse.json(
        { error: 'No automation rules found for user' },
        { status: 404 }
      );
    }

    const automationData = automationDoc.data();
    const rules = automationData?.rules || [];

    const ruleIndex = rules.findIndex(
      (rule: AutomationRule) => rule.id === ruleId
    );
    if (ruleIndex === -1) {
      return NextResponse.json(
        { error: 'Automation rule not found' },
        { status: 404 }
      );
    }

    // Update the rule
    rules[ruleIndex] = {
      ...rules[ruleIndex],
      ...updates,
      updatedAt: new Date(),
    };

    await automationRef.update({
      rules,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      rule: rules[ruleIndex],
    });
  } catch (error) {
    console.error('Error updating automation rule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete automation rule
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const ruleId = searchParams.get('ruleId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const automationRef = db.collection('automation_rules').doc(userId);
    const automationDoc = await automationRef.get();

    if (!automationDoc.exists) {
      return NextResponse.json(
        { error: 'No automation rules found for user' },
        { status: 404 }
      );
    }

    if (ruleId) {
      // Delete specific rule
      const automationData = automationDoc.data();
      const rules = automationData?.rules || [];

      const filteredRules = rules.filter(
        (rule: AutomationRule) => rule.id !== ruleId
      );

      if (filteredRules.length === rules.length) {
        return NextResponse.json(
          { error: 'Automation rule not found' },
          { status: 404 }
        );
      }

      await automationRef.update({
        rules: filteredRules,
        updatedAt: new Date(),
      });
    } else {
      // Delete all rules for user
      await automationRef.delete();
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting automation rule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
