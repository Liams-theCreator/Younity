import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterStudentDto } from './register-student.dto.js';
import { RegisterOrganizerDto } from './register-organizer.dto.js';

const invalidPasswords: [string, unknown][] = [
  ['shorter than 8 characters', 'Abcd88!'],
  ['missing uppercase', 'abcdefghijklm1!'],
  ['missing lowercase', 'ABCDEFGHIJKLM1!'],
  ['missing a number', 'Abcdefghijklmn!'],
  ['missing a special character', 'Abcdefghijklmn1'],
  ['space instead of a special character', 'Abcdefghijklm1 '],
  ['longer than 128 characters', `Aa1!${'x'.repeat(125)}`],
  ['empty', ''],
  ['missing', undefined],
  ['null', null],
  ['a number instead of a string', 123456789],
];

describe('Registration password validation', () => {
  for (const role of ['student', 'organizer'] as const) {
    describe(role, () => {
      async function getPasswordErrors(password: unknown) {
        const input = { password };

        const dto = role === 'student'
          ? plainToInstance(RegisterStudentDto, input)
          : plainToInstance(RegisterOrganizerDto, input);

        const errors = await validate(dto);

        // Other required fields are intentionally omitted.
        // This file tests the password property only.
        return errors.filter(error => error.property === 'password');
      }

      it.each(invalidPasswords)('rejects %s', async (
        _description,
        password,
      ) => {
        const errors = await getPasswordErrors(password);

        expect(errors.length).toBeGreaterThan(0);
      });

      it.each([
        ['minimum length', 'Abcdef1!'],
        ['maximum length', `Aa1!${'x'.repeat(124)}`],
      ])('accepts a valid password at %s', async (
        _description,
        password,
      ) => {
        expect(await getPasswordErrors(password)).toHaveLength(0);
      });

      it('does not trim or lowercase the password', () => {
        const password = ' Example-password-2026! ';

        const dto = role === 'student'
          ? plainToInstance(RegisterStudentDto, { password })
          : plainToInstance(RegisterOrganizerDto, { password });

        expect(dto.password).toBe(password);
      });
    });
  }
});
