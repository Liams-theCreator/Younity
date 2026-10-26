import { IsEmail } from 'class-validator';
import { createValidationPipe } from './application.js';

class Input {
  @IsEmail()
  email!: string;
}
const metadata = { type: 'body' as const, metatype: Input };

describe('global request validation', () => {
  it('transforms valid input into the declared DTO', async () => {
    const result = await createValidationPipe().transform(
      { email: 'student@example.com' },
      metadata,
    );
    expect(result).toBeInstanceOf(Input);
  });
  it('rejects invalid input', async () => {
    await expect(
      createValidationPipe().transform({ email: 'invalid' }, metadata),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('rejects unexpected fields', async () => {
    await expect(
      createValidationPipe().transform(
        { email: 'student@example.com', role: 'ADMIN' },
        metadata,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
