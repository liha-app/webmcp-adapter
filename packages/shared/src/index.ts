import type { AdapterDefinition, AdapterHealth, Capability } from '@liha/adapter-schema';
import type { ConfirmationRequest, RuntimePolicy, RuntimeStatus } from '@liha/adapter-runtime';

/** The MAIN-world runtime's global. Named explicitly so the page can be told what it is. */
export const RUNTIME_GLOBAL = '__LIHA_WEBMCP_ADAPTER__';

/** DOM event names used to reach the ISOLATED content script from the MAIN world. */
export const BRIDGE_REQUEST_EVENT = 'liha:bridge-request';
export const BRIDGE_RESPONSE_EVENT = 'liha:bridge-response';

/** Custom event the Adapter Store page dispatches to request an install. */
export const STORE_INSTALL_EVENT = 'liha:install-adapter';
export const STORE_STATE_EVENT = 'liha:store-state-request';
export const STORE_STATE_RESPONSE_EVENT = 'liha:store-state-response';

/**
 * Asking the extension how many elements a selector matches on an open page.
 *
 * An agent writing an adapter has to choose selectors, and without this it is
 * guessing: the page it is writing for is a different origin, so it cannot look.
 * Counts are all that crosses back — never text, never attributes, never the
 * page — which is enough to tell a usable selector from a wrong or an ambiguous
 * one, and not enough to read the page with.
 */
export const STORE_PROBE_EVENT = 'liha:probe-selectors';
export const STORE_PROBE_RESPONSE_EVENT = 'liha:probe-selectors-result';

export interface ProbeRequest {
  /** Correlates the answer with the question; two probes can be in flight. */
  requestId: string;
  origin: string;
  selectors: string[];
}

export interface ProbeOutcome {
  requestId: string;
  /** Selector to the number of elements matching it. */
  probe?: Record<string, number>;
  error?: string;
}

export type AdapterSource = 'builtin' | 'installed' | 'studio';

export interface AdapterRecord {
  adapter: AdapterDefinition;
  source: AdapterSource;
  enabled: boolean;
  installedAt: number;
  /** Confirmation policy chosen for this adapter at install time. */
  policy: RuntimePolicy;
}

export interface CatalogEntry {
  adapter: AdapterDefinition;
  source: AdapterSource;
  enabled: boolean;
  policy: RuntimePolicy;
  matchesCurrentOrigin: boolean;
}

export interface PopupState {
  url: string;
  origin: string | null;
  recording: RecordingState | null;
  catalog: CatalogEntry[];
  runtime: RuntimeStatus | null;
  runtimeError?: string;
}

/* -------------------------------------------------------------------------- */
/* Recorder                                                                    */
/* -------------------------------------------------------------------------- */

export interface RecordedAction {
  at: number;
  kind: 'click' | 'fill' | 'select' | 'check' | 'uncheck' | 'submit' | 'navigate';
  selector: string;
  /** Candidate selectors, best first, each with how many elements it matched. */
  candidates: Array<{ selector: string; strategy: string; matches: number }>;
  /** Present for value-bearing actions. Held in memory for the Studio only. */
  value?: string;
  label?: string;
  path?: string;
}

