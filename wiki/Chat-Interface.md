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
- **Regeneration Branch Navigation (`< 1 / 2 >`)**: Regenerating creates a new branch on the conversation tree. The branch switcher appears below the AI response for regeneration branches, allowing you to flip between alternative answers. Branches are persistent and restored across page reloads.
- **Active Branching in Go Prompt**: When you regenerate a turn, the Go agent constructs the LLM prompt using only the turns leading up to that point. The previous assistant response is excluded so the model receives a clean, unpolluted context to generate a fresh reply.

---

### 6. User Message Actions & Inline Editing

Each user message provides accessible action buttons below the message bubble:

- **Action Icons Row**: Dedicated Copy and Edit buttons sit directly beneath the user message bubble.
- **Timestamp Placement**: The message timestamp appears cleanly right below the action icons row.
- **Inline Editing**: Clicking the Edit button opens an inline editing card where you can revise your prompt. Press `Enter` to send, `Shift + Enter` for a new line, or `Escape` to cancel. You can also re-send without edits if desired.
- **Edit Branching**: Submitting an edited message preserves your previous branch and branches into a new conversation path where the previous AI response is cleared, giving the agent a clean turn to answer the updated prompt.
- **Edit Branch Navigation (`< 1 / 2 >`)**: For edit branches, the branch switcher (`< 1 / 2 >`) appears directly below the user message so you can switch between prompt versions anytime.
- **Prompt Isolation Across Branches**: When an earlier turn is edited, the Go backend builds the conversation prompt strictly from the active branch path. Any subsequent turns or discarded alternatives from other branches are omitted from the LLM prompt, ensuring the model never sees conflicting history from divergent branches.

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

### 11. Image Attachments, Camera Capture & Thinking Slider

The chat box features a versatile popup menu for adding media and managing model thinking directly from the composer:

- **Plus Icon Button**: A modern `+` button in the composer bar rotates into a cancel `✕` icon when open.
- **Animated Popup Above Chatbox**:
  - Pops up smoothly directly above the chat box with slide and fade animation.
  - **Capture image**: Opens a full live camera viewfinder directly in the app with snapshot preview, retake, photo confirmation, and camera switching.
  - **Pick image**: Quick access to browse and select images from your device library or files.
- **Thinking Slider**:
  - Located directly inside the `+` popup for the currently active AI model.
  - Interactive slider allowing you to switch between: **Off**, **Low**, **Med**, **High**, **Max**, and **Auto (Adaptive)**.
  - Automatically updates the model's thinking configuration and refreshes the gateway just like the Models management page.
- **Cross-Platform & Responsive**: Adapts seamlessly to all screen sizes, from smartwatches and smartphones to tablets, desktops, and Android TVs.



