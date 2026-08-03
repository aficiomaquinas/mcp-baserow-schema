/**
 * Baserow 2FA authentication handler.
 * Handles the full login flow: username/password → temp token → TOTP verify → JWT tokens.
 */
import { generateTOTP } from "./totp.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  token: string;
  userId?: number;
  email?: string;
  expiresAt: number; // Date.now() + expiry
}

export interface AuthConfig {
  apiUrl: string;
  username: string;
  password: string;
  totpSecret: string;
}

export class BaserowAuth {
  private config: AuthConfig;
  private tokens: AuthTokens | null = null;
  private static readonly TOKEN_EXPIRY_MS = 3_600_000; // 1 hour default

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Perform the full 2FA login flow.
   * 1. POST /api/user/token-auth/ → temp token
   * 2. POST /api/two-factor-auth/verify/ → JWT tokens
   */
  async authenticate(): Promise<AuthTokens> {
    // Step 1: Get temp token from username/password
    const tokenResp = await fetch(
      this.config.apiUrl + "/api/user/token-auth/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.config.username,
          password: this.config.password,
        }),
      },
    );

    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      throw new Error(
        "Token auth failed (" + tokenResp.status + "): " + err,
      );
    }

    const tokenData = (await tokenResp.json()) as { token: string };
    const tempToken = tokenData.token;

    // Step 2: Verify TOTP
    const totpCode = generateTOTP(this.config.totpSecret);

    const verifyResp = await fetch(
      this.config.apiUrl + "/api/two-factor-auth/verify/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + tempToken,
        },
        body: JSON.stringify({
          type: "totp",
          email: this.config.username,
          code: totpCode,
        }),
      },
    );

    if (!verifyResp.ok) {
      const err = await verifyResp.text();
      throw new Error(
        "TOTP verification failed (" + verifyResp.status + "): " + err,
      );
    }

    const verifyData = (await verifyResp.json()) as {
      access_token: string;
      refresh_token: string;
      token: string;
      user?: { id: number; email: string };
    };

    this.tokens = {
      accessToken: verifyData.access_token,
      refreshToken: verifyData.refresh_token,
      token: verifyData.token,
      userId: verifyData.user?.id,
      email: verifyData.user?.email ?? this.config.username,
      expiresAt: Date.now() + BaserowAuth.TOKEN_EXPIRY_MS,
    };

    return this.tokens;
  }

  /**
   * Get a valid access token, authenticating if necessary.
   */
  async getAccessToken(): Promise<string> {
    if (!this.tokens || this.isExpired()) {
      await this.authenticate();
    }
    return this.tokens!.token;
  }

  /**
   * Check if the current token is expired or about to expire.
   */
  isExpired(): boolean {
    if (!this.tokens) return true;
    // Consider expired if within 5 minutes of expiry
    return Date.now() >= this.tokens.expiresAt - 300_000;
  }

  /**
   * Get current auth status.
   */
  getStatus(): {
    authenticated: boolean;
    email?: string;
    userId?: number;
    expiresAt?: string;
    isExpired: boolean;
  } {
    if (!this.tokens) {
      return { authenticated: false, isExpired: true };
    }
    return {
      authenticated: true,
      email: this.tokens.email,
      userId: this.tokens.userId,
      expiresAt: new Date(this.tokens.expiresAt).toISOString(),
      isExpired: this.isExpired(),
    };
  }
}
