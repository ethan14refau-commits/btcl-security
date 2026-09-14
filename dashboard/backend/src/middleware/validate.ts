import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Zod validation middleware factory.
 * Validates req.body against the provided schema.
 * Returns 400 with validation errors if invalid.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = (result.error as ZodError).issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      res.status(400).json({ error: 'Validation Error', details: errors });
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validate query parameters.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = (result.error as ZodError).issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      res.status(400).json({ error: 'Validation Error', details: errors });
      return;
    }
    req.query = result.data as Record<string, string>;
    next();
  };
}
