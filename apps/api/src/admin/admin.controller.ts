import { ApiTags, ApiCookieAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Header,
  Param,
  Post,
  ParseUUIDPipe,
  UseGuards,
  Body,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { AdminDecisionDto } from './dto/admin-decision-dto.js';
import { proofDisposition } from '../organizer-applications/organizer-proof.js';

@ApiTags('Admin applications')
@ApiCookieAuth()
@ApiParam({ name: 'id', format: 'uuid' })
@ApiResponse({ status: 400, description: 'Invalid UUID or body' })
@ApiResponse({ status: 401, description: 'JWT session required' })
@ApiResponse({
  status: 403,
  description: 'Active, email-verified administrator required',
})
@ApiResponse({ status: 404, description: 'Application not found' })
@ApiResponse({
  status: 409,
  description: 'Stale revision, ineligible application or owner',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}
  @Get('applications/:id/review')
  @Header('Cache-Control', 'no-store')
  getApplication(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminService.getApplication(id);
  }

  @Get('applications/:id/proof/:proofId')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cross-Origin-Resource-Policy', 'same-origin')
  @Header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  async getProof(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('proofId', new ParseUUIDPipe()) proofId: string,
    @Query('download') download?: string,
  ) {
    const proof = await this.adminService.getApplicationProof(id, proofId);
    return new StreamableFile(proof.data, {
      type: proof.mediaType,
      disposition: proofDisposition(proof.name, download === '1'),
      length: proof.data.byteLength,
    });
  }

  @ApiResponse({
    status: 201,
    description: 'Decision committed',
    schema: { type: 'integer', example: 1 },
  })
  @Post('applications/:id/approve')
  async approveApplication(
    @Param('id', new ParseUUIDPipe()) applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminDecisionDto,
  ) {
    return this.adminService.approveApplication(
      applicationId,
      user.id,
      dto.reason,
      dto.expectedRevision,
    );
  }
  @ApiResponse({
    status: 201,
    description: 'Decision committed',
    schema: { type: 'integer', example: 1 },
  })
  @Post('applications/:id/reject')
  async rejectApplication(
    @Param('id', new ParseUUIDPipe()) applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminDecisionDto,
  ) {
    return this.adminService.rejectApplication(
      applicationId,
      user.id,
      dto.reason,
      dto.expectedRevision,
    );
  }
  @ApiResponse({
    status: 201,
    description: 'Decision committed',
    schema: { type: 'integer', example: 1 },
  })
  @Post('applications/:id/request-changes')
  async requestChangesApplication(
    @Param('id', new ParseUUIDPipe()) applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminDecisionDto,
  ) {
    return this.adminService.requestChangesApplication(
      applicationId,
      user.id,
      dto.reason,
      dto.expectedRevision,
    );
  }
}
