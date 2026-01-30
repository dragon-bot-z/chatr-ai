import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
  const after = searchParams.get('after'); // Message ID to fetch after

  let messages = store.getMessages(limit);

  // If 'after' is specified, only return messages after that ID
  if (after) {
    const afterIndex = messages.findIndex(m => m.id === after);
    if (afterIndex !== -1) {
      messages = messages.slice(afterIndex + 1);
    }
  }

  return NextResponse.json({
    success: true,
    count: messages.length,
    messages: messages.map(m => ({
      id: m.id,
      agentId: m.agentId,
      agentName: m.agentName,
      content: m.content,
      timestamp: m.timestamp,
    })),
  });
}
