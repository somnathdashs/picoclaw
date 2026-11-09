# Automations and Scheduled Tasks

The Automations screen allows you to schedule commands and AI prompts to run automatically at predetermined times or intervals, delivering results to any configured messaging channel.

---

## 1. Types of Automations

You can create two main types of automated jobs:
- **Shell Commands**: Runs local system commands (such as checking disk space, checking server uptime, or running scripts) and automatically sends the output to your desired recipient.
- **Agent Prompts**: Asks your AI assistant a prompt on schedule (for example, generating a daily morning briefing or weekly summary).

---

## 2. Trigger Schedules

You can trigger tasks in three flexible ways:
1. **Interval**: Runs repeatedly every *N* minutes, hours, or seconds (e.g., every 30 minutes).
2. **Cron Expression**: Uses standard cron syntax for complex schedules (e.g., `0 9 * * *` for every morning at 9:00 AM). Common presets are available with one click.
3. **Specific Date & Time**: Runs once at an exact date and time (with an optional setting to automatically remove the task after execution).

---

## 3. Multi-Channel Output Delivery

Automations can deliver their execution results to any of your configured channels:
- **Target Channel**: Select WhatsApp, Telegram, Discord, Slack, or CLI.
- **Recipient Destination**: Specify the phone number, user ID, or channel ID where the message should be delivered.

---

## 4. Managing Automations

From the Automations screen, you can:
- **Top-Right Quick Actions**: Trigger **Refresh** or create a **New Automation** directly from the top-right header. On smaller screens (smartwatches and phones), these controls collapse into clean icons to conserve screen space.
- **Default Active View**: The automations page opens to the **Active** filter tab by default, showing your enabled schedules immediately. You can switch to **All** or **Paused** anytime.
- **Grid and List View**: Toggle between a card grid view and a compact horizontal list view using the layout icon button next to the filter tabs.
- **Create**: Click **New Automation** and fill in the user-friendly form.
- **Edit**: Update the schedule, command, message, or delivery destination at any time.
- **Enable / Pause**: Toggle tasks on or off with a single switch.
- **Run Now**: Manually trigger any task immediately to test its execution.
- **Execution History**: Click the History icon on any automation card to inspect its past execution logs, including execution timestamps, duration in milliseconds, status (Success, Running, or Failed), and detailed error reports.
- **Isolated from Chat History**: Scheduled automation runs operate in their own execution loop and do not clutter your standard chat conversations.
- **Delete**: Remove tasks you no longer need.
