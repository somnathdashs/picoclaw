# Voice Agent Guide

PicoClaw includes a built-in client-side **Voice Agent** that allows you to speak to your assistant using your microphone and listen to assistant responses aloud.

---

### Accessing Voice Settings

You can find the Voice settings in two ways:
1. **Sidebar Navigation**: In the left sidebar under the **Agent** group (alongside Hub, Skills, and Tools), click **Voice**.
2. **Config Page**: Go to the **Config** page and locate the **Voice Agent** summary card, then click **Configure Voice Agent**.

---

### Tabbed Layout & Instant Auto-Save

Every setting you toggle or adjust is **auto-saved instantly** to your browser's persistent storage and applies immediately to the chat interface. A real-time **Auto-saved** badge in the header confirms your settings are active.

The Voice page features two tabs for convenient setup:

#### 1. TTS (Voice out) - Text-to-Speech
Controls how PicoClaw speaks messages back to you:
- **System Option**: Uses your device's built-in voices. Works completely offline.
- **Edge API Option**: Uses Microsoft Edge cloud neural voices for expressive, human-like speech in dozens of languages and accents, backed by a local proxy.
- **Voice Customization**: Adjust speech speed (rate), pitch, and volume to match your preferred listening pace.
- **Auto-read when user used mic**: Automatically speaks incoming assistant responses aloud only when you asked using microphone voice input. If you typed your message, responses remain silent unless you click the speaker button.
- **Interactive Audio Tester**: Type sample text and preview any voice before using it in chat.

#### 2. STT (Voice in) - Speech-to-Text
Controls how your microphone captures speech:
- **System Option**: Powered by your browser's native speech recognition for instant, low-latency dictation.
- **Language Selection**: Choose your preferred spoken language or let it match your system default.
- **Continuous Dictation**: Keeps listening through sentence pauses until you click the microphone button again.
- **Live Interim Results**: Displays your words in real time as you speak.
- **Auto-Send on Speech**: Automatically sends your message when you finish speaking for a hands-free conversation.
- **Microphone Test Zone**: Test your microphone and verify speech recognition accuracy right on the settings page.

---

### Using Voice in Chat

- **To Speak**: Click the microphone icon on the right side of the chat composer. Speak clearly, and your words will appear in the input box. Click again to stop dictation.
- **To Listen**: Every assistant reply features a sound icon at the bottom. Click it anytime to read the response aloud or stop playback.
- **Smart Mic Auto-Read**: With **Auto-read when user used mic** enabled, speaking with the mic will automatically read the response back to you once finished.
