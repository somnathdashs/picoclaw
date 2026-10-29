import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  type SessionSummary,
  clearSessions,
  deleteSession,
  getCachedSessions,
  getSessions,
} from "@/api/sessions"

const DEFAULT_LIMIT = 50

interface UseSessionHistoryOptions {
  activeSessionId: string
  onDeletedActiveSession: () => void
  limit?: number
  sessionType?: string
  sender?: string
  query?: string
}

export function useSessionHistory({
  activeSessionId,
  onDeletedActiveSession,
  limit = DEFAULT_LIMIT,
  sessionType,
  sender,
  query,
}: UseSessionHistoryOptions) {
  const { t } = useTranslation()
  const observerRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const [sessions, setSessions] = useState<SessionSummary[]>(() =>
    getCachedSessions(),
  )
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const loadSessions = useCallback(
    async (reset = true) => {
      try {
        const currentOffset = reset ? 0 : offsetRef.current
        if (reset) {
          setLoadError(false)
          setHasMore(true)
          offsetRef.current = 0
        }

        const data = await getSessions(currentOffset, limit, sessionType, sender, query)
        setLoadError(false)

        if (data.length < limit) {
          setHasMore(false)
        }

        if (reset) {
          setSessions(data)
        } else {
          setSessions((prev) => {
            const existingIds = new Set(prev.map((s) => s.id))
            const newItems = data.filter((s) => !existingIds.has(s.id))
            return [...prev, ...newItems]
          })
        }

        offsetRef.current = currentOffset + data.length
      } catch (err) {
        console.error("Failed to fetch session history:", err)
        setLoadError(true)
        if (!reset) {
          setHasMore(false)
        }
      } finally {
        setIsLoadingMore(false)
      }
    },
    [limit, sessionType, sender, query],
  )

  useEffect(() => {
    void loadSessions(true)
  }, [loadSessions])

  useEffect(() => {
    if (!observerRef.current || !hasMore || isLoadingMore || loadError) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isLoadingMore &&
          !loadError
        ) {
          setIsLoadingMore(true)
          void loadSessions(false)
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, loadError, loadSessions])

  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        const deletedLoadedSession = sessions.some(
          (session) => session.id === id,
        )
        await deleteSession(id)
        setSessions((prev) => prev.filter((s) => s.id !== id))
        if (deletedLoadedSession) {
          offsetRef.current = Math.max(offsetRef.current - 1, 0)
        }
        if (id === activeSessionId) {
          onDeletedActiveSession()
        }
      } catch (err) {
        console.error("Failed to delete session:", err)
      }
    },
    [activeSessionId, onDeletedActiveSession, sessions],
  )

  const handleClearAllSessions = useCallback(
    async (typeToClear?: string) => {
      try {
        const effectiveType = typeToClear ?? sessionType
        await clearSessions(effectiveType)
        if (!effectiveType || effectiveType === "all") {
          setSessions([])
          onDeletedActiveSession()
        } else {
          setSessions((prev) =>
            prev.filter((s) =>
              effectiveType === "web"
                ? s.type !== "web"
                : s.type !== effectiveType && s.channel !== effectiveType,
            ),
          )
        }
        offsetRef.current = 0
        void loadSessions(true)
      } catch (err) {
        console.error("Failed to clear sessions:", err)
        throw err
      }
    },
    [loadSessions, onDeletedActiveSession, sessionType],
  )

  return {
    sessions,
    hasMore,
    loadError,
    loadErrorMessage: t("chat.historyLoadFailed"),
    observerRef,
    loadSessions,
    handleDeleteSession,
    handleClearAllSessions,
  }
}
