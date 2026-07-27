export type AppCategory = "custom" | "production" | "sandbox";

export interface DevAppConfig {
  apiBaseUrl: string;
  authority: string;
  clientId: string;
  extractServiceUrl?: string;
  renditionUri?: string;
}

export interface DevApp {
  name: string;
  description?: string;
  config: DevAppConfig;
  category: AppCategory;
}

export const productionApps: DevApp[] = [
  {
    name: "PR preview app",
    description: "Backend APP for github PR previews",
    config: {
      apiBaseUrl: "https://a41f29cd-fa71-4ed9-8f73-06e3065a1256.eu-west-1.contentgrid.cloud",
      authority:
        "https://auth.eu-west-1.contentgrid.cloud/realms/cg-79adcc8b-2249-4032-8925-971749ae1cac",
      clientId: "contentgrid-webapp-ac591127-33b4-4191-a9a3-2d321281c903",
    },
    category: "production",
  },
  {
    name: "Integration test model - Only for viewing - Do not delete entities",
    description: "Navigator playwright test integration test model",
    config: {
      apiBaseUrl: "https://e933133a-0d07-4aa0-aa45-28959c04d5c7.eu-west-1.contentgrid.cloud",
      authority:
        "https://auth.eu-west-1.contentgrid.cloud/realms/cg-79adcc8b-2249-4032-8925-971749ae1cac",
      clientId: "contentgrid-webapp-a1360c61-23ee-42c5-8204-149ba99bff42",
      extractServiceUrl: "https://mock-extract.eu-west-1.contentgrid.cloud/extract/",
    },
    category: "production",
  },
  {
    name: "Long entity names and many attributes/relations",
    description: "For testing how navigator deals with long names",
    config: {
      apiBaseUrl: "https://c7eaf1db-4083-4b84-9804-b7c6c8a5e178.eu-west-1.contentgrid.cloud",
      authority:
        "https://auth.eu-west-1.contentgrid.cloud/realms/cg-79adcc8b-2249-4032-8925-971749ae1cac",
      clientId: "contentgrid-webapp-16a92a5e-d4b4-4963-885e-c484deb15c82",
    },
    category: "production",
  },
];

export const sandboxApps: DevApp[] = [
  {
    name: "Insurance on Sandbox",
    description: "Testing sandbox environment with inverse relations",
    config: {
      apiBaseUrl: "https://788a45f3-bba8-4e0b-a6bb-64871caf9a6a.sandbox.contentgrid.cloud",
      authority:
        "https://auth.sandbox.contentgrid.cloud/realms/cg-86ce0e5f-3846-41a3-b79e-11a7666a1b53",
      clientId: "contentgrid-webapp-cc0d6182-20a2-4172-a38c-094d0ab4e113",
    },
    category: "sandbox",
  },
];

export function getDefaultExtractServiceUrl(
  environment: "production" | "sandbox",
  useMock: boolean,
): string {
  if (useMock) {
    return environment === "production"
      ? "https://mock-extract.eu-west-1.contentgrid.cloud/extract/"
      : "https://mock-extract.sandbox.contentgrid.cloud/extract/";
  }
  return environment === "production"
    ? "https://extract.eu-west-1.contentgrid.cloud/extract/"
    : "https://extract.sandbox.contentgrid.cloud/extract/";
}

export function getDefaultRenditionUri(environment: "production" | "sandbox"): string {
  return environment === "production"
    ? "https://renditions.eu-west-1.contentgrid.cloud/renditions/get/pdf{?url}"
    : "https://renditions.sandbox.contentgrid.cloud/renditions/get/pdf{?url}";
}
