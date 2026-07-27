import { useCallback, useState } from "react";
import {
  CheckCircleIcon,
  GearIcon,
  PlugIcon,
  SlidersHorizontalIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import {
  type AppCategory,
  DEV_CONFIG_STORAGE_KEY,
  type DevApp,
  type DevAppConfig,
  clearDevConfig,
  getAppConfig,
  getDefaultExtractServiceUrl,
  getDefaultRenditionUri,
  productionApps,
  sandboxApps,
  signinWithNewConfig,
  useAuth,
} from "@contentgrid/navigator-data";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@contentgrid/ui";

// packages/ui doesn't publish its `cn()` helper (only primitives/patterns are
// exported from the package root), and this package intentionally avoids
// adding a new clsx/tailwind-merge dependency for a single conditional-class
// use case. This tiny local helper covers the same need.
function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

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
  // Only pre-populate from the dev-override key; after clearDevConfig() the key is gone
  // so fields render empty. Env-var / config.js values are not shown here.
  if (!localStorage.getItem(DEV_CONFIG_STORAGE_KEY)) return null;
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

function isConfigSelected(selectedConfig: DevAppConfig | null, config: DevAppConfig): boolean {
  return (
    selectedConfig !== null &&
    selectedConfig.apiBaseUrl === config.apiBaseUrl &&
    selectedConfig.clientId === config.clientId
  );
}

export function ApplicationSelectorPage() {
  const auth = useAuth();
  const [selectedConfig, setSelectedConfig] = useState<DevAppConfig | null>(getInitialConfig);
  const [useMockExtract, setUseMockExtract] = useState(loadMockExtract);
  const [loadedEnvironment, setLoadedEnvironment] = useState<"production" | "sandbox" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleMockExtractChange = useCallback(
    (value: boolean) => {
      setUseMockExtract(value);
      localStorage.setItem(MOCK_EXTRACT_STORAGE_KEY, String(value));
      // Immediately update the extract URL in the currently-displayed config
      if (loadedEnvironment) {
        setSelectedConfig((prev) =>
          prev
            ? { ...prev, extractServiceUrl: getDefaultExtractServiceUrl(loadedEnvironment, value) }
            : null,
        );
      }
    },
    [loadedEnvironment],
  );

  const handleConfigSelect = useCallback(
    (app: DevApp, environment: AppCategory) => {
      const cfg = { ...app.config };
      if (environment !== "custom") {
        if (useMockExtract) {
          cfg.extractServiceUrl = getDefaultExtractServiceUrl(environment, useMockExtract);
        } else {
          cfg.extractServiceUrl ??= getDefaultExtractServiceUrl(environment, useMockExtract);
        }
        cfg.renditionUri ??= getDefaultRenditionUri(environment);
        setLoadedEnvironment(environment);
      } else {
        setLoadedEnvironment(null);
      }
      setSelectedConfig(cfg);
    },
    [useMockExtract],
  );

  async function handleConnect() {
    setActionError(null);
    try {
      if (selectedConfig) {
        await signinWithNewConfig({
          apiBaseUrl: selectedConfig.apiBaseUrl,
          authority: selectedConfig.authority,
          clientId: selectedConfig.clientId,
          extractServiceUrl: selectedConfig.extractServiceUrl,
          renditionUri: selectedConfig.renditionUri,
        });
      } else {
        await auth.signinRedirect();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Connection failed");
    }
  }

  async function handleClear() {
    setActionError(null);
    try {
      clearDevConfig();
      await auth.removeUser();
      window.location.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to clear configuration");
    }
  }

  return (
    <div className="w-full">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <header className="space-y-2">
          <Badge variant="secondary" className="gap-1">
            <GearIcon className="size-3" aria-hidden />
            Development tool
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight">Application Selector</h1>
          <p className="text-sm text-muted-foreground">
            Point Navigator at a different ContentGrid backend. Choose a preset or enter a custom
            configuration, then Connect to sign in against that environment.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="space-y-3">
            <StepHeader
              step={1}
              title="Choose a configuration"
              helper="Pick a preset environment or define your own."
            />
            <Card className="overflow-hidden p-0">
              <Tabs defaultValue="production">
                <TabsList
                  variant="line"
                  className="w-full justify-start rounded-none border-b px-4"
                >
                  <TabsTrigger value="production">Production</TabsTrigger>
                  <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                </TabsList>

                <TabsContent value="production" className="m-0 p-4">
                  <AppGrid
                    apps={productionApps}
                    selectedConfig={selectedConfig}
                    onSelect={(app) => handleConfigSelect(app, "production")}
                  />
                </TabsContent>

                <TabsContent value="sandbox" className="m-0 p-4">
                  <AppGrid
                    apps={sandboxApps}
                    selectedConfig={selectedConfig}
                    onSelect={(app) => handleConfigSelect(app, "sandbox")}
                  />
                </TabsContent>

                <TabsContent value="custom" className="m-0 p-4">
                  <CustomConfigForm config={selectedConfig} onChange={setSelectedConfig} />
                </TabsContent>
              </Tabs>
            </Card>
          </section>

          <ReviewPanel
            selectedConfig={selectedConfig}
            useMockExtract={useMockExtract}
            onMockExtractChange={handleMockExtractChange}
            onConnect={handleConnect}
            onClear={handleClear}
            actionError={actionError}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step header — small numbered badge + title (+ optional helper text)
// ---------------------------------------------------------------------------

function StepHeader({
  step,
  title,
  helper,
}: Readonly<{ step: number; title: string; helper?: string }>) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
        {step}
      </span>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right column — review the selected config + connect / clear actions
// ---------------------------------------------------------------------------

interface ReviewPanelProps {
  selectedConfig: DevAppConfig | null;
  useMockExtract: boolean;
  onMockExtractChange: (value: boolean) => void;
  onConnect: () => Promise<void>;
  onClear: () => Promise<void>;
  actionError: string | null;
}

function ReviewPanel({
  selectedConfig,
  useMockExtract,
  onMockExtractChange,
  onConnect,
  onClear,
  actionError,
}: Readonly<ReviewPanelProps>) {
  return (
    <section className="space-y-3 lg:sticky lg:top-8 lg:self-start">
      <StepHeader step={2} title="Review & connect" />
      <Card className="gap-4 p-4">
        {selectedConfig ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReviewField label="Base URL" value={selectedConfig.apiBaseUrl} />
            <ReviewField label="Issuer / Authority" value={selectedConfig.authority} />
            <ReviewField label="Client ID" value={selectedConfig.clientId} />
            {selectedConfig.extractServiceUrl && (
              <ReviewField label="Extract Service" value={selectedConfig.extractServiceUrl} />
            )}
            {selectedConfig.renditionUri && (
              <ReviewField label="Rendition URI" value={selectedConfig.renditionUri} />
            )}
          </dl>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
            <SlidersHorizontalIcon className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">No configuration selected</p>
            <p className="text-xs text-muted-foreground">Select a configuration to continue.</p>
          </div>
        )}

        <label
          htmlFor="use-mock-extract"
          className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-accent/50"
        >
          <input
            id="use-mock-extract"
            type="checkbox"
            checked={useMockExtract}
            onChange={(e) => onMockExtractChange(e.target.checked)}
            className="mt-0.5 size-4 cursor-pointer rounded border-input accent-primary"
          />
          <div>
            <div className="text-sm font-medium">Use mock extract service</div>
            <div className="text-xs text-muted-foreground">
              Routes file-extraction calls to the mock service. Applies to presets only.
            </div>
          </div>
        </label>

        <div>
          <Button className="w-full" size="lg" onClick={onConnect}>
            <PlugIcon />
            Connect
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {selectedConfig
              ? "Signs in against the selected environment."
              : "Signs in with the current/default configuration."}
          </p>
        </div>

        {actionError && (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {actionError}
          </div>
        )}

        <Separator />

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Danger zone</p>
          <Button variant="destructive" size="sm" onClick={onClear}>
            <TrashIcon />
            Clear config &amp; sign out
          </Button>
          <p className="text-xs text-muted-foreground">
            Removes the saved dev config and ends the session, then reloads.
          </p>
        </div>
      </Card>
    </section>
  );
}

function ReviewField({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all text-sm">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preset selection — Production / Sandbox tabs
// ---------------------------------------------------------------------------

function AppGrid({
  apps,
  selectedConfig,
  onSelect,
}: Readonly<{
  apps: DevApp[];
  selectedConfig: DevAppConfig | null;
  onSelect: (app: DevApp) => void;
}>) {
  return (
    <div className="flex flex-col gap-3">
      {apps.map((app) => (
        <PresetCard
          key={app.config.apiBaseUrl}
          app={app}
          selected={isConfigSelected(selectedConfig, app.config)}
          onSelect={() => onSelect(app)}
        />
      ))}
    </div>
  );
}

function PresetCard({
  app,
  selected,
  onSelect,
}: Readonly<{ app: DevApp; selected: boolean; onSelect: () => void }>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={app.name}
      onClick={onSelect}
      className={cn(
        "relative flex w-full flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors outline-none hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      {selected && (
        <CheckCircleIcon
          weight="fill"
          className="absolute top-3 right-3 size-5 text-primary"
          aria-hidden
        />
      )}
      <span className="pr-6 font-medium">{app.name}</span>
      {app.description && <span className="text-sm text-muted-foreground">{app.description}</span>}
      <span className="w-full truncate font-mono text-xs break-all text-muted-foreground">
        {app.config.apiBaseUrl}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Custom configuration form
// ---------------------------------------------------------------------------

const EMPTY_CONFIG: DevAppConfig = {
  apiBaseUrl: "",
  authority: "",
  clientId: "",
  extractServiceUrl: undefined,
  renditionUri: undefined,
};

function CustomConfigForm({
  config,
  onChange,
}: Readonly<{ config: DevAppConfig | null; onChange: (c: DevAppConfig) => void }>) {
  const [savedCustomConfig, setSavedCustomConfig] = useState(loadSavedCustomConfig);
  const formConfig = config ?? savedCustomConfig ?? EMPTY_CONFIG;

  function update(partial: Partial<DevAppConfig>) {
    const next = { ...formConfig, ...partial };
    saveCustomConfig(next);
    setSavedCustomConfig(next);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-4">
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
        size="sm"
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
