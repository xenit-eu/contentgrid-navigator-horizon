import { z } from "zod/v4";

const entityOverrideSchema = z.object({
  titleAttribute: z.string().nullable().optional(),
  hiddenColumns: z.array(z.string()).nullable().optional(),
  defaultSort: z.string().nullable().optional(),
});

export const appConfigSchema = z.object({
  version: z.number(),
  branding: z
    .object({
      appName: z.string().optional(),
      logoUrl: z.string().nullable().optional(),
      logoAlt: z.string().optional(),
    })
    .optional(),
  homePage: z
    .object({
      welcomeTitle: z.string().optional(),
      welcomeSubtitle: z.string().optional(),
    })
    .optional(),
  display: z
    .object({
      defaultPageSize: z.number().optional(),
      entityOverrides: z.record(z.string(), entityOverrideSchema).optional(),
    })
    .optional(),
  theme: z
    .object({
      colorPreset: z.string().nullable().optional(),
    })
    .optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
});

export function validateConfig(
  data: unknown,
): { success: true; data: z.infer<typeof appConfigSchema> } | { success: false; error: string } {
  const result = appConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: z.prettifyError(result.error) };
}
