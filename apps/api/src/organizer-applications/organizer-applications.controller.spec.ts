import { Test, TestingModule } from '@nestjs/testing';
import { OrganizerApplicationsController } from './organizer-applications.controller';

describe('OrganizerApplicationsController', () => {
  let controller: OrganizerApplicationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizerApplicationsController],
    }).compile();

    controller = module.get<OrganizerApplicationsController>(OrganizerApplicationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
