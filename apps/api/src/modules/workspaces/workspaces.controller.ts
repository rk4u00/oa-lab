import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { WorkspacesService } from './workspaces.service';

const WriteBody = z.object({ path: z.string().min(1), content: z.string() });
const RunBody = z.object({ target: z.string().max(300).optional() }).default({});

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly ws: WorkspacesService) {}

  @Get(':id') details(@Param('id') id: string) { return this.ws.details(id); }
  @Post(':id/start') start(@Param('id') id: string) { return this.ws.start(id).then(() => this.ws.details(id)); }
  @Get(':id/files') tree(@Param('id') id: string) { return this.ws.tree(id); }
  @Get(':id/file') read(@Param('id') id: string, @Query('path') p: string) { return this.ws.readFile(id, p); }

  @Put(':id/file')
  write(@Param('id') id: string, @Body() body: unknown) {
    const b = WriteBody.safeParse(body);
    if (!b.success) throw new BadRequestException(b.error.flatten());
    return this.ws.writeFile(id, b.data.path, b.data.content);
  }

  @Post(':id/run-tests')
  run(@Param('id') id: string, @Body() body: unknown) {
    const b = RunBody.safeParse(body ?? {});
    if (!b.success) throw new BadRequestException(b.error.flatten());
    return this.ws.runTests(id, b.data.target?.trim() || undefined);
  }

  @Get(':id/test-runs') runs(@Param('id') id: string) { return this.ws.testRuns(id); }
  @Get(':id/test-runs/latest') latest(@Param('id') id: string) { return this.ws.latestRun(id); }
  @Get(':id/diff') diff(@Param('id') id: string) { return this.ws.diff(id); }
  @Post(':id/reset') reset(@Param('id') id: string) { return this.ws.reset(id); }
  @Get(':id/coach') coach(@Param('id') id: string) { return this.ws.coachPrompt(id); }
}
