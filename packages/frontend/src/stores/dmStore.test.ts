import { describe, it, expect, beforeEach } from 'vitest';
import { useDmStore } from './dmStore';

describe('dmStore', () => {
  beforeEach(() => {
    useDmStore.setState({ activeThreadId: null, socketConnected: false });
  });

  it('has null activeThreadId in initial state', () => {
    const { activeThreadId } = useDmStore.getState();
    expect(activeThreadId).toBeNull();
  });

  it('has socketConnected false in initial state', () => {
    const { socketConnected } = useDmStore.getState();
    expect(socketConnected).toBe(false);
  });

  it('setActiveThread updates activeThreadId', () => {
    useDmStore.getState().setActiveThread('thread-1');
    expect(useDmStore.getState().activeThreadId).toBe('thread-1');
  });

  it('setActiveThread accepts null to clear active thread', () => {
    useDmStore.getState().setActiveThread('thread-1');
    useDmStore.getState().setActiveThread(null);
    expect(useDmStore.getState().activeThreadId).toBeNull();
  });

  it('setSocketConnected updates socketConnected to true', () => {
    useDmStore.getState().setSocketConnected(true);
    expect(useDmStore.getState().socketConnected).toBe(true);
  });

  it('setSocketConnected updates socketConnected to false', () => {
    useDmStore.getState().setSocketConnected(true);
    useDmStore.getState().setSocketConnected(false);
    expect(useDmStore.getState().socketConnected).toBe(false);
  });
});
