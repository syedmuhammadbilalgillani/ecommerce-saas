import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { AuditLogService } from './audit-log.service';
import { TelemetryService } from '../common/telemetry.service';

import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  controllers: [PlatformController],
  providers: [PlatformService, AuditLogService, TelemetryService],
  exports: [PlatformService, AuditLogService, TelemetryService],
})
export class PlatformModule {}
