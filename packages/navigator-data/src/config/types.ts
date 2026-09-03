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
  };
  theme: {
    colorPreset: string | null;
  };
  featureFlags: Record<string, boolean>;
}
