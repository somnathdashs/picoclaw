package api

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type searchDBManager struct {
	mu  sync.Mutex
	dbs map[string]*sql.DB
}

var searchDBs = &searchDBManager{
	dbs: make(map[string]*sql.DB),
}

func (m *searchDBManager) getDB(sessionsDir string) (*sql.DB, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if db, exists := m.dbs[sessionsDir]; exists {
		return db, nil
	}

	dbPath := filepath.Join(sessionsDir, "sessions_search.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	// Single connection to minimize memory on low-end hardware
	db.SetMaxOpenConns(1)

	pragmas := []string{
		"PRAGMA journal_mode = WAL;",
		"PRAGMA synchronous = NORMAL;",
		"PRAGMA temp_store = MEMORY;",
		"PRAGMA cache_size = -2000;",
	}
	for _, p := range pragmas {
		_, _ = db.Exec(p)
	}

	if err := initSearchSchema(db); err != nil {
		db.Close()
		return nil, err
	}

	m.dbs[sessionsDir] = db
	return db, nil
}

func initSearchSchema(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS session_sync (
			session_id TEXT PRIMARY KEY,
			channel TEXT,
			sender TEXT,
			chat TEXT,
			mtime INTEGER,
			title TEXT,
			preview TEXT,
			message_count INTEGER,
			created_at TEXT,
			updated_at TEXT
		);`,
		`CREATE VIRTUAL TABLE IF NOT EXISTS session_search_fts USING fts5(
			session_id UNINDEXED,
			channel UNINDEXED,
			title,
			user_content,
			assistant_content,
			tokenize = 'unicode61'
		);`,
	}

	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

func sanitizeFTSQuery(q string) string {
	q = strings.TrimSpace(q)
	if q == "" {
		return ""
	}
	words := strings.Fields(q)
	var tokens []string
	for _, w := range words {
		cleaned := strings.Map(func(r rune) rune {
			if r == '"' || r == '*' || r == '(' || r == ')' || r == ':' || r == '^' || r == '{' || r == '}' || r == '[' || r == ']' {
				return -1
			}
			return r
		}, w)
		cleaned = strings.TrimSpace(cleaned)
		if cleaned != "" {
			tokens = append(tokens, `"`+cleaned+`"*`)
		}
	}
	return strings.Join(tokens, " ")
}

// syncSessionIndex scans session files on disk and incrementally updates the FTS index.
func syncSessionIndex(db *sql.DB, sessionsDir string) error {
	entries, err := os.ReadDir(sessionsDir)
	if err != nil {
		return err
	}

	// Read existing indexed session mtimes
	rows, err := db.Query("SELECT session_id, mtime FROM session_sync")
	if err != nil {
		return err
	}
	indexed := make(map[string]int64)
	for rows.Next() {
		var id string
		var mtime int64
		if err := rows.Scan(&id, &mtime); err == nil {
			indexed[id] = mtime
		}
	}
	rows.Close()

	activeOnDisk := make(map[string]struct{})

	for _, entry := range entries {
		name := entry.Name()
		if !strings.HasSuffix(name, ".jsonl") && !strings.HasSuffix(name, ".json") {
			continue
		}
		if strings.HasSuffix(name, ".meta.json") {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		sessionID := ""
		channel := "pico"
		if strings.HasSuffix(name, ".jsonl") {
			ref, ok := jsonlSessionRefFromFilename(name)
			if !ok {
				continue
			}
			sessionID = ref.ID
			channel = ref.Channel
		} else {
			sessionID = strings.TrimSuffix(name, ".json")
			if strings.HasPrefix(sessionID, "agent_cron_") || strings.HasPrefix(sessionID, "cron_") {
				continue
			}
		}

		activeOnDisk[sessionID] = struct{}{}
		fileMtime := info.ModTime().Unix()

		// Skip if already indexed and file hasn't changed
		if lastMtime, exists := indexed[sessionID]; exists && lastMtime == fileMtime {
			continue
		}

		// Read and index session content
		filePath := filepath.Join(sessionsDir, name)
		indexSingleSession(db, filePath, sessionID, channel, fileMtime, info.ModTime())
	}

	// Clean up deleted sessions
	for id := range indexed {
		if _, exists := activeOnDisk[id]; !exists {
			_, _ = db.Exec("DELETE FROM session_sync WHERE session_id = ?", id)
			_, _ = db.Exec("DELETE FROM session_search_fts WHERE session_id = ?", id)
		}
	}

	return nil
}

type messageLine struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func indexSingleSession(db *sql.DB, filePath, sessionID, channel string, mtime int64, modTime time.Time) {
	file, err := os.Open(filePath)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 0, 32*1024), 2*1024*1024)

	var userBuilder strings.Builder
	var assistantBuilder strings.Builder
	firstUserMsg := ""
	count := 0

	const maxContentPerSession = 40 * 1024 // 40KB cap to preserve memory on $10 boards

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var m messageLine
		if err := json.Unmarshal(line, &m); err != nil {
			continue
		}

		count++
		content := strings.TrimSpace(m.Content)
		if content == "" {
			continue
		}

		if m.Role == "user" {
			if firstUserMsg == "" {
				firstUserMsg = content
			}
			if userBuilder.Len() < maxContentPerSession {
				userBuilder.WriteString(content)
				userBuilder.WriteString(" ")
			}
		} else if m.Role == "assistant" {
			if assistantBuilder.Len() < maxContentPerSession {
				assistantBuilder.WriteString(content)
				assistantBuilder.WriteString(" ")
			}
		}
	}

	if count == 0 && firstUserMsg == "" {
		return
	}

	title := truncateRunes(firstUserMsg, maxSessionTitleRunes)
	if title == "" {
		title = "Conversation"
	}
	preview := title

	createdAt := modTime.Format(time.RFC3339)
	updatedAt := createdAt

	tx, err := db.Begin()
	if err != nil {
		return
	}
	defer tx.Rollback()

	_, _ = tx.Exec(
		`INSERT OR REPLACE INTO session_sync (session_id, channel, sender, chat, mtime, title, preview, message_count, created_at, updated_at)
		 VALUES (?, ?, '', '', ?, ?, ?, ?, ?, ?)`,
		sessionID, channel, mtime, title, preview, count, createdAt, updatedAt,
	)

	_, _ = tx.Exec("DELETE FROM session_search_fts WHERE session_id = ?", sessionID)
	_, _ = tx.Exec(
		`INSERT INTO session_search_fts (session_id, channel, title, user_content, assistant_content)
		 VALUES (?, ?, ?, ?, ?)`,
		sessionID, channel, title, userBuilder.String(), assistantBuilder.String(),
	)

	_ = tx.Commit()
}

// searchSessionsWithScoring searches sessions using FTS5 with weighted ranking.
func searchSessionsWithScoring(
	sessionsDir, query, targetType, targetSender string,
	offset, limit int,
) ([]sessionListItem, error) {
	db, err := searchDBs.getDB(sessionsDir)
	if err != nil {
		return nil, err
	}

	// Incremental sync
	_ = syncSessionIndex(db, sessionsDir)

	ftsQuery := sanitizeFTSQuery(query)
	if ftsQuery == "" {
		return []sessionListItem{}, nil
	}

	// Title weight: 10.0, User message weight: 3.0, Assistant message weight: 1.0
	sqlQuery := `
		SELECT 
			s.session_id,
			s.title,
			s.preview,
			s.message_count,
			s.channel,
			s.sender,
			s.chat,
			s.created_at,
			s.updated_at,
			bm25(session_search_fts, 10.0, 3.0, 1.0) AS rank,
			snippet(session_search_fts, -1, '<mark>', '</mark>', '...', 12) AS snippet
		FROM session_search_fts f
		JOIN session_sync s ON f.session_id = s.session_id
		WHERE session_search_fts MATCH ?
	`
	args := []any{ftsQuery}

	if targetType != "" && targetType != "all" {
		if targetType == "web" {
			sqlQuery += " AND (s.channel = 'pico' OR s.channel = 'web') "
		} else if strings.HasPrefix(targetType, "channel/") {
			ch := strings.TrimPrefix(targetType, "channel/")
			sqlQuery += " AND s.channel = ? "
			args = append(args, ch)
		} else {
			sqlQuery += " AND s.channel = ? "
			args = append(args, targetType)
		}
	}

	if targetSender != "" {
		sqlQuery += " AND (LOWER(s.sender) LIKE ? OR LOWER(s.chat) LIKE ?) "
		args = append(args, "%"+targetSender+"%", "%"+targetSender+"%")
	}

	sqlQuery += " ORDER BY rank ASC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := db.Query(sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []sessionListItem{}
	for rows.Next() {
		var id, title, preview, channel, sender, chat, created, updated, snippet string
		var count int
		var rank float64

		if err := rows.Scan(&id, &title, &preview, &count, &channel, &sender, &chat, &created, &updated, &rank, &snippet); err != nil {
			continue
		}

		// Normalize BM25 rank score (negative values) to positive score
		score := math.Round(math.Abs(rank)*100) / 10

		sessType := "web"
		if channel != "" && channel != "pico" && channel != "web" {
			sessType = "channel/" + channel
		}

		items = append(items, sessionListItem{
			ID:           id,
			Title:        title,
			Preview:      preview,
			MessageCount: count,
			Type:         sessType,
			Channel:      channel,
			Sender:       sender,
			Chat:         chat,
			Created:      created,
			Updated:      updated,
			Score:        score,
			MatchSnippet: snippet,
		})
	}

	return items, nil
}
