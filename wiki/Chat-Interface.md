# Chat Interface
 
The PicoClaw chat interface offers a sleek, real-time interactive experience with intelligent models, transparent reasoning, and tool execution visibility.
 
---
 
### 1. Live Thought Process (Reasoning)
 
When using models capable of reasoning (thinking), PicoClaw visualizes the thought process in real time:
 
- **Active Streaming**: While the assistant is reasoning, a soft violet container displays "Thinking…" with an active spinner and live token counter.
- **Thought Review**: After reasoning completes, you can review the reasoning steps anytime.
- **Quick Copy**: A copy button lets you easily copy the thought process to the clipboard.
 
---
 
### 2. Tool Calls & Execution
 
When PicoClaw uses tools (such as reading files, running terminal commands, searching the web, or editing files), every action is displayed clearly:
 
- **Tool Icons**: Each tool category has a dedicated icon (terminal for commands, document for reading files, pencil for editing, globe for web search, folder for directory exploration, etc.).
- **Human-Friendly Actions**: Displays clean action descriptions such as "Viewing file", "Running command", or "Editing file".
- **Target Snippets**: Shows the specific file name, command line, or search query for quick identification.
- **Diff Stats**: For file modifications, compact green `+` and red `-` line counters show changes made.
- **Expandable Parameters**: Clicking any individual tool row reveals the full parameters and execution feedback.
- **Execution Output & Returns**: Expandable Return blocks display formatted results (e.g., web search results, command terminal output, or file contents) with clear, contextual status rather than generic success text.
 
---

### 3. Smart Full-Width Worked Widget

To keep the chat clean, consistent, and easy to read across all screen sizes (from smart watches to desktop and Android TV):

- **Header Above the Widget**: The AI generation metadata ("PicoClaw • model_name • timestamp") appears above the worked widget, clearly identifying the model and start time before execution begins.
- **Always Full Width**: The "Worked for..." / "Working..." card always maintains a stable full-width layout, preventing dynamic width jumps when opening reasoning or tool results.
- **Diff Counter Badges**: When tools modify or create files, the aggregate diff `+added / -removed` appears in the header badge.
- **While Generating (Live)**: Tool executions and reasoning stay expanded so you can monitor agent progress in real time.
- **When Finished**: As soon as the agent completes or begins the final response, execution details collapse into a compact summary header.
- **Interactive Control**: You can click anywhere on the header to expand or collapse details.

---

### 4. Interactive Stop & Mid-Turn Steering

- **Stop / Interrupt**: When the agent is running and the composer is empty, the send button transforms into a stop button. Clicking it halts agent execution and appends a "User interrupted." assistant message.
- **Mid-Turn Messages**: If you type a message while the agent is still working, the send button remains accessible. Sending your prompt injects it directly into the agent's steering queue so the agent can take it into account between work iterations.

---

### 5. Response Actions & Branching

Each assistant response provides quick actions at the bottom:

- **Copy**: One-click copying of the full message content with instant visual feedback.
- **Read Aloud (Text to Speech)**: Listen to responses with natural browser voice playback. Click again anytime to pause or stop.
- **Regenerate Response**: Request a fresh response with a safe confirmation dialog so work is never lost accidentally.
- **Regeneration Branch Navigation (`< 1 / 2 >`)**: Regenerating creates a new branch on the conversation tree. The branch switcher appears below the AI response, allowing you to flip between alternative answers. All branches are managed and saved on the gateway, so they remain fully intact across page reloads and tab switches.
- **Active Branching on Gateway**: When you switch or regenerate a turn, the gateway automatically updates the session's active branch so the AI receives only the clean conversation history leading up to that point.

---

### 6. User Message Actions & Inline Editing

Each user message provides accessible action buttons below the message bubble:

