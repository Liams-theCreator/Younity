import { Test, TestingModule } from '@nestjs/testing';
import { OrganizerEventsService } from './organizer-events.service.js';

describe('OrganizerEventsService', () => {
  let service: OrganizerEventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizerEventsService],
    }).compile();

    service = module.get<OrganizerEventsService>(OrganizerEventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
