import { createValidationPipe } from '../../config/application.js';
import { ListAdminApplicationsDto } from './list-admin-applications.dto.js';

const metadata = { type: 'query' as const, metatype: ListAdminApplicationsDto };

describe('Admin application list query validation', () => {
  it('defaults to the first page with a bounded page size', async () => {
    expect(await createValidationPipe().transform({}, metadata)).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it('parses decimal integers and the exact review status', async () => {
    expect(
      await createValidationPipe().transform(
        { page: '2', limit: '100', status: 'PENDING' },
        metadata,
      ),
    ).toEqual({ page: 2, limit: 100, status: 'PENDING' });
  });

  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: '1e3' },
    { page: '1000001' },
    { page: '' },
    { page: ['1', '2'] },
    { limit: '0' },
    { limit: '101' },
    { limit: '1.1' },
    { limit: ' 20' },
    { limit: ['1', '2'] },
    { status: 'DRAFT' },
    { status: 'pending' },
    { status: ['PENDING', 'APPROVED'] },
    { userId: 'injected' },
  ])('rejects invalid or undeclared query input: %j', async (input) => {
    await expect(
      createValidationPipe().transform(input, metadata),
    ).rejects.toMatchObject({ status: 400 });
  });
});
