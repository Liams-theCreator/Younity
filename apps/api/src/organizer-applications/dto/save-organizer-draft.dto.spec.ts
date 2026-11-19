import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveOrganizerDraftDto } from './save-organizer-draft.dto.js';

describe('SaveOrganizerDraftDto', () => {
	it('allows organiationNmae to be omitted', async () => {
		const dto = plainToInstance(SaveOrganizerDraftDto, {});
		const errors = await validate(dto);

		expect(errors).toHaveLength(0);
	});
	it('rejects a whitespace only organizationName', async () => {
		const dto = plainToInstance(SaveOrganizerDraftDto, { organizationName: ' '});
		const errors = await validate(dto);

		expect(errors.length).toBeGreaterThan(0);
	});
	it('rejects an unknown organization type', async () => {
		const dto = plainToInstance(SaveOrganizerDraftDto, { type: 'UNKNOWN_TYPE'});
		const errors = await validate(dto);

		expect(errors.find(error => error.property === 'type')?.constraints).toHaveProperty('isEnum');

	});

	it('accepts a representative name on its own and trim spaces', async () => {
		const dto = plainToInstance(SaveOrganizerDraftDto, { representativeFullName: ' aadel maki '});
		const errors = await validate(dto);

		expect(dto.representativeFullName).toBe('aadel maki');
		expect(errors).toHaveLength(0);
	});

	it('checking invalid phone number', async () => {
		const dto = plainToInstance(SaveOrganizerDraftDto, { phoneNumber: 'not-a-phone'});
		const errors = await validate(dto);

		expect(errors.find(error => error.property === 'phoneNumber')?.constraints).toHaveProperty('isPhoneNumber');
	});

	it('proof url can accept null', async () => {
		const dto = plainToInstance(SaveOrganizerDraftDto, { proofUrl: null});
		const errors = await validate(dto);

		expect(errors).toHaveLength(0);
	});

	it('rejects an FTP proof url Unmatched protocol', async () => {
		const dto = plainToInstance(SaveOrganizerDraftDto, { proofUrl: 'ftp://aadel.com/readme.txt'});
		const errors = await validate(dto);

		expect(errors.find(error => error.property === 'proofUrl')?.constraints).toHaveProperty('isUrl');
	});

});
