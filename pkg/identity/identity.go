// Package identity provides unified user identity utilities for PicoClaw.
// It introduces a canonical "platform:id" format and matching logic
// that is backward-compatible with all legacy allow-list formats.
package identity

import (
	"strings"

	"github.com/sipeed/picoclaw/pkg/bus"
)

// BuildCanonicalID constructs a canonical "platform:id" identifier.
// Both platform and platformID are lowercased and trimmed.
func BuildCanonicalID(platform, platformID string) string {
	p := strings.ToLower(strings.TrimSpace(platform))
	id := strings.TrimSpace(platformID)
	if p == "" || id == "" {
		return ""
	}
	return p + ":" + id
}

// ParseCanonicalID splits a canonical ID ("platform:id") into its parts.
// Returns ok=false if the input does not contain a colon separator.
func ParseCanonicalID(canonical string) (platform, id string, ok bool) {
	canonical = strings.TrimSpace(canonical)
	idx := strings.Index(canonical, ":")
	if idx <= 0 || idx == len(canonical)-1 {
		return "", "", false
	}
	return canonical[:idx], canonical[idx+1:], true
}

// MatchAllowed checks whether the given sender matches a single allow-list entry.
// It is backward-compatible with all legacy formats:
//
//   - "123456"              → matches sender.PlatformID
//   - "@alice"              → matches sender.Username
//   - "123456|alice"        → matches PlatformID or Username
//   - "telegram:123456"     → exact match on sender.CanonicalID
func MatchAllowed(sender bus.SenderInfo, allowed string) bool {
	allowed = strings.TrimSpace(allowed)
	if allowed == "" {
		return false
	}

	// Try canonical match first: "platform:id" format
	if platform, id, ok := ParseCanonicalID(allowed); ok {
		// Only treat as canonical if the platform portion looks like a known platform name
		// (not a pure-numeric string, which could be a compound ID)
		if !isNumeric(platform) {
			candidate := BuildCanonicalID(platform, id)
			if candidate != "" && sender.CanonicalID != "" && strings.EqualFold(sender.CanonicalID, candidate) {
				return true
			}
			if strings.EqualFold(platform, sender.Platform) {
				if sender.PlatformID == id {
					return true
				}
				if strings.EqualFold(platform, "whatsapp") {
					senderDigits := extractPhoneDigits(sender.PlatformID)
					idDigits := extractPhoneDigits(id)
					if senderDigits != "" && senderDigits == idDigits {
						return true
					}
				}
			}
			return false
		}
	}

	// Keep track of explicit username format
	isAtUsername := strings.HasPrefix(allowed, "@")

	// Strip leading "@" for username matching
	trimmed := strings.TrimPrefix(allowed, "@")

	// Split compound "id|username" format
	allowedID := trimmed
	allowedUser := ""
	if idx := strings.Index(trimmed, "|"); idx > 0 {
		allowedID = trimmed[:idx]
		allowedUser = trimmed[idx+1:]
	}

	// Match against PlatformID
	if sender.PlatformID != "" && sender.PlatformID == allowedID {
		return true
	}

	// Match against Username only when explicitly requested via "@username"
	if isAtUsername && sender.Username != "" && sender.Username == trimmed {
		return true
	}

	// Match compound sender format against allowed parts
	if allowedUser != "" && sender.PlatformID != "" && sender.PlatformID == allowedID {
		return true
	}
	if allowedUser != "" && sender.Username != "" && sender.Username == allowedUser {
		return true
	}

	// For WhatsApp, match phone digits across formats (+91..., 91..., ...@s.whatsapp.net, whatsapp:...)
	if sender.Platform == "whatsapp" {
		senderDigits := extractPhoneDigits(sender.PlatformID)
		allowedDigits := extractPhoneDigits(allowedID)
		if senderDigits != "" && senderDigits == allowedDigits {
			return true
		}
	}

	return false
}

func extractPhoneDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// isNumeric returns true if s consists entirely of digits, allowing for an optional leading minus sign
// (required for Telegram group/channel IDs like -1001234567890).
func isNumeric(s string) bool {
	if s == "" {
		return false
	}
	start := 0
	if s[0] == '-' && len(s) > 1 {
		start = 1
	}
	for i := start; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}