- **Action Icons Row**: Dedicated Copy and Edit buttons sit directly beneath the user message bubble.
- **Timestamp Placement**: The message timestamp appears cleanly right below the action icons row.
- **Inline Editing**: Clicking the Edit button opens an inline editing card where you can revise your prompt. Press `Enter` to send, `Shift + Enter` for a new line, or `Escape` to cancel. You can also re-send without edits if desired.
- **Edit Branching**: Submitting an edited message preserves your previous branch and creates a new path. The gateway tracks both versions, allowing you to switch between different prompts anytime.
- **Edit Branch Navigation (`< 1 / 2 >`)**: For edit branches, the branch switcher appears below the user message. Switching branches updates the active conversation path on the gateway, and the frontend simply fetches and displays the chosen branch.
- **Persistent Branch History**: Because branch trees and active branch indices are stored directly on the gateway, your branch navigation buttons and alternative message paths never disappear on page refresh or when switching browser tabs.

---

### 7. Protected Temporary Chat Mode

- **Safe Stateless Chat**: Temporary chat allows ephemeral conversations without saving history to disk or database.
- **Locked Memory Switches**: Once a temporary conversation begins, memory and filesystem switches are locked to prevent accidental state changes.
- **Exit Protection**: Attempting to turn off temporary mode while messages exist presents a confirmation dialog warning that temporary messages will disappear.

---

### 8. Chat History & Session Management

- **Responsive App Bar**: Designed to look clean and organized on every screen size from smartwatch viewports to mobile, tablet, and Android TV. Controls collapse into accessible icon buttons on small screens and expand on larger displays.
- **Grid & List Views**: A view mode switcher lets you toggle between spacious visual cards (Grid View) and dense, informative rows (List View). Your chosen preference is automatically remembered.
- **Sender & Channel Filtering**: Easily organize conversations by channel (Web, WhatsApp, Telegram, Discord, etc.) and filter by sender (e.g. phone numbers for WhatsApp or chat IDs/usernames for Telegram).
- **Session Export & Delete**: The More Options (`...`) menu in both the navigation sidebar and the Chat History screen allows you to download complete conversations as formatted Markdown files (`.md`) or safely delete individual sessions with a confirmation prompt.

---

### 9. Responsive Model Selector

- **Adaptive Sizing**: Fits seamlessly into the top bar across all screens—from Android smartwatches (~160px) to smartphones, tablets, desktops, and Android TV (1600px+). On smaller screens, action buttons collapse into icons to give the model picker maximum room.
- **Instant Search & Filter**: A built-in search bar lets you find models or providers by typing.
- **Categorized Groups**: Filter chips allow one-tap switching between All, API Key, OAuth, and Local models.
- **Keyboard & Remote Navigation**: Supports arrow key and D-pad navigation for smooth control on Android TV and keyboard-driven setups.

---

### 10. Custom Model Rules (RULES.md)

PicoClaw lets you define persistent custom rules and instructions that guide model behavior across all chat sessions:

- **Quick Access from Chat**: Click the Rules icon button right beside the "New Chat" button in the top bar to open options and select **Rules**.
- **Slide-Over Panel**: Opens a smooth right-side panel without interrupting your active conversation.
- **Global Rules (`RULES.md`)**: Configure custom rules in Markdown format. If empty, the model uses default instructions.
- **Edit & Live Markdown Preview**: Easily write your instructions with the built-in editor or switch to the Preview tab to review how your rules render.
- **Starter Template**: Click the Starter Template button to instantly insert helpful baseline guidelines for response style, conciseness, and tool usage.
- **Fast Save & Keyboard Shortcut**: Save changes immediately with the Save button or press `Ctrl+S` (`Cmd+S`). Rules are automatically injected into the model's prompt on every turn.
- **Responsive Layout**: Designed to adapt gracefully from smartwatches and mobile screens up to desktop monitors and Android TVs.

---

### 11. Attachments, Workspace File Upload, Camera Capture & Thinking Slider

The chat box features a versatile popup menu for adding media and managing model thinking directly from the composer:

