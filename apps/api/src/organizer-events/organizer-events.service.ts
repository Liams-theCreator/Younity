import { Injectable } from '@nestjs/common';
import { CreateOrganizerEventDto } from './dto/create-organizer-event.dto.js';
import { UpdateOrganizerEventDto } from './dto/update-organizer-event.dto.js';

@Injectable()
export class OrganizerEventsService {
  create(createOrganizerEventDto: CreateOrganizerEventDto) {
    return 'This action adds a new organizerEvent';
  }

  findAll() {
    return `This action returns all organizerEvents`;
  }

  findOne(id: number) {
    return `This action returns a #${id} organizerEvent`;
  }

  update(id: number, updateOrganizerEventDto: UpdateOrganizerEventDto) {
    return `This action updates a #${id} organizerEvent`;
  }

  remove(id: number) {
    return `This action removes a #${id} organizerEvent`;
  }
}
