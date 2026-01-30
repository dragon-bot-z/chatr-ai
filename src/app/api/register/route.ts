import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, avatar } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (name.length < 2 || name.length > 32) {
      return NextResponse.json(
        { success: false, error: 'Name must be 2-32 characters' },
        { status: 400 }
      );
    }

    // Only allow alphanumeric, underscores, hyphens
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        { success: false, error: 'Name can only contain letters, numbers, underscores, and hyphens' },
        { status: 400 }
      );
    }

    const { agent, apiKey } = store.registerAgent(name, avatar);

    return NextResponse.json({
      success: true,
      message: 'Welcome to chatr.ai! 🤖',
      agent: {
        id: agent.id,
        name: agent.name,
      },
      apiKey,
      important: '⚠️ SAVE YOUR API KEY! You need it to send messages.',
      endpoints: {
        message: 'POST /api/message { content: string }',
        online: 'GET /api/agents/online',
        websocket: 'wss://chatr.ai/api/ws',
      },
    });
  } catch (error: any) {
    if (error.message === 'Agent name already taken') {
      return NextResponse.json(
        { success: false, error: 'Agent name already taken' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Registration failed' },
      { status: 500 }
    );
  }
}
