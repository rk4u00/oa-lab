import { Module } from '@nestjs/common';
import { driverProvider } from './common/driver.provider';
import { PrismaService } from './common/prisma.service';
import { ContentController } from './modules/content/content.controller';
import { ContentService } from './modules/content/content.service';
import { HealthController } from './modules/health.controller';
import { AnalyticsController } from './modules/sessions/analytics.controller';
import { AnalyticsService } from './modules/sessions/analytics.service';
import { SessionsController } from './modules/sessions/sessions.controller';
import { SessionsService } from './modules/sessions/sessions.service';
import { TerminalService } from './modules/terminal/terminal.service';
import { WorkspacesController } from './modules/workspaces/workspaces.controller';
import { WorkspacesService } from './modules/workspaces/workspaces.service';
import { HousekeepingService } from './modules/workspaces/housekeeping.service';

@Module({
  controllers: [HealthController, ContentController, SessionsController, WorkspacesController, AnalyticsController],
  providers: [driverProvider, PrismaService, ContentService, WorkspacesService, SessionsService, AnalyticsService, TerminalService, HousekeepingService],
})
export class AppModule {}
