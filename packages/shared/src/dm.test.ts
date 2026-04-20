import { describe, it, expect } from 'vitest';
import { sendDmSchema, editDmSchema, dmCursorSchema, sendFriendRequestSchema } from './dm';

describe('sendDmSchema', () => {
  it('accepts valid payload', () => {
    const result = sendDmSchema.safeParse({
      recipientId: 'clxxxxxxxxxxxxxxxxxxxxxx01',
      content: 'Hello!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing recipientId', () => {
    const result = sendDmSchema.safeParse({ content: 'Hello!' });
    expect(result.success).toBe(false);
  });

  it('rejects empty content', () => {
    const result = sendDmSchema.safeParse({
      recipientId: 'clxxxxxxxxxxxxxxxxxxxxxx01',
      content: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects content exceeding 3072 characters', () => {
    const result = sendDmSchema.safeParse({
      recipientId: 'clxxxxxxxxxxxxxxxxxxxxxx01',
      content: 'a'.repeat(3073),
    });
    expect(result.success).toBe(false);
  });

  it('accepts content of exactly 3072 characters', () => {
    const result = sendDmSchema.safeParse({
      recipientId: 'clxxxxxxxxxxxxxxxxxxxxxx01',
      content: 'a'.repeat(3072),
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional replyToId', () => {
    const result = sendDmSchema.safeParse({
      recipientId: 'clxxxxxxxxxxxxxxxxxxxxxx01',
      content: 'Hello!',
      replyToId: 'clxxxxxxxxxxxxxxxxxxxxxx02',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid cuid for recipientId', () => {
    const result = sendDmSchema.safeParse({
      recipientId: 'not-a-cuid!!!',
      content: 'Hello!',
    });
    expect(result.success).toBe(false);
  });
});

describe('editDmSchema', () => {
  it('accepts valid content', () => {
    const result = editDmSchema.safeParse({ content: 'Updated message' });
    expect(result.success).toBe(true);
  });

  it('rejects empty content', () => {
    const result = editDmSchema.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });

  it('rejects content exceeding 3072 characters', () => {
    const result = editDmSchema.safeParse({ content: 'b'.repeat(3073) });
    expect(result.success).toBe(false);
  });

  it('accepts content of exactly 3072 characters', () => {
    const result = editDmSchema.safeParse({ content: 'b'.repeat(3072) });
    expect(result.success).toBe(true);
  });
});

describe('dmCursorSchema', () => {
  it('uses default limit of 50 when omitted', () => {
    const result = dmCursorSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it('accepts valid limit within range', () => {
    const result = dmCursorSchema.safeParse({ limit: 25 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
    }
  });

  it('rejects limit of 0', () => {
    const result = dmCursorSchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects limit exceeding 50', () => {
    const result = dmCursorSchema.safeParse({ limit: 51 });
    expect(result.success).toBe(false);
  });

  it('coerces string limit to number', () => {
    const result = dmCursorSchema.safeParse({ limit: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
    }
  });

  it('accepts optional before cursor', () => {
    const result = dmCursorSchema.safeParse({ before: '2024-01-01T00:00:00Z' });
    expect(result.success).toBe(true);
  });

  it('accepts optional beforeId', () => {
    const result = dmCursorSchema.safeParse({
      beforeId: 'clxxxxxxxxxxxxxxxxxxxxxx01',
    });
    expect(result.success).toBe(true);
  });
});

describe('sendFriendRequestSchema', () => {
  it('accepts valid username', () => {
    const result = sendFriendRequestSchema.safeParse({ username: 'alice' });
    expect(result.success).toBe(true);
  });

  it('rejects username shorter than 3 characters', () => {
    const result = sendFriendRequestSchema.safeParse({ username: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejects username longer than 32 characters', () => {
    const result = sendFriendRequestSchema.safeParse({
      username: 'a'.repeat(33),
    });
    expect(result.success).toBe(false);
  });

  it('accepts username of exactly 3 characters', () => {
    const result = sendFriendRequestSchema.safeParse({ username: 'abc' });
    expect(result.success).toBe(true);
  });

  it('accepts username of exactly 32 characters', () => {
    const result = sendFriendRequestSchema.safeParse({
      username: 'a'.repeat(32),
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing username', () => {
    const result = sendFriendRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
