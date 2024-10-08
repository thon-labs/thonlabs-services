import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@/auth/modules/shared/database/database.service';
import { DataReturn } from '@/utils/interfaces/data-return';
import { EnvironmentData } from '@prisma/client';
import { StatusCodes } from '@/utils/enums/errors-metadata';
import prepareString from '@/utils/services/prepare-string';
import camelCase from 'lodash/camelCase';

@Injectable()
export class EnvironmentDataService {
  private readonly logger = new Logger(EnvironmentDataService.name);

  constructor(private databaseService: DatabaseService) {}

  /**
   * Upserts environment data.
   *
   * @param {string} environmentId - The ID of the environment.
   * @param {Object} payload - The payload containing the data to upsert.
   * @param {string} payload.id - The ID of the data.
   * @param {any} payload.value - The value of the data.
   * @returns {Promise<DataReturn<EnvironmentData>>} - The upserted environment data.
   */
  async upsert(
    environmentId: string,
    payload: { id: string; value: any },
  ): Promise<DataReturn<EnvironmentData>> {
    const id = camelCase(prepareString(payload.id));

    const environmentData = await this.databaseService.environmentData.upsert({
      where: { id: camelCase(id), environmentId },
      create: {
        id,
        value: payload.value,
        environmentId,
      },
      update: {
        value: payload.value,
      },
      select: {
        id: true,
        value: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(
      `Upserted environment data ${payload.id} (ENV: ${environmentId})`,
    );

    return { data: environmentData as EnvironmentData };
  }

  /**
   * Updates environment data.
   *
   * @param {string} environmentId - The ID of the environment.
   * @param {Object} payload - The payload containing the data to update.
   * @param {string} payload.id - The ID of the data.
   * @param {any} payload.value - The value of the data.
   * @returns {Promise<DataReturn<EnvironmentData>>} - The updated environment data.
   */
  async update(
    environmentId: string,
    payload: { id: string; value: any },
  ): Promise<DataReturn<EnvironmentData>> {
    const id = camelCase(prepareString(payload.id));

    const exists = await this.get(environmentId, id);

    if (!exists?.data) {
      return {
        statusCode: StatusCodes.NotFound,
        error: `Environment data ${id} not found`,
      };
    }

    const environmentData = await this.databaseService.environmentData.update({
      where: { id: camelCase(id), environmentId },
      data: { value: payload.value },
      select: {
        id: true,
        value: true,
        updatedAt: true,
      },
    });

    this.logger.log(
      `Updated environment data ${payload.id} (ENV: ${environmentId})`,
    );

    return { data: environmentData as EnvironmentData };
  }

  /**
   * Fetches all environment data for a given environment ID.
   *
   * @param {string} environmentId - The ID of the environment.
   * @returns {Promise<Record<string, any>>} - The fetched environment data.
   */
  async fetch(environmentId: string): Promise<Record<string, any>> {
    const environmentData = await this.databaseService.environmentData.findMany(
      {
        where: { environmentId },
        select: {
          id: true,
          value: true,
        },
      },
    );

    const values = {};

    environmentData.forEach((data) => {
      values[data.id] = data.value;
    });

    return values;
  }

  /**
   * Gets environment data by ID.
   *
   * @param {string} environmentId - The ID of the environment.
   * @param {string} id - The ID of the data.
   * @returns {Promise<DataReturn<EnvironmentData>>} - The fetched environment data.
   */
  async get(
    environmentId: string,
    id: string,
  ): Promise<DataReturn<EnvironmentData['value']>> {
    const environmentData =
      await this.databaseService.environmentData.findUnique({
        where: { id: camelCase(id), environmentId },
        select: {
          value: true,
        },
      });

    if (!environmentData) {
      const error = `Environment data ID ${id} not found`;
      this.logger.warn(`${error} (ENV: ${environmentId})`);

      return {
        statusCode: StatusCodes.NotFound,
        error,
      };
    }

    return { data: environmentData?.value };
  }

  /**
   * Deletes environment data by ID.
   *
   * @param {string} environmentId - The ID of the environment.
   * @param {string} id - The ID of the data.
   * @returns {Promise<DataReturn<EnvironmentData>>} - The deleted environment data.
   */
  async delete(
    environmentId: string,
    id: string,
  ): Promise<DataReturn<EnvironmentData>> {
    const environmentData = await this.get(environmentId, id);

    if (environmentData?.statusCode) {
      return {
        statusCode: environmentData.statusCode,
        error: environmentData.error,
      };
    }

    await this.databaseService.environmentData.delete({
      where: { id: camelCase(id), environmentId },
    });
  }
}
