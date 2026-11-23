import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { SessionsService } from './sessions.service';

const CreateBody = z.object({ assessmentId: z.string().min(1) });

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  create(@Body() body: unknown) {
    const b = CreateBody.safeParse(body);
    if (!b.success) throw new BadRequestException(b.error.flatten());
    return this.sessions.create(b.data.assessmentId);
  }

  @Get() list() { return this.sessions.list(); }
  @Get(':id') get(@Param('id') id: string) { return this.sessions.get(id); }
  @Post(':id/sections/:sectionId/start') start(@Param('id') id: string, @Param('sectionId') s: string) { return this.sessions.startSection(id, s); }
  @Post(':id/sections/:sectionId/submit') submitSection(@Param('id') id: string, @Param('sectionId') s: string) { return this.sessions.submitSection(id, s); }
  @Post(':id/submit') submit(@Param('id') id: string) { return this.sessions.submit(id); }
  @Post(':id/abandon') abandon(@Param('id') id: string) { return this.sessions.abandon(id); }
  @Get(':id/results') results(@Param('id') id: string) { return this.sessions.results(id); }
}