- **Plus Icon Button**: A modern `+` button in the composer bar rotates into a cancel `✕` icon when open.
- **Animated Popup Above Chatbox**:
  - Pops up smoothly directly above the chat box with slide and fade animation.
  - **Upload to workspace**: Directly upload any file into the agent's workspace directory. Uploaded files are automatically linked to the user's message using standard `[file:<filename>]` channel tags, making them immediately accessible to agent tools like reading, editing, and analysis.
  - **Capture image**: On Android devices, tapping the camera button launches the native Android system camera directly. On desktop and other platforms, it opens a live browser viewfinder with snapshot preview, retake, and photo confirmation.
  - **Clean Tooltip Experience**: Attachment button tooltips only show when explicitly hovered over, keeping the interface uncluttered upon opening the popup.
  - **Pick image**: Quick access to browse and select images from your device library or files.
- **Thinking Slider**:
  - Located directly inside the `+` popup for the currently active AI model.
  - Interactive slider allowing you to switch between: **Off**, **Low**, **Med**, **High**, **Max**, and **Auto (Adaptive)**.
  - Automatically updates the model's thinking configuration and refreshes the gateway just like the Models management page.
- **Cross-Platform & Responsive**: Adapts seamlessly to all screen sizes, from smartwatches and smartphones to tablets, desktops, and Android TVs.

---

### 12. Slash Commands (`/`) Autocomplete & Visual Highlighting

The composer provides instant discoverability and visual cues when using built-in agent slash commands:

- **Autocomplete Popup on `/`**:
  - Typing `/` anywhere in the chat box opens a clean suggestions list directly above the composer.
  - Matches filter live as you type the command keyword (e.g. `start`, `help`, `stop`, `clear`, `context`, `btw`, `show model`, `list models`, `switch model`, etc.).
  - Clean, minimal row format showing the command name and description side by side without clutter.
  - Fully navigable with keyboard (`↑` and `↓` arrow keys to move, `Enter` or `Tab` to select, `Esc` to dismiss) and tap/click friendly on mobile and touch devices.
- **Visual Command Highlighting in Chatbox**:
  - Valid command tokens (such as `/<command>`) render with distinct violet chip tag styling with subtle borders directly inside both the composer and user message bubbles.
  - Arguments and ordinary prompt text remain in standard font color, making it easy to distinguish commands from message parameters.
- **Responsive Across Screens**:
  - Scales gracefully from smartwatches and mobile viewports up to Android TVs with remote/D-pad navigation support.

---

### 13. Skill Suggestions (`#`) & Visual Highlighting

Quickly reference and invoke installed agent skills directly from the chat box:

- **Autocomplete Popup on `#`**:
  - Typing `#` opens an interactive skills suggestion popup immediately above the composer.
  - Dynamically filters installed skills as you type (e.g. `#weather`, `#github`, `#summarize`, `#tmux`, `#skill-creator`, etc.).
  - Displays skill names and clean descriptions without category tags on the right for a streamlined, focused look.
  - Supports keyboard navigation (`↑`/`↓` to cycle, `Enter` or `Tab` to select, `Esc` to dismiss) as well as touch/mouse selection.
- **Visual Skill Highlighting in Chatbox**:
  - Skill tokens (such as `&#35;<skill-name>`) render with distinct amber/gold chip tag styling with subtle borders inside both the composer text field and user message bubbles.
  - Commands (`/<cmd>`) and skills (`#<skill>`) remain visually distinct from each other and from regular query text.
- **Cross-Platform Responsive**:
  - Adapts to small watch viewports, mobile screens, tablets, desktops, and TV interfaces with remote control navigation.

---

### 14. File Preview Side Panel & Upload Experience

PicoClaw provides an integrated slide-over preview panel to inspect files and attachments without leaving the chat:

- **Click-to-Preview**:
  - Click on any file chip, document tag, or media thumbnail in user messages, assistant responses, or composer drafts to open the preview panel on the right side.
