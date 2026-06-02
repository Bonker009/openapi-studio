import { z } from "zod";

export const flowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal("REQUEST"),
  name: z.string().min(1),
  endpoint: z.string().min(1),
});

export const flowEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.enum(["success", "failure", "always"]),
});

export const flowSchemaZod = z.object({
  nodes: z.array(flowNodeSchema).min(1),
  edges: z.array(flowEdgeSchema),
});

export type FlowSchemaParsed = z.infer<typeof flowSchemaZod>;
