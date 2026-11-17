# Provider Credentials & Authentication Architecture

PicoClaw provides a unified authentication management system for three core model providers:

1. **OpenAI** (`openai`)
2. **Anthropic** (`anthropic`)
3. **Google Antigravity** (`google-antigravity`)

This document details how credential authentication, token storage, renewal, and API calls work for each of the three providers.

---

## 1. Provider Comparison & Authentication Methods

| Provider | Supported Methods | OAuth Endpoints / Authority | Token Refresh | Project / Account Metadata |
|---|---|---|---|---|
| **OpenAI** | Browser OAuth, Device Code, API Key / Token | `https://auth.openai.com` (Auth0) | Automatic via refresh token | `account_id` |
| **Anthropic** | API Key / Access Token | Direct Anthropic API (`api.anthropic.com`) | Static key (no refresh required) | N/A |
| **Google Antigravity** | Browser OAuth (PKCE), Manual redirect exchange | `https://accounts.google.com/o/oauth2/v2` | Automatic via Google OAuth2 token endpoint | `email`, `project_id` (retrieved from Cloud Code Assist) |

---

## 2. Deep Dive: How Each Credential Works

### A. OpenAI (`openai`)

PicoClaw supports three distinct authentication pathways for OpenAI:

1. **Browser OAuth (PKCE)**:
   - Client generates a cryptographic PKCE code verifier and SHA256 code challenge.
   - User is redirected to `https://auth.openai.com/authorize` with client ID `app_EMoamEEZ73f0CkXaXp7hrann` and scopes `openid profile email offline_access`.
   - On authorization, the redirect callback to `/oauth/callback` captures the authorization code and exchanges it for an access token and refresh token.
   - The token contains claims including the user's OpenAI `account_id`.

2. **Device Code Flow**:
   - Ideal for headless servers, Docker containers, and VPS environments without browser access.
   - PicoClaw calls OpenAI's device authorization endpoint to retrieve a verification URL (`https://auth0.openai.com/activate`) and an 8-character `user_code`.
   - PicoClaw polls the endpoint until the user confirms on another device.
   - Once authorized, access and refresh tokens are stored.

3. **Direct API Key / Access Token**:
   - The user provides an API key (`sk-...`) or session token via the Web UI or CLI.
   - Saved directly with `auth_method: "token"`.

---

### B. Anthropic (`anthropic`)

- **Authentication Method**: Direct API token (`sk-ant-...`).
- **Flow**:
  1. The user inputs their API key in the Web UI (`/credentials`) or via configuration.
  2. The key is validated and persisted to `~/.picoclaw/auth.json` with `auth_method: "token"`.
  3. When invoking Claude models (`claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`), PicoClaw sends standard Anthropic headers:
     ```http
     x-api-key: <token>
     anthropic-version: 2023-06-01
     ```

---

### C. Google Antigravity (`google-antigravity`)

Google Antigravity provides access to frontier models (Gemini 3 Flash, Gemini Pro, Claude Opus 4.6) via Google Cloud Code Assist infrastructure (`cloudcode-pa.googleapis.com`).

#### 1. OAuth Flow
- Authenticates via Google OAuth 2.0 with PKCE:
  - Scopes: `cloud-platform`, `userinfo.email`, `userinfo.profile`, `cclog`, `experimentsandconfigs`.
- On completion of the OAuth flow:
  1. PicoClaw calls `https://www.googleapis.com/oauth2/v1/userinfo` to obtain the authenticated email.
  2. PicoClaw invokes `https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist` to fetch the Google Cloud project ID (`cloudaicompanionProject`).
  3. Credentials are saved with access token, refresh token, expiry timestamp, project ID, and user email.

#### 2. Automatic Token Refresh
- Antigravity tokens expire after 1 hour.
- PicoClaw checks token validity with a 5-minute pre-expiry buffer. If expired or nearing expiration, `auth.RefreshAccessToken()` calls `https://oauth2.googleapis.com/token` to renew the access token without requiring user re-authentication.

#### 3. Client Version Requirements & The "Old Version" Fix
Google Cloud Code Assist validates the client version passed in request headers and payloads. If an outdated client version is detected, Google returns:
```
This version of Antigravity is no longer supported. Please update to receive the latest features!
```

**Resolution in PicoClaw**:
- Upgraded the base client version from legacy `1.15.8` to modern Antigravity 2.x (`2.8.1`).
- Updated both the HTTP `User-Agent` header and the request envelope `userAgent` to use the normalized signature:
  ```
  antigravity/2.8.1 <os>/<arch>
  ```
- Added `Client-Metadata` headers across all endpoints (`streamGenerateContent`, `loadCodeAssist`, `fetchAvailableModels`):
  ```json
  {"ideType":"IDE_UNSPECIFIED","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}
  ```
- Added dynamic environment variable override support:
  ```bash
  export PICOCLAW_ANTIGRAVITY_VERSION="2.8.1"
  ```
  If Google increments the minimum supported client version in the future, users can update the version instantly via environment variable without modifying or recompiling code.

---

## 3. Storage and Configuration Sync

All credentials are saved in `~/.picoclaw/auth.json`:

```json
{
  "version": 1,
  "credentials": {
    "openai": {
      "access_token": "...",
      "refresh_token": "...",
      "expires_at": "2026-11-10T12:00:00Z",
      "account_id": "org-...",
      "auth_method": "oauth"
    },
    "anthropic": {
      "access_token": "sk-ant-...",
      "auth_method": "token"
    },
    "google-antigravity": {
      "access_token": "ya29...",
      "refresh_token": "1//...",
      "expires_at": "2026-11-10T11:00:00Z",
      "email": "user@gmail.com",
      "project_id": "rising-fact-p41fc",
      "auth_method": "oauth"
    }
  }
}
```

When a credential is authenticated or logged out, PicoClaw automatically synchronizes the corresponding provider models in `~/.picoclaw/config.json`:
- Updating `auth_method` to `"oauth"` or `"token"`.
- Setting the provider's default model if not already present.
- Removing active credentials on logout and reverting to standard API key configuration.

---

## 4. CLI Usage

PicoClaw provides comprehensive CLI commands for credential management:

```bash
# Login to a provider
picoclaw auth login --provider openai
picoclaw auth login --provider antigravity
picoclaw auth login --provider anthropic

# List available models and quotas
picoclaw auth models

# Check credential connection status
picoclaw auth status

# Disconnect a provider
picoclaw auth logout --provider openai
picoclaw auth logout --provider antigravity
```

