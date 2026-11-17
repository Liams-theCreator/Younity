import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrganizerApplicationsController } from './organizer-applications.controller.js';
import { OrganizerApplicationsService } from './organizer-applications.service.js';

describe('OrganizerApplicationsController', () => {
	it('should be defined', async () => {
		const module = await Test.createTestingModule({
			controllers: [OrganizerApplicationsController],
			providers: [
				{ provide: OrganizerApplicationsService, useValue: {} },
			],
		})
		.overrideGuard(JwtAuthGuard)
		.useValue({ canActivate: () => true })
		.compile();

		try {
			expect(module.get(OrganizerApplicationsController)).toBeDefined();
		} finally {
			await module.close();
		}
	});
});
