export interface BrowserAutomationErrorDetails {
  [key: string]: unknown;
}

export class BrowserAutomationError extends Error {
  readonly category = "browser-automation";
  readonly details?: BrowserAutomationErrorDetails;

  constructor(message: string, details?: BrowserAutomationErrorDetails, cause?: unknown) {
    super(message);
    this.name = "BrowserAutomationError";
    this.details = details;
    if (cause) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}
