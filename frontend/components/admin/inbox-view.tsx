'use client';

import { useState } from 'react';
import { ChatList } from './chat-list';
import { ChatWindow } from './chat-window';
import { CitizenProfile } from './citizen-profile';
import { type Chat } from '@/lib/mock-data';

export function InboxView() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  return (
    <div className="flex h-full">
      {/* Column A: Chat list */}
      <div className="w-80 flex-shrink-0">
        <ChatList selectedId={selectedChat?.id ?? null} onSelect={setSelectedChat} />
      </div>

      {/* Column B: Chat window */}
      <ChatWindow chat={selectedChat} />

      {/* Column C: Citizen profile */}
      <CitizenProfile chat={selectedChat} />
    </div>
  );
}