export interface RecordingState {
  tabId: number;
  origin: string;
  startedAt: number;
  /** Last document announced by the recording tab, used to capture navigation. */
  lastUrl: string;
  actions: RecordedAction[];
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                    */
/* -------------------------------------------------------------------------- */

export interface PageReadyMessage {
  type: 'liha/page-ready';
  href: string;
}
export interface GetStateMessage {
  type: 'liha/get-state';
}
export interface SetEnabledMessage {
  type: 'liha/set-enabled';
  adapterId: string;
  enabled: boolean;
}
export interface SetPolicyMessage {
  type: 'liha/set-policy';
  adapterId: string;
  policy: Partial<RuntimePolicy>;
}
export interface ConfirmRequestMessage {
  type: 'liha/confirm-request';
  request: ConfirmationRequest;
}
export interface RecorderModeMessage {
  type: 'liha/recorder-mode';
  active: boolean;
}
export interface ConfirmDecisionMessage {
  type: 'liha/confirm-decision';
  requestId: string;
  approved: boolean;
}
export interface GetConfirmationMessage {
  type: 'liha/get-confirmation';
  requestId: string;
}
export interface StartRecordingMessage {
  type: 'liha/start-recording';
}

export interface RecordingCommandOutcome {
  ok: boolean;
  error?: 'no-active-page' | 'bridge-unavailable';
}
export interface StopRecordingMessage {
  type: 'liha/stop-recording';
}
export interface RecordedActionMessage {
  type: 'liha/recorded-action';
  action: RecordedAction;
}
export interface GetRecordingMessage {
  type: 'liha/get-recording';
}
export interface InstallAdapterMessage {
  type: 'liha/install-adapter';
  adapter: unknown;
  source: AdapterSource;
  /** Set when the request came from a web page rather than extension UI. */
  fromOrigin?: string;
}
export interface RemoveAdapterMessage {
  type: 'liha/remove-adapter';
  adapterId: string;
}
export interface ListAdaptersMessage {
  type: 'liha/list-adapters';
}
export interface HealthMessage {
  type: 'liha/check-health';
}
export interface ProbeSelectorsMessage {
  type: 'liha/probe-selectors';
  origin: string;
  selectors: string[];
}

export type ExtensionMessage =
  | PageReadyMessage
  | GetStateMessage
  | SetEnabledMessage
  | SetPolicyMessage
  | ConfirmRequestMessage
  | RecorderModeMessage
  | ConfirmDecisionMessage
  | GetConfirmationMessage
  | StartRecordingMessage
  | StopRecordingMessage
  | RecordedActionMessage
  | GetRecordingMessage
  | InstallAdapterMessage
  | RemoveAdapterMessage
  | ListAdaptersMessage
  | HealthMessage
  | ProbeSelectorsMessage;

/** Shown before an adapter from a web page or the Studio is installed. */
export interface InstallConfirmationRequest {
  adapterId: string;
  adapterName: string;
  version: string;
  description?: string;
  origins: string[];
  source: AdapterSource;
  /** The page that asked for the install, when it was not extension UI. */
  fromOrigin?: string;
  /*
   * What each tool's steps actually do, counted rather than claimed.
   *
   * Capability is the author's declaration; these are measured from the steps.
   * A tool calling itself READ while its steps click three things is the shape
   * of a malicious adapter, and until this was shown the install screen gave a
   * reviewer no way to notice.
   */
  tools: Array<{
    name: string;
    capability: Capability;
    description: string;
    effects?: { clicks: number; inputs: number; submits: number; navigations: number; reads: number; readOnly: boolean };
  }>;
  /** True when the adapter needs host access the extension does not have yet. */
  needsHostPermission: boolean;
}

export type ConfirmationPayload =
  | { kind: 'tool'; request: ConfirmationRequest }
  | { kind: 'install'; request: InstallConfirmationRequest };

export interface PendingConfirmation {
  requestId: string;
  payload: ConfirmationPayload;
}

export interface StoreStateResponse {
  installed: Array<{
    id: string;
    name: string;
    version: string;
    enabled: boolean;
    source: AdapterSource;
    /*
     * The exact origins this adapter may touch, and the tools on it — sent only
     * where the page already knows them.
     *
     * A web page does not need an inventory of which private services someone
     * has adapters for. The extension sends these for the adapters it ships,
     * which are public, and for the newest Studio build, which is what the
     * guided walkthrough is showing the person who just made it. Everything
     * else arrives as a name and a state.
     */
    origins?: string[];
    /**
     * Enough of each tool to say what it is and how to call it. The guided
     * walkthrough on the portal reads this to hand someone a snippet that
     * runs the tool they just built, rather than one they have to fill in.
     */
    tools?: Array<{ name: string; capability: Capability; required: string[] }>;
    health: AdapterHealth | null;
  }>;
}
