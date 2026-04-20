/**
 * RED test: verifies the Prisma client exposes the new DM-related models.
 * These tests will fail until the schema migration is applied and the
 * Prisma client is regenerated.
 *
 * TDD cycle: RED → schema migration → GREEN → refactor (none needed here).
 */
import { PrismaClient } from '@prisma/client';

describe('Prisma DM schema models', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    // We only need the generated client types/delegates — no real DB connection.
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('exposes a friendship model delegate', () => {
    expect(prisma.friendship).toBeDefined();
    expect(typeof prisma.friendship.findFirst).toBe('function');
  });

  it('exposes a friendRequest model delegate', () => {
    expect(prisma.friendRequest).toBeDefined();
    expect(typeof prisma.friendRequest.findFirst).toBe('function');
  });

  it('exposes a block model delegate', () => {
    expect(prisma.block).toBeDefined();
    expect(typeof prisma.block.findFirst).toBe('function');
  });

  it('exposes a directMessageThread model delegate', () => {
    expect(prisma.directMessageThread).toBeDefined();
    expect(typeof prisma.directMessageThread.findFirst).toBe('function');
  });

  it('exposes a directMessage model delegate', () => {
    expect(prisma.directMessage).toBeDefined();
    expect(typeof prisma.directMessage.findFirst).toBe('function');
  });
});
