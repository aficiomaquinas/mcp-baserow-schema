/**
 * Baserow 2FA authentication handler.
 *
 * Token lifecycle (confirmed from Baserow docs + community):
 * - access_token: 10 minutes (JWT, decoded from exp claim)
 * - refresh_token: 7 days
 * - temp_token: ~60 seconds (only for2FA verify step)
 *
 * Flow:
 * 1. POST /api/user/token-auth/ → temp token
 * 2. POST /api/two-factor-auth/verify/ → access_token + refresh_token
 * 3. POST /api/user/token-refresh/ → new access_token (using refresh_token)
 *
 * Strategy: re-login with2FA only when refresh_token expires (~7 days).
 * In between, use refresh_token to get new access_tokens silently.
 */
import { generateTOTP } from "./totp.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // actual JWT exp * 1000 (epoch ms)
  refreshExpiresAt: number; // refresh_token expiry (epoch ms)
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
  // Refresh access_token 2 minutes before expiry
  private static readonly ACCESS_BUFFER_MS = 120_000;
  // Re-login with2FA 5 minutes before refresh_token expiry
  private static readonly REFRESH_BUFFER_MS = 300_000;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Decode JWT payload to extract exp claim.
   */
  private decodeJwtPayload(token: string): { exp: number } {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT format");
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString(),
    );
    return { exp: payload.exp };
  }

  /**
   * Perform the full 2FA login flow.
   * 1. POST /api/user/token-auth/ → temp token
   * 2. POST /api/two-factor-auth/verify/ → JWT tokens
   */
  async loginWith2FA(): Promise<AuthTokens> {
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
      token: string;
      refresh_token: string;
    };

    const { exp } = this.decodeJwtPayload(verifyData.token);
    const now = Date.now();

    this.tokens = {
      accessToken: verifyData.token,
      refreshToken: verifyData.refresh_token,
      expiresAt: exp * 1000,
      // refresh_token valid for 7 days — store approximate expiry
      // We don't decode it (it might not be a JWT), so use 7 days from now
      refreshExpiresAt: now + 7 * 24 * 60 * 60 * 1000,
    };

    return this.tokens;
  }

  /**
   * Refresh access_token using refresh_token (no2FA needed).
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.tokens?.refreshToken) {
      throw new Error("No refresh token available");
    }

    const resp = await fetch(
      this.config.apiUrl + "/api/user/token-refresh/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refresh_token: this.tokens.refreshToken,
        }),
      },
    );

    if (!resp.ok) {
      // Refresh token expired or invalid — need full re-login
      throw new Error("Refresh failed: " + resp.status);
    }

    const data = (await resp.json()) as {
      token: string;
      refresh_token?: string;
    };

    const { exp } = this.decodeJwtPayload(data.token);

    this.tokens.accessToken = data.token;
    this.tokens.expiresAt = exp * 1000;

    // If a new refresh_token was issued, update it
    if (data.refresh_token) {
      this.tokens.refreshToken = data.refresh_token;
      this.tokens.refreshExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Get a valid access token, handling refresh and re-login as needed.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();

    // Case 1: No tokens at all → full login
    if (!this.tokens) {
      await this.loginWith2FA();
      return this.tokens!.accessToken;
    }

    // Case 2: refresh_token expired → full re-login with2FA
    if (now >= this.tokens.refreshExpiresAt - BaserowAuth.REFRESH_BUFFER_MS) {
      await this.loginWith2FA();
      return this.tokens!.accessToken;
    }

    // Case 3: access_token expired but refresh_token valid → silent refresh
    if (now >= this.tokens.expiresAt - BaserowAuth.ACCESS_BUFFER_MS) {
      try {
        await this.refreshAccessToken();
      } catch {
        // Refresh failed — fallback to full login
        await this.loginWith2FA();
      }
      return this.tokens!.accessToken;
    }

    // Case 4: token still valid
    return this.tokens.accessToken;
  }

  /**
   * Check if the current access_token is expired or about to expire.
   */
  isExpired(): boolean {
    if (!this.tokens) return true;
    return Date.now() >= this.tokens.expiresAt - BaserowAuth.ACCESS_BUFFER_MS;
  }

  /**
   * Get current auth status.
   */
  getStatus(): {
    authenticated: boolean;
    expiresAt?: string;
    isExpired: boolean;
    accessRemainingSeconds?: number;
    refreshRemainingDays?: number;
  } {
    if (!this.tokens) {
      return { authenticated: false, isExpired: true };
    }
    const now = Date.now();
    const accessRemaining = Math.max(0, Math.floor((this.tokens.expiresAt - now) / 1000));
    const refreshRemaining = Math.max(0, Math.floor((this.tokens.refreshExpiresAt - now) / (1000 * 60 * 60 * 24)));

    return {
      authenticated: true,
      expiresAt: new Date(this.tokens.expiresAt).toISOString(),
      isExpired: this.isExpired(),
      accessRemainingSeconds: accessRemaining,
      refreshRemainingDays: refreshRemaining,
    };
  }
}
