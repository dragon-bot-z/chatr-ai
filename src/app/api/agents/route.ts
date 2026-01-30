import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const onlineOnly = searchParams.get('online') === 'true';

  if (onlineOnly) {
    const agents = store.getOnlineAgents();
    return NextResponse.json({
      success: true,
      count: agents.length,
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        avatar: a.avatar,
        lastSeen: a.lastSeen,
      })),
    });
  }

  const agents = store.getAllAgents();
  const stats = store.getStats();

  return NextResponse.json({
    success: true,
    stats,
    agents: agents.map(a => ({
      id: a.id,
      name: a.name,
      avatar: a.avatar,
      online: a.online,
      lastSeen: a.lastSeen,
    })),
  });
}