- **Full-Bleed View Area**:
  - The preview area fills the entire panel below the top header with zero wasted outer padding. Download and close buttons are integrated directly into the clean top bar.
- **Resizable on Large Screens**:
  - On desktop and tablet viewports, you can drag the left border handle horizontally to expand or shrink the panel to your preferred width. On mobile screens, it opens as a focused full-width overlay. Both the File Preview Panel and Custom Rules Panel support this smooth resizing.
- **Multi-Format Previews**:
  - **PDF Documents**: Clean, borderless embedded PDF viewer.
  - **Word Documents (`.docx`, `.doc`)**: Clean document rendering formatted directly in-browser.
  - **Excel Spreadsheets (`.xlsx`, `.xls`, `.csv`, `.tsv`)**: Interactive multi-sheet workbook viewer with sheet tabs, row filtering search, and numbered tables.
  - **SVG Graphics**: Dedicated dual-view tabs with visual **Preview** and formatted **SVG Code** tabs.
  - **Source Code**: Full syntax highlighting with official programming language colors, sticky line numbers, line wrap toggle, and one-click copy.
  - **Markdown**: Formatted render tab with toggle to inspect raw Markdown code.
  - **Images, Audio & Video**: Native media playback with responsive scaling.
- **Centered Fallback for Unsupported Files**:
  - For formats without in-browser rendering (e.g. binaries, archives, CAD, proprietary data), the panel displays a centered view with the file extension logo badge, file name, formatted `(size)` in parentheses, and a direct download button.
- **Upload Progress in Composer**:
  - While uploading files in the chat box, an animated circular progress indicator is shown in place of the close (`✕`) button. Once the upload finishes successfully, the cross icon appears so you can remove the attachment if desired. If an upload fails, the item is removed automatically and an error notification is displayed.

---

### 15. Right-Side Browser Viewport (Live Browser, Antigravity Click Ripples & Agent Watch Mode)

PicoClaw includes an integrated **Browser Viewport** that opens neatly on the right side of the chat interface, giving users a seamless browser window that reflects automated browser actions in real time:

- **Quick Access via Top Bar & Menu**:
  - Click the **Browser** button in the chat header or select it from the More Options (`...`) menu anytime to toggle the panel.
  - When the AI assistant executes browser automation commands, the Browser Viewport automatically opens with an active glowing indicator.
- **Unified Live Viewport**:
  - Direct, full-bleed interactive browser window with URL address bar, Back, Forward, Reload, and URL copy controls.
  - Built-in **Gateway Proxy**: Automatically routes browsing through the backend gateway proxy to bypass strict `X-Frame-Options` and `Content-Security-Policy` header restrictions on external websites and LAN servers.
  - Quick preset buttons for Gateway Home, `/health`, `/ready`, and the active AI target website.
  - Multi-device viewport selector: Switch between Desktop, Tablet (768px), Mobile (375px), and Watch (200px) viewports to test web layouts across all display sizes.
- **Antigravity-Style Big Cursor & Click Animation**:
  - Whenever a click occurs—whether triggered by the AI assistant (`click @e1`) or by the user—a prominent high-contrast cursor pointer appears accompanied by expanding concentric ripple rings and an action tag displaying the target element or ref.
  - Includes a dedicated **Simulate Click** button in the toolbar to test and preview the Antigravity click animation at any time.
- **Agent Watch Mode Lock**:
  - When the AI is actively controlling the site, the viewport automatically engages **Watch Mode**:
  - User controls are temporarily locked so you can sit back and watch the AI drive the browser without accidental interference.
  - Displays a live status banner with current command execution (e.g. `$ agent-browser click @e1`).
  - Once the AI finishes its turn, interactive control is immediately returned to the user.
- **Responsive on All Devices**:
  - Automatically adapts from smartwatch viewports (< 300px) and smartphones to tablets, desktops (with drag-to-resize handle), and Android TV.




