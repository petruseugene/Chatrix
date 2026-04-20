import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from './chatStore';

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.setState({ activeView: null });
  });

  it('has null activeView in initial state', () => {
    const { activeView } = useChatStore.getState();
    expect(activeView).toBeNull();
  });

  it('setActiveDm sets activeView to dm type with given threadId', () => {
    useChatStore.getState().setActiveDm('thread-42');
    const { activeView } = useChatStore.getState();
    expect(activeView).toEqual({ type: 'dm', threadId: 'thread-42' });
  });

  it('setActiveRoom sets activeView to room type with given roomId', () => {
    useChatStore.getState().setActiveRoom('room-99');
    const { activeView } = useChatStore.getState();
    expect(activeView).toEqual({ type: 'room', roomId: 'room-99' });
  });

  it('clearActive resets activeView to null', () => {
    useChatStore.getState().setActiveRoom('room-99');
    useChatStore.getState().clearActive();
    const { activeView } = useChatStore.getState();
    expect(activeView).toBeNull();
  });

  it('setActiveDm overwrites a previously active room', () => {
    useChatStore.getState().setActiveRoom('room-1');
    useChatStore.getState().setActiveDm('thread-2');
    const { activeView } = useChatStore.getState();
    expect(activeView).toEqual({ type: 'dm', threadId: 'thread-2' });
  });

  it('setActiveRoom overwrites a previously active dm', () => {
    useChatStore.getState().setActiveDm('thread-1');
    useChatStore.getState().setActiveRoom('room-2');
    const { activeView } = useChatStore.getState();
    expect(activeView).toEqual({ type: 'room', roomId: 'room-2' });
  });
});
