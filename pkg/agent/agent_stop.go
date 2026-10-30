package agent

import (
	"context"
	"fmt"
	"strings"

	"github.com/sipeed/picoclaw/pkg/bus"
	"github.com/sipeed/picoclaw/pkg/commands"
	"github.com/sipeed/picoclaw/pkg/providers"
)

func (al *AgentLoop) tryHandleStopCommand(
	ctx context.Context,
	msg bus.InboundMessage,
	sessionKey string,
) bool {
	cmdName, ok := commands.CommandName(msg.Content)
	if !ok || cmdName != "stop" {
		return false
	}

	result, err := al.stopActiveTurnForSession(sessionKey)

	// This function is only called when loaded=true (another turn already
	// claimed this session). If stopActiveTurnForSession found a pending
	// placeholder but didn't stop it, that placeholder belongs to the other
	// message's worker which hasn't started yet — arm a pending stop so the
	// worker will bail when it checks before running.
	ts := al.getActiveTurnState(sessionKey)
	if err == nil && !result.Stopped {
		if ts != nil {
			snap := ts.snapshot()
			if strings.HasPrefix(snap.TurnID, pendingTurnPrefix) {
				al.markPendingStop(sessionKey)
				result.Stopped = true
			}
		}
	}

	reply := commands.FormatStopReply(result)
	if err != nil {
		reply = "Failed to stop task: " + err.Error()
	}

	if al.channelManager != nil {
		al.channelManager.InvokeTypingStop(msg.Channel, msg.ChatID)
	}
	al.resetMessageToolRound(sessionKey)
	al.PublishResponseIfNeeded(ctx, msg.Channel, msg.ChatID, sessionKey, reply)
	if agent := al.agentForSession(sessionKey); agent != nil && agent.Sessions != nil && reply != "" {
		history := agent.Sessions.GetHistory(sessionKey)
		if len(history) == 0 && ts != nil {
			ts.mu.RLock()
			uMsg := ts.userMessage
			uMedia := append([]string(nil), ts.media...)
			ts.mu.RUnlock()
			if strings.TrimSpace(uMsg) != "" || len(uMedia) > 0 {
				if len(uMedia) > 0 {
					agent.Sessions.AddFullMessage(sessionKey, providers.Message{
						Role:    "user",
						Content: uMsg,
						Media:   uMedia,
					})
				} else {
					agent.Sessions.AddMessage(sessionKey, "user", uMsg)
				}
				history = agent.Sessions.GetHistory(sessionKey)
			}
		}
		hasStop := len(history) > 0 && history[len(history)-1].Role == "assistant" &&
			(strings.Contains(history[len(history)-1].Content, "Task stopped") ||
				strings.Contains(history[len(history)-1].Content, "canceled"))
		if !hasStop {
			agent.Sessions.AddMessage(sessionKey, "assistant", reply)
		}
		_ = agent.Sessions.Save(sessionKey)
	}
	return true
}

func (al *AgentLoop) stopActiveTurnForSession(sessionKey string) (commands.StopResult, error) {
	sessionKey = strings.TrimSpace(sessionKey)
	if sessionKey == "" {
		return commands.StopResult{}, fmt.Errorf("session key is required")
	}

	result := commands.StopResult{}
	cleared := al.clearSteeringMessagesForScope(sessionKey)
	al.clearPendingSkills(sessionKey)

	ts := al.getActiveTurnState(sessionKey)
	if ts == nil {
		result.Stopped = cleared > 0
		return result, nil
	}

	snap := ts.snapshot()
	result.TaskName = snap.UserMessage

	if strings.HasPrefix(snap.TurnID, pendingTurnPrefix) {
		// A pending placeholder means this session is either idle (our own
		// placeholder from the /stop command) or another message is queued but
		// hasn't started yet. In both cases, we don't arm a pending stop here;
		// the caller (tryHandleStopCommand) handles the "another message queued"
		// case explicitly, since it knows loaded=true.
		return result, nil
	}

	if err := al.HardAbort(sessionKey); err != nil {
		if al.getActiveTurnState(sessionKey) == nil {
			result.Stopped = cleared > 0
			return result, nil
		}
		return commands.StopResult{}, err
	}

	result.Stopped = true
	return result, nil
}

func (al *AgentLoop) markPendingStop(sessionKey string) {
	sessionKey = strings.TrimSpace(sessionKey)
	if sessionKey == "" {
		return
	}
	al.pendingStops.Store(sessionKey, struct{}{})
}

func (al *AgentLoop) takePendingStop(sessionKey string) bool {
	sessionKey = strings.TrimSpace(sessionKey)
	if sessionKey == "" {
		return false
	}
	_, ok := al.pendingStops.LoadAndDelete(sessionKey)
	return ok
}

func (al *AgentLoop) resetMessageToolRound(sessionKey string) {
	if strings.TrimSpace(sessionKey) == "" {
		return
	}
	if registry := al.GetRegistry(); registry != nil {
		if agent := registry.GetDefaultAgent(); agent != nil {
			if tool, ok := agent.Tools.Get("message"); ok {
				if resetter, ok := tool.(interface{ ResetSentInRound(sessionKey string) }); ok {
					resetter.ResetSentInRound(sessionKey)
				}
			}
		}
	}
}
