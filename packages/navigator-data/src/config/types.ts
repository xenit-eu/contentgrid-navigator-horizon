export interface EntityOverride {
  titleAttribute: string | null;
  hiddenColumns: string[] | null;
  defaultSort: string | null;
}

export interface AppConfig {
  version: number;
  branding: {
    appName: string;
    logoUrl: string | null;
    logoAlt: string;
  };
  homePage: {
    welcomeTitle: string;
    welcomeSubtitle: string;
  };
  display: {
    defaultPageSize: number;
    entityOverrides: Record<string, EntityOverride>;
  };
  theme: {
    colorPreset: string | null;
  };
  featureFlags: Record<string, boolean>;
}
