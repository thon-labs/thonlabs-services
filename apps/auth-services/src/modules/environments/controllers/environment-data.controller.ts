import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { exceptionsMapper, StatusCodes } from '@/utils/enums/errors-metadata';
import { ThonLabsOnly } from '@/auth/modules/shared/decorators/thon-labs-only.decorator';
import { HasEnvAccess } from '@/auth/modules/shared/decorators/has-env-access.decorator';
import { EnvironmentDataService } from '@/auth/modules/environments/services/environment-data.service';
import { SchemaValidator } from '@/auth/modules/shared/decorators/schema-validator.decorator';
import { setEnvironmentDataValidator } from '@/auth/modules/environments/validators/environment-data-validators';
import { EnvironmentService } from '@/auth/modules/environments/services/environment.service';
import { NeedsPublicKey } from '@/auth/modules/shared/decorators/needs-public-key.decorator';
import { PublicRoute } from '@/auth/modules/auth/decorators/auth.decorator';
import { NeedsInternalKey } from '@/auth/modules/shared/decorators/needs-internal-key.decorator';

@Controller('environments/:envId/data')
export class EnvironmentDataController {
  constructor(
    private environmentDataService: EnvironmentDataService,
    private environmentService: EnvironmentService,
  ) {}

  @Get('/')
  @PublicRoute()
  @NeedsPublicKey()
  async fetch(@Param('envId') environmentId: string) {
    const [envLegacyData, envData] = await Promise.all([
      this.environmentService.getData(environmentId),
      this.environmentDataService.fetch(environmentId, [
        'enableSignUp',
        'enableSignUpB2BOnly',
      ]),
    ]);

    return { ...envLegacyData, ...envData };
  }

  @Get('/app')
  @PublicRoute()
  @NeedsInternalKey()
  async fetchAppData(
    @Param('envId') environmentId: string,
    @Query() query: { ids: string[] },
  ) {
    const [envLegacyData, envData] = await Promise.all([
      this.environmentService.getData(environmentId),
      this.environmentDataService.fetch(environmentId, query.ids),
    ]);

    return { ...envLegacyData, ...envData };
  }

  @Get('/:id')
  @ThonLabsOnly()
  @HasEnvAccess({ param: 'envId' })
  async getById(
    @Param('envId') environmentId: string,
    @Param('id') id: string,
  ) {
    const data = await this.environmentDataService.get(environmentId, id);

    if (data?.statusCode) {
      throw new exceptionsMapper[data.statusCode](data.error);
    }

    return data.data;
  }

  @Post('/')
  @ThonLabsOnly()
  @HasEnvAccess({ param: 'envId' })
  @SchemaValidator(setEnvironmentDataValidator)
  async upsert(
    @Param('envId') environmentId: string,
    @Body() payload,
    @Res() res,
  ) {
    const { data: exists } = await this.environmentDataService.get(
      environmentId,
      payload.key,
    );

    const data = await this.environmentDataService.upsert(
      environmentId,
      payload,
    );

    if (data?.statusCode) {
      throw new exceptionsMapper[data.statusCode](data.error);
    }

    if (exists) {
      return res.status(StatusCodes.OK).send(data.data);
    }

    return res.status(StatusCodes.Created).send(data.data);
  }

  @Delete('/:key')
  @ThonLabsOnly()
  @HasEnvAccess({ param: 'envId' })
  async delete(
    @Param('envId') environmentId: string,
    @Param('key') key: string,
  ) {
    const data = await this.environmentDataService.delete(environmentId, key);

    if (data?.statusCode) {
      throw new exceptionsMapper[data.statusCode](data.error);
    }
  }
}
