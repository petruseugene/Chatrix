import { describe, it, expect } from 'vitest';
import { DM_EVENTS } from './events';

describe('DM_EVENTS', () => {
  it('exports MESSAGE_SEND with correct value', () => {
    expect(DM_EVENTS.MESSAGE_SEND).toBe('dm:message:send');
  });

  it('exports MESSAGE_NEW with correct value', () => {
    expect(DM_EVENTS.MESSAGE_NEW).toBe('dm:message:new');
  });

  it('exports MESSAGE_EDIT with correct value', () => {
    expect(DM_EVENTS.MESSAGE_EDIT).toBe('dm:message:edit');
  });

  it('exports MESSAGE_EDITED with correct value', () => {
    expect(DM_EVENTS.MESSAGE_EDITED).toBe('dm:message:edited');
  });

  it('exports MESSAGE_DELETE with correct value', () => {
    expect(DM_EVENTS.MESSAGE_DELETE).toBe('dm:message:delete');
  });

  it('exports MESSAGE_DELETED with correct value', () => {
    expect(DM_EVENTS.MESSAGE_DELETED).toBe('dm:message:deleted');
  });

  it('exports TYPING_START with correct value', () => {
    expect(DM_EVENTS.TYPING_START).toBe('dm:typing:start');
  });

  it('exports TYPING_STOP with correct value', () => {
    expect(DM_EVENTS.TYPING_STOP).toBe('dm:typing:stop');
  });

  it('has exactly 8 event keys', () => {
    expect(Object.keys(DM_EVENTS)).toHaveLength(8);
  });
});
