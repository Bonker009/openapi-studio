export type GeneratedTestCase = {
  name: string;
  description: string;
  category: "valid" | "invalid" | "security" | "edge";
  fields: Record<string, unknown>;
  expectedResponse: {
    status: number;
    message: string;
  };
  id?: string;
  generated?: boolean;
  timestamp?: string;
};

export type TestCaseCategorySummary = {
  valid: number;
  invalid: number;
  security: number;
  edge: number;
};
