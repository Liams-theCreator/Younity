import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { OrganizerEventsService } from './organizer-events.service.js';
import { CreateOrganizerEventDto } from './dto/create-organizer-event.dto.js';
import { UpdateOrganizerEventDto } from './dto/update-organizer-event.dto.js';

@Controller('organizer-events')
export class OrganizerEventsController {
  constructor(private readonly organizerEventsService: OrganizerEventsService) {}

  @Post()
  create(@Body() createOrganizerEventDto: CreateOrganizerEventDto) {
    return this.organizerEventsService.create(createOrganizerEventDto);
  }

  @Get()
  findAll() {
    return this.organizerEventsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.organizerEventsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrganizerEventDto: UpdateOrganizerEventDto) {
    return this.organizerEventsService.update(+id, updateOrganizerEventDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.organizerEventsService.remove(+id);
  }
}
