# Credentials and Authentication

This guide explains how to connect and manage credentials for your AI model providers in PicoClaw.

---

## Overview

PicoClaw supports three main AI provider credentials from the **Credentials** settings screen (`/credentials`):

1. **OpenAI** (ChatGPT & Codex models)
2. **Anthropic** (Claude models)
3. **Google Antigravity** (Gemini & Claude frontier models via Google Cloud Code Assist)

Each credential card displays your current connection status, account email or project ID, and available login methods.

---

## 1. OpenAI

OpenAI can be connected using three different methods depending on where you run PicoClaw:

* **Browser Login (Recommended for Desktop)**: Click **Browser** to open OpenAI's sign-in page. After authorizing in your browser, you are automatically logged in.
* **Device Code (Recommended for Servers & Remote Machines)**: Click **Device Code** to generate an 8-character user code. Open `https://auth0.openai.com/activate` in any browser, enter the code, and confirm. PicoClaw connects automatically once authorized.
* **API Key / Token**: Paste your OpenAI API key or session access token into the input field and click **Save Token**.

To disconnect or switch accounts, click **Logout**.

---

## 2. Anthropic (Claude)

Anthropic uses direct API Key authentication:

* **API Key**: Enter your Anthropic API key (`sk-ant-...`) in the token field and click **Save Token**.
* Once saved, your Claude models (`claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`) can be used across chat sessions and automations.
* To revoke or change your key, click **Logout**.

---

## 3. Google Antigravity

Google Antigravity connects your Google Account to access Gemini models and Claude frontier models via Google's Cloud Code Assist infrastructure.

### Connecting Antigravity:
* Click **Browser** on the Google Antigravity card.
* Sign in with your Google account in the browser tab that opens and grant the requested permissions.
* Once completed, PicoClaw automatically fetches your **Google Cloud Project ID** and **Account Email**.
* Your connection status will update to **Connected**.

### Upgraded Client Version & Troubleshooting:
* Google Cloud Code Assist requires modern Antigravity client versions (2.x+). PicoClaw is updated to use the latest client signature (`2.8.1`).
* If you ever receive a message stating that your version is outdated, you can override the version number at any time by setting the environment variable:
  ```bash
  export PICOCLAW_ANTIGRAVITY_VERSION="2.8.1"
  ```
* For headless servers or VPS environments where local browsers cannot open automatically, copy the login link from the terminal, sign in on your personal computer, and paste the redirected URL back into PicoClaw.

---

## Security & Storage

* Credentials are saved locally on your device in `~/.picoclaw/auth.json`.
* Tokens are refreshed automatically before expiring so you stay signed in seamlessly.
* Sensitive keys are never transmitted to third parties and can optionally be encrypted on disk using PicoClaw's credential encryption.

