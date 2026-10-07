export interface SchemaDefinition {
  name: string;
  version: string;
  description?: string | undefined;
  fields: Array<{
    name: string;
    type: string;
    nullable: boolean;
    description?: string | undefined;
    constraints?: Record<string, unknown> | undefined;
  }>;
  primaryKey?: string[] | undefined;
  updatedAt: string;
}