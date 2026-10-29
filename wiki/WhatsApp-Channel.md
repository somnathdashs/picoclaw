# WhatsApp Channel Setup and Management

This page explains how to configure and link WhatsApp in PicoClaw directly from the web interface.

---

## 1. Connection Modes

PicoClaw supports two ways to connect to WhatsApp:

1. **Native (Recommended)**
   - Connects directly to WhatsApp using the built-in protocol engine (`whatsmeow`).
   - No external third-party servers or node bridges are required.
   - Stores session credentials securely in a local database (`workspace/whatsapp`).

2. **Bridge Mode**
   - Connects through an external WebSocket bridge URL (such as `ws://localhost:3001`).

---

## 2. Linking WhatsApp (Native Mode)

WhatsApp is available as a single unified channel under **Channels > WhatsApp**.

To pair your WhatsApp account:
1. Navigate to **Channels > WhatsApp**.
2. Make sure **Native Mode** is selected.
3. Click the **Start Linking** button. PicoClaw will initiate the pairing process.
4. Open WhatsApp on your mobile phone:
   - Tap **Settings** (or the three dots menu on Android).
   - Tap **Linked Devices**.
   - Tap **Link a Device**.
5. Scan the terminal / logs QR code.
6. Once connected, your paired phone number and WhatsApp name will automatically appear with a green **Linked / Paired** badge.

---

## 3. Unlinking and Deleting Sessions

If you ever need to disconnect your device or switch to another phone number:
1. Navigate to **Channels > WhatsApp**.
2. Click the **Unlink & Delete Session** button.
3. Confirm the dialog. PicoClaw will immediately remove the session store files and disconnect the session so you can pair fresh whenever desired.

---

## 4. Security and Allow-Lists

- **Allow From**: Specify an allow-list of phone numbers permitted to chat with the bot. Messages from unapproved numbers will be ignored.
- **Group Mention Only**: When the bot is added to WhatsApp groups, it will only respond when explicitly mentioned or when a message starts with a configured trigger prefix.
