import { useCallback, useState } from "react";
import {
  type DevApp,
  type DevAppConfig,
  clearDevConfig,
  getAppConfig,
  getDefaultExtractServiceUrl,
  getDefaultRenditionUri,
  productionApps,
  sandboxApps,
  storeDevConfig,
  useAuth,
} from "@contentgrid/navigator-data";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Input,
  Label,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@contentgrid/ui";

const MOCK_EXTRACT_STORAGE_KEY = "contentgrid:useMockExtract";
const CUSTOM_CONFIG_STORAGE_KEY = "contentgrid:customConfig";

function loadMockExtract(): boolean {
  return localStorage.getItem(MOCK_EXTRACT_STORAGE_KEY) === "true";
}

function loadSavedCustomConfig(): DevAppConfig | null {
  try {
    const raw = localStorage.getItem(CUSTOM_CONFIG_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DevAppConfig) : null;
  } catch {
    return null;
  }
}

function saveCustomConfig(config: DevAppConfig) {
  localStorage.setItem(CUSTOM_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function getInitialConfig(): DevAppConfig | null {
  try {
    const rc = getAppConfig();
    return {
      apiBaseUrl: rc.apiBaseUrl,
      authority: rc.authority,
      clientId: rc.clientId,
      extractServiceUrl: rc.extractServiceUrl,
      renditionUri: rc.renditionUri,
    };
  } catch {
    return null;
  }
}

export function NavigatorSettingsPage() {
  const auth = useAuth();
  const [selectedConfig, setSelectedConfig] = useState<DevAppConfig | null>(getInitialConfig);
  const [useMockExtract, setUseMockExtract] = useState(loadMockExtract);

  const handleMockExtractChange = useCallback((value: boolean) => {
    setUseMockExtract(value);
    localStorage.setItem(MOCK_EXTRACT_STORAGE_KEY, String(value));
  }, []);

  const handleConfigSelect = useCallback(
    (app: DevApp, environment: "production" | "sandbox" | "custom") => {
      const cfg = { ...app.config };
      if (environment !== "custom") {
        if (!cfg.extractServiceUrl) {
          cfg.extractServiceUrl = getDefaultExtractServiceUrl(environment, useMockExtract);
        } else if (useMockExtract) {
          cfg.extractServiceUrl = getDefaultExtractServiceUrl(environment, useMockExtract);
        }
        if (!cfg.renditionUri) {
          cfg.renditionUri = getDefaultRenditionUri(environment);
        }
      }
      setSelectedConfig(cfg);
    },
    [useMockExtract],
  );

  function handleConnect() {
    if (selectedConfig) {
      storeDevConfig({
        apiBaseUrl: selectedConfig.apiBaseUrl,
        authority: selectedConfig.authority,
        clientId: selectedConfig.clientId,
        extractServiceUrl: selectedConfig.extractServiceUrl,
        renditionUri: selectedConfig.renditionUri,
      });
    }
    void auth.removeUser();
    window.location.reload();
  }

  function handleClear() {
    clearDevConfig();
    void auth.removeUser();
    window.location.reload();
  }

  return (
    <div className="flex gap-4 h-full w-full p-4">
      <div className="w-1/4 min-w-60">
        <SettingsPanel
          selectedConfig={selectedConfig}
          useMockExtract={useMockExtract}
          onMockExtractChange={handleMockExtractChange}
          onConnect={handleConnect}
          onClear={handleClear}
        />
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden p-0">
        <Tabs defaultValue="custom" className="flex-1 min-h-0 flex flex-col">
          <TabsList
            variant="line"
            className="border-b rounded-none px-4 w-full justify-start shrink-0"
          >
            <TabsTrigger value="custom">Custom</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
          </TabsList>

          <TabsContent value="custom" className="flex-1 overflow-y-auto m-0">
            <div className="p-4">
              <CustomConfigForm config={selectedConfig} onChange={setSelectedConfig} />
            </div>
          </TabsContent>

          <TabsContent value="production" className="flex-1 overflow-y-auto m-0">
            <AppList
              apps={productionApps}
              onSelect={(app) => handleConfigSelect(app, "production")}
            />
          </TabsContent>

          <TabsContent value="sandbox" className="flex-1 overflow-y-auto m-0">
            <AppList apps={sandboxApps} onSelect={(app) => handleConfigSelect(app, "sandbox")} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

// --- Left panel ---

interface SettingsPanelProps {
  selectedConfig: DevAppConfig | null;
  useMockExtract: boolean;
  onMockExtractChange: (value: boolean) => void;
  onConnect: () => void;
  onClear: () => void;
}

function SettingsPanel({
  selectedConfig,
  useMockExtract,
  onMockExtractChange,
  onConnect,
  onClear,
}: Readonly<SettingsPanelProps>) {
  return (
    <Card className="h-full p-6 flex flex-col gap-4">
      <h1 className="text-2xl">Navigator Settings</h1>

      <div className="flex items-center gap-1">
        <input
          id="mock-extract"
          type="checkbox"
          checked={useMockExtract}
          onChange={(e) => onMockExtractChange(e.target.checked)}
          className="h-4 w-4 rounded border border-input cursor-pointer"
        />
        <Label htmlFor="mock-extract" className="cursor-pointer">
          Use Mock Extract
        </Label>
      </div>

      <Separator />

      <div>
        <h2 className="text-xl font-medium mb-2">Current Configuration</h2>

        {selectedConfig ? (
          <div className="flex flex-col gap-3">
            <ConfigField label="Base URL" value={selectedConfig.apiBaseUrl} />
            <ConfigField label="Authority" value={selectedConfig.authority} />
            <ConfigField label="Client ID" value={selectedConfig.clientId} />
            {selectedConfig.extractServiceUrl && (
              <ConfigField label="Extract Service" value={selectedConfig.extractServiceUrl} />
            )}
            {selectedConfig.renditionUri && (
              <ConfigField label="Rendition URI" value={selectedConfig.renditionUri} />
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No configuration selected</p>
        )}
      </div>

      <Button variant="destructive" className="w-full" onClick={onClear}>
        Clear Runtime Config &amp; OIDC State
      </Button>
      <p className="text-sm">Clears saved configuration and authentication session</p>
      <Button className="w-full" onClick={onConnect}>
        Connect
      </Button>
    </Card>
  );
}

function ConfigField({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <p className="text-sm break-all p-2 bg-muted rounded">
      <strong>{label}:</strong>
      <br />
      {value}
    </p>
  );
}

// --- Right panel: app list ---

function AppList({
  apps,
  onSelect,
}: Readonly<{ apps: DevApp[]; onSelect: (app: DevApp) => void }>) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {apps.map((app) => (
        <AppCard key={app.config.apiBaseUrl} app={app} onSelect={onSelect} />
      ))}
    </div>
  );
}

function AppCard({ app, onSelect }: Readonly<{ app: DevApp; onSelect: (app: DevApp) => void }>) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <p className="text-xl font-medium mb-2">{app.name}</p>
        {app.description && <p className="text-sm text-muted-foreground">{app.description}</p>}
        <span className="text-xs text-muted-foreground mt-2 block break-all">
          {app.config.apiBaseUrl}
        </span>
      </CardContent>
      <CardFooter className="px-4 pb-4 pt-0">
        <Button size="sm" variant="outline" onClick={() => onSelect(app)}>
          Load Config
        </Button>
      </CardFooter>
    </Card>
  );
}

// --- Custom config form ---

const EMPTY_CONFIG: DevAppConfig = {
  apiBaseUrl: "",
  authority: "",
  clientId: "",
  extractServiceUrl: "",
  renditionUri: "",
};

function CustomConfigForm({
  config,
  onChange,
}: Readonly<{ config: DevAppConfig | null; onChange: (c: DevAppConfig) => void }>) {
  const savedCustomConfig = loadSavedCustomConfig();
  const formConfig = config ?? savedCustomConfig ?? EMPTY_CONFIG;

  function update(partial: Partial<DevAppConfig>) {
    const next = { ...formConfig, ...partial };
    saveCustomConfig(next);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <FormField
        id="base-url"
        label="Base URL"
        type="url"
        value={formConfig.apiBaseUrl}
        onChange={(v) => update({ apiBaseUrl: v })}
      />
      <FormField
        id="authority"
        label="Issuer URI"
        type="url"
        value={formConfig.authority}
        onChange={(v) => update({ authority: v })}
      />
      <FormField
        id="client-id"
        label="Client ID"
        value={formConfig.clientId}
        onChange={(v) => update({ clientId: v })}
      />
      <FormField
        id="extract-service-url"
        label="Extract Service URL"
        type="url"
        value={formConfig.extractServiceUrl ?? ""}
        onChange={(v) => update({ extractServiceUrl: v || undefined })}
      />
      <FormField
        id="rendition-uri"
        label="Rendition URI Template"
        value={formConfig.renditionUri ?? ""}
        onChange={(v) => update({ renditionUri: v || undefined })}
      />
      <Button
        variant="outline"
        disabled={savedCustomConfig === null}
        className="w-fit"
        onClick={() => {
          if (savedCustomConfig) onChange(savedCustomConfig);
        }}
      >
        Load saved config
      </Button>
    </div>
  );
}

function FormField({
  id,
  label,
  type,
  value,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-sm"
      />
    </div>
  );
}
