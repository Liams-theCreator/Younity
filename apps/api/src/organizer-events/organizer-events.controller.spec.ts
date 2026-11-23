import { Test, TestingModule } from '@nestjs/testing';
import { OrganizerEventsController } from './organizer-events.controller.js';
import { OrganizerEventsService } from './organizer-events.service.js';

describe('OrganizerEventsController', () => {
  let controller: OrganizerEventsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizerEventsController],
      providers: [OrganizerEventsService],
    }).compile();

    controller = module.get<OrganizerEventsController>(OrganizerEventsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
