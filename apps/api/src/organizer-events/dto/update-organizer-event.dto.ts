import { PartialType } from '@nestjs/swagger';
import { CreateOrganizerEventDto } from './create-organizer-event.dto.js';

export class UpdateOrganizerEventDto extends PartialType(CreateOrganizerEventDto) {}
