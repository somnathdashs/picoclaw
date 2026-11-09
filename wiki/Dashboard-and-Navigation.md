# Dashboard and Navigation

This guide introduces the PicoClaw dashboard interface, how the navigation menu is structured, and how to manage your chat conversations.

---

## 1. Overview Dashboard

The **Dashboard** (`/dashboard`) serves as your central command station. From this page, you can:
- **Control the Gateway**: Check whether the background engine is running, starting, or stopped, and start or stop it with a single click.
- **Top-Right Quick Actions**: Quickly refresh data or jump straight into the chat view via the **Refresh** and **Open Chat** buttons located in the top-right header. On smaller displays like smartwatches and smartphones, they collapse to clean icons to maximize viewing area.
- **Device State & Resource Usage**: Monitor live system health including total, used, and free RAM, available storage capacity, device thermal readings (in Celsius and Fahrenheit with status indicators), host specifications (OS, architecture, CPU count, uptime), and exact memory/storage consumed by PicoClaw.
- **View Active AI Models**: See which language model is currently active and ready to answer queries.
- **Monitor Automations**: Check how many scheduled tasks and commands are currently active.
- **Channel Shortcuts**: Quickly see the connection status of your favorite channels (WhatsApp, Telegram, Discord, Slack) and jump directly to their settings.
- **Recent Chat Sessions**: View your most recent conversations and pick up right where you left off.

---

## 2. Navigation Menu Structure

The application navigation is organized into two clean, focused views that adapt automatically based on where you are:

### A. Home / Workspace View
When interacting with your agent or dashboard, the navigation stays focused and clean:
- **Workspace Navigation**:
  - **Dashboard**: High-level health metrics, quick actions, and recent activity.
  - **Chat**: Real-time conversation with the AI agent.
  - **Automations**: Scheduled tasks, recurring prompts, and automatic system commands.
  - **More**: One-click jump into the Settings navigation, opening directly to **Models** (`/models`).
- **Sidebar Chat History (50 Recent Chats)**:
  - **Filter Popup Icon**: A dedicated filter icon button beside the chat history search bar opens a popup menu to filter sessions by type (**All Sessions** by default, **Web Chat**, or specific external channels such as **WhatsApp**, **Telegram**, **Discord**, etc.).
  - **Active Filter Indicator**: When a channel filter is applied, the filter icon highlights with an active indicator badge, and a quick-reset chip appears to return to "All" with a single click.
  - **Channel Badges & Icons**: Conversations originating from external channels display their respective brand icon (WhatsApp, Telegram, etc.) and a channel badge so you can easily distinguish conversations at a glance.
  - **Universal Session Loading**: All sessions work seamlessly irrespective of their origin. Clicking on any conversation (web or channel) immediately loads the conversation history into the chat view.
  - **Deep In-Message Search Bar**: Search input with real-time text matching powered by a lightweight SQLite FTS5 index. It searches across full conversation messages with weighted scoring (Title matches ranked highest, followed by user questions and assistant answers) and shows highlighted preview snippets.
  - **Recent Sessions**: Browse up to 50 recent chat sessions directly inside the sidebar. Click any session to switch to it immediately, with active session highlighting and hover deletion.
  - **View More**: Direct link at the bottom of the section opening the full Chat History management screen (`/chat-history`).
  - **Icon Mode Interaction**: When the sidebar is collapsed into icon mode, a clean search icon is displayed. Clicking it expands the navigation bar and focuses the search input.

### B. Setting Screen Navigation
When you click **More** or navigate into any settings or extension page, the sidebar presents its dedicated navigation bar:
- **Back to Chat**: A prominent header button at the top to easily return to your active conversation anytime.
- **Models Group** (Default View):
  - **Models**: Configure LLM providers and default models (`/models`).
  - **Credentials**: Manage API keys and authentication secrets safely (`/credentials`).
- **Channels Group**:
  - Direct links to configure Telegram, Discord, Slack, WhatsApp, Feishu, DingTalk, WeChat, QQ, Line, and Matrix.
  - Built-in **Show More / Show Less** toggle.
- **Agent Group**:
  - **Hub**: Explore agent templates and models (`/agent/hub`).
  - **Skills**: Manage installed and custom agent skills (`/agent/skills`).
  - **Tools**: Configure tool execution policies and MCP tools (`/agent/tools`).
- **Services Group**:
  - **Config**: Core system configuration and raw JSON/YAML views (`/config`).
  - **Logs**: Live system diagnostics and gateway event stream (`/logs`).

### Clean Design Details
- **No Expand/Collapse Toggles**: All group headers display simple, readable text labels without accordion chevrons.
- **Persistent Branding**: The official Pico logo icon anchors the top-left in icon mode, and reveals the full branding text image when expanded.
- **Adaptive Footer Controls**: Full Gateway card and utility controls in expanded mode; compact live indicator, conditional restart button, and popover info button in icon mode.

---

## 3. Chat Screen & History Management

- **Streamlined Conversation View**: History dropdowns and the bottom recent chats tray have been removed from the chat screen, keeping conversations focused while the sidebar handles history.
- **Session Types & Channel Integration**: Default web-based conversations are typed as `web`, while messages received via messaging channels are categorized by their source (`channel/whatsapp`, `channel/telegram`, etc.). The chat screen renders them uniformly.
- **Clear History Confirmation**: Safely wipe conversation history anytime with clear confirmation alerts preventing accidental loss.
- **Prominent New Chat**: The **New Chat** button is positioned in the top-right header for instant, single-click conversation starting.
- **Interactive Quick Starters**: On fresh chat sessions, the main conversation area displays interactive prompt suggestions for common tasks.
- **Unrestricted Free Scrolling**: Freely scroll up and read past messages at any time without auto-scroll interruptions. A floating **Latest messages** button appears when scrolled up to smoothly return to the bottom.
- **Dedicated Chat History Screen**: The full Chat History screen (`/chat-history`) offers category filter tabs (All, Web, Channels), deep in-message full-text search with weighted scoring (matches in titles ranked 10x higher, user prompts 3x higher, and assistant responses), preview snippet highlighting with relevance score badges, and session deletion. The top App Bar features an aligned layout with the **Clear All History** and **New Chat** action buttons—both automatically showing only clean icons on small screens (smartwatches/mobiles) and expanding to icon plus label on wider screens. For **All** and **Web Chat** views, the sender search option is cleanly hidden since sender phone numbers/chat IDs only apply to external messaging channels.
- **Temporary Chat Mode**: Turn on Temporary Chat in the header to chat without saving to session history, with configurable switches for **Use Memory** and **Save Memory & Files**.
- **Universal Responsiveness**: Fully responsive layout designed to load smoothly across all displays—from smart watches and mobile phones to tablets, desktops, and Android TV screens.
