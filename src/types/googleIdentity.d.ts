declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
    error?: string;
    error_description?: string;
  }

  interface TokenClientConfig {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }

  interface TokenClient {
    requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
  }

  function initTokenClient(config: TokenClientConfig): TokenClient;
  function revoke(accessToken: string, done?: () => void): void;
}

declare namespace google.accounts.id {
  interface CredentialResponse {
    credential: string;
  }

  interface IdConfiguration {
    client_id: string;
    callback: (response: CredentialResponse) => void;
  }

  function initialize(config: IdConfiguration): void;
  function renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

declare namespace google.accounts {
  const oauth2: typeof google.accounts.oauth2;
  const id: typeof google.accounts.id;
}

declare const google: {
  accounts: typeof google.accounts;
};

interface Window {
  google?: typeof google;
}
