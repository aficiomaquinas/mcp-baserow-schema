/**
 * Baserow 2FA authentication handler.
 * Handles the full login flow: username/password → temp token → TOTP verify → JWT tokens.
 * Auto-refreshes before actual expiry using the JWT exp claim.
 */
import { generateTOTP } from "./totp.js";

export interface AuthTokens {
  token: string;
  refreshToken: string;
  userId?: number;
  email?: string;
  expiresAt: number; // actual JWT exp * 1000 (epoch ms)
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
  // Refresh 2 minutes before actual expiry
  private static readonly REFRESH_BUFFER_MS = 120_000;

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
      token: string;
      refresh_token: string;
      user?: { id: number; email: string };
    };

    // Extract actual expiry from JWT
    const { exp } = this.decodeJwtPayload(verifyData.token);

    this.tokens = {
      token: verifyData.token,
      refreshToken: verifyData.refresh_token,
      userId: verifyData.user?.id,
      email: verifyData.user?.email ?? this.config.username,
      // exp is in seconds, convert to ms
      expiresAt: exp * 1000,
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
    // Refresh 2 minutes before actual expiry
    return Date.now() >= this.tokens.expiresAt - BaserowAuth.REFRESH_BUFFER_MS;
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
    remainingSeconds?: number;
  } {
    if (!this.tokens) {
      return { authenticated: false, isExpired: true };
    }
    const remainingMs = this.tokens.expiresAt - Date.now();
    return {
      authenticated: true,
      email: this.tokens.email,
      userId: this.tokens.userId,
      expiresAt: new Date(this.tokens.expiresAt).toISOString(),
      isExpired: this.isExpired(),
      remainingSeconds: Math.max(0, Math.floor(remainingMs / 1000)),
    };
  }
}
