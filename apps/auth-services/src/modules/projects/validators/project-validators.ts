import z from 'zod';
import { ErrorMessages } from '@/utils/enums/errors-metadata';

export const createProjectValidator = z.object({
  appName: z
    .string({ required_error: ErrorMessages.RequiredField })
    .max(25, ErrorMessages.MaxLength),
  appURL: z.string({ required_error: ErrorMessages.RequiredField }).url(),
});

export const deleteProjectValidator = z.object({
  id: z.string({ required_error: ErrorMessages.RequiredField }),
});

export const getByIdProjectValidator = z.object({
  id: z.string({ required_error: ErrorMessages.RequiredField }),
});

export const updateGeneralInfoValidator = z.object({
  appName: z
    .string({ required_error: ErrorMessages.RequiredField })
    .max(25, ErrorMessages.MaxLength),
});
