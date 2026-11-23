import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { ContentService } from './content.service';

const ImportBody = z.object({ source: z.string().min(1), company: z.string().optional() });

@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('assessments')
  assessments() {
    return this.content.listAssessments().map(({ definition, origin }) => ({
      ...definition,
      origin,
      totalMinutes: definition.sections.reduce((n, s) => n + s.durationMinutes, 0),
    }));
  }

  @Get('assessments/:id')
  assessment(@Param('id') id: string) {
    const { definition, origin } = this.content.assessment(id);
    return {
      ...definition,
      origin,
      challenges: Object.fromEntries(
        definition.sections.flatMap((s) => s.challenges).map((c) => [c, this.summary(c)]),
      ),
    };
  }

  @Get('challenges')
  challenges() {
    return { challenges: this.content.listChallenges().map((c) => this.summary(c.manifest.id)), problems: this.content.problems };
  }

  @Get('challenges/:id')
  async challenge(@Param('id') id: string) {
    return { ...this.summary(id), task: await this.content.taskMarkdown(id) };
  }

  @Post('repositories/import')
  async import(@Body() body: unknown) {
    const parsed = ImportBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    try {
      return await this.content.import(parsed.data.source, parsed.data.company);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Post('content/reload')
  async reload() {
    await this.content.reload();
    return { challenges: this.content.listChallenges().length, problems: this.content.problems };
  }

  private summary(id: string) {
    const c = this.content.challenge(id);
    const m = c.manifest;
    return {
      id: m.id,
      title: m.title,
      company: m.company,
      difficulty: m.difficulty,
      durationMinutes: m.durationMinutes,
      description: m.description,
      runtime: m.runtime,
      features: m.features,
      origin: c.origin,
      provenance: m.provenance,
    };
  }
}
