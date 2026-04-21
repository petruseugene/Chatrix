import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SearchUsersQueryDto } from './search-users-query.dto';

describe('SearchUsersQueryDto', () => {
  function build(q: unknown): SearchUsersQueryDto {
    return plainToInstance(SearchUsersQueryDto, { q });
  }

  async function errors(q: unknown): Promise<string[]> {
    const dto = build(q);
    const errs = await validate(dto);
    return errs.flatMap((e) => Object.values(e.constraints ?? {}));
  }

  it('accepts a valid query of exactly 2 characters', async () => {
    const errs = await errors('ab');
    expect(errs).toHaveLength(0);
  });

  it('accepts a valid query of exactly 32 characters', async () => {
    const errs = await errors('a'.repeat(32));
    expect(errs).toHaveLength(0);
  });

  it('accepts a valid query between 2 and 32 characters', async () => {
    const errs = await errors('alice');
    expect(errs).toHaveLength(0);
  });

  it('rejects a query shorter than 2 characters', async () => {
    const errs = await errors('a');
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects an empty string', async () => {
    const errs = await errors('');
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects a query longer than 32 characters', async () => {
    const errs = await errors('a'.repeat(33));
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects a non-string value', async () => {
    const errs = await errors(12345);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('trims leading and trailing whitespace from q', async () => {
    const dto = build('  alice  ');
    await validate(dto);
    expect(dto.q).toBe('alice');
  });

  it('trims-then-validates: a whitespace-padded 1-char string fails after trim', async () => {
    // '  a  ' trims to 'a' which is only 1 char — should fail MinLength
    const errs = await errors('  a  ');
    expect(errs.length).toBeGreaterThan(0);
  });
});
