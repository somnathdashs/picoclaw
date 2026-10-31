import {
  IconAlertCircle,
  IconCheck,
  IconDeviceMobile,
  IconExternalLink,
  IconLink,
  IconLoader2,
  IconQrcode,
  IconRefresh,
  IconTrash,
  IconUnlink,
  IconX,
} from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import type { ChannelConfig } from "@/api/channels"
import {
  type WhatsAppStatus,
  cancelWhatsAppLinking,
  getWhatsAppStatus,
  startWhatsAppLinking,
  unlinkWhatsApp,
} from "@/api/whatsapp"
import {
  type ArrayFieldFlusher,
  ChannelArrayListField,
} from "@/components/channels/channel-array-list-field"
import {
  asStringArray,
  parseAllowFromInput,
} from "@/components/channels/channel-array-utils"
import { Field, SwitchCardField } from "@/components/shared-form"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface WhatsappFormProps {
  config: ChannelConfig
  onChange: (key: string, value: unknown) => void
  fieldErrors?: Record<string, string>
  registerArrayFieldFlusher?: (
    fieldPath: string,
    flusher: ArrayFieldFlusher | null,
  ) => void
  arrayFieldResetVersion?: number
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function asBool(value: unknown): boolean {
  return value === true
}

export function WhatsappForm({
  config,
  onChange,
  fieldErrors = {},
  registerArrayFieldFlusher,
  arrayFieldResetVersion,
}: WhatsappFormProps) {
  const { t } = useTranslation()
  const useNative = config.use_native !== false
  const bridgeUrl = asString(config.bridge_url)
  const sessionStorePath = asString(config.session_store_path)

  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false)
  const [linking, setLinking] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const isLinking = linking || Boolean(status?.qr_data_uri && !status?.linked)

  const typingConfig = asRecord(config.typing)
  const placeholderConfig = asRecord(config.placeholder)
  const placeholderEnabled = asBool(placeholderConfig.enabled)
  const groupTriggerConfig = asRecord(config.group_trigger)

  const fetchStatus = async () => {
    setLoadingStatus(true)
    try {
      const data = await getWhatsAppStatus()
      setStatus(data)
    } catch {
      // Best effort status check
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => {
    void fetchStatus()
  }, [])

  useEffect(() => {
    if (status?.linked && linking) {
      setLinking(false)
      toast.success("WhatsApp successfully linked!")
    }
  }, [status?.linked, linking])

  useEffect(() => {
    if (!isLinking) return
    const timer = setInterval(() => {
      void fetchStatus()
    }, 2000)
    return () => clearInterval(timer)
  }, [isLinking])

  const handleStartLinking = async () => {
    setLinking(true)
    try {
      const res = await startWhatsAppLinking()
      toast.success(
        res.message ||
          "Linking initiated! Gateway is generating the pairing code.",
      )
      await fetchStatus()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start linking",
      )
      setLinking(false)
    }
  }

  const handleCancelLinking = async () => {
    setCancelling(true)
    try {
      await cancelWhatsAppLinking()
      toast.success("Linking cancelled")
      setLinking(false)
      await fetchStatus()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to cancel linking",
      )
    } finally {
      setCancelling(false)
    }
  }

  const handleUnlink = async () => {
    setUnlinking(true)
    try {
      const res = await unlinkWhatsApp()
      toast.success(res.message || "WhatsApp session removed")
      await fetchStatus()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to unlink WhatsApp",
      )
    } finally {
      setUnlinking(false)
      setShowUnlinkDialog(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-foreground text-base font-semibold">
                Connection Mode
              </h3>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Choose between Native WhatsApp Web protocol (whatsmeow) or an
                external WebSocket bridge.
              </p>
            </div>
            <div className="bg-muted/60 flex items-center gap-2 rounded-lg p-1">
              <Button
                type="button"
                variant={useNative ? "default" : "ghost"}
                size="sm"
                onClick={() => onChange("use_native", true)}
                className="h-8 text-xs font-medium"
              >
                Native (whatsmeow)
              </Button>
              <Button
                type="button"
                variant={!useNative ? "default" : "ghost"}
                size="sm"
                onClick={() => onChange("use_native", false)}
                className="h-8 text-xs font-medium"
              >
                Bridge
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Native Mode Status & Link/Unlink Controls */}
      {useNative && (
        <Card className="border-border/60 overflow-hidden shadow-sm">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconDeviceMobile className="text-primary size-5" />
                <h3 className="text-foreground text-base font-semibold">
                  Session & Pairing Status
                </h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => void fetchStatus()}
                disabled={loadingStatus}
                title="Refresh status"
              >
                <IconRefresh
                  className={`size-4 ${loadingStatus ? "animate-spin" : ""}`}
                />
              </Button>
            </div>

            <div className="bg-muted/40 border-border/40 space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-medium">
                    Link Status:
                  </span>
                  {status?.linked ? (
                    <Badge
                      variant="outline"
                      className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 py-0.5 text-emerald-600 dark:text-emerald-400"
                    >
                      <IconCheck className="size-3.5" />
                      Linked / Paired
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1.5 border-amber-500/30 bg-amber-500/10 py-0.5 text-amber-600 dark:text-amber-400"
                    >
                      <IconAlertCircle className="size-3.5" />
                      Not Linked / Unpaired
                    </Badge>
                  )}
                </div>

                {status?.linked && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setShowUnlinkDialog(true)}
                    disabled={unlinking}
                  >
                    {unlinking ? (
                      <IconLoader2 className="size-3.5 animate-spin" />
                    ) : (
                      <IconUnlink className="size-3.5" />
                    )}
                    Unlink & Delete Session
                  </Button>
                )}
              </div>

              {status?.linked ? (
                <div className="border-border/30 grid grid-cols-1 gap-3 border-t pt-2 text-xs sm:grid-cols-2 sm:text-sm">
                  {status.phone && (
                    <div>
                      <span className="text-muted-foreground block text-xs">
                        Phone Number
                      </span>
                      <span className="text-foreground font-mono font-medium">
                        {status.phone}
                      </span>
                    </div>
                  )}
                  {status.push_name && (
                    <div>
                      <span className="text-muted-foreground block text-xs">
                        WhatsApp Name
                      </span>
                      <span className="text-foreground font-medium">
                        {status.push_name}
                      </span>
                    </div>
                  )}
                  {status.jid && (
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground block text-xs">
                        Device JID
                      </span>
                      <span className="text-muted-foreground font-mono text-xs break-all">
                        {status.jid}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-border/30 space-y-4 border-t pt-3">
                  {!isLinking ? (
                    <div className="bg-muted/40 border-border/40 flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <IconQrcode className="size-4 text-emerald-500" />
                          <span className="text-foreground text-xs font-semibold">
                            Native Device Pairing
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          Start the linking process to generate a pairing QR code for WhatsApp Web.
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          onClick={handleStartLinking}
                          disabled={linking}
                          className="h-8 gap-1.5 bg-emerald-600 text-xs text-white shadow-xs hover:bg-emerald-700"
                        >
                          <IconLink className="size-3.5" />
                          Start Linking
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void fetchStatus()}
                          disabled={loadingStatus}
                          className="h-8 gap-1 text-xs"
                          title="Check connection status"
                        >
                          <IconRefresh
                            className={`size-3.5 ${loadingStatus ? "animate-spin" : ""}`}
                          />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
                        <div className="flex items-center gap-2 font-medium text-xs sm:text-sm text-emerald-700 dark:text-emerald-300">
                          <span className="relative flex size-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500"></span>
                          </span>
                          Pairing in progress — scan with WhatsApp
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCancelLinking}
                            disabled={cancelling}
                            className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                          >
                            {cancelling ? (
                              <IconLoader2 className="size-3.5 animate-spin" />
                            ) : (
                              <IconX className="size-3.5" />
                            )}
                            Cancel Linking
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => void fetchStatus()}
                            disabled={loadingStatus}
                            className="size-8"
                            title="Refresh QR"
                          >
                            <IconRefresh
                              className={`size-3.5 ${loadingStatus ? "animate-spin" : ""}`}
                            />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                        {status?.qr_data_uri ? (
                          <div className="flex flex-col items-center shrink-0 rounded-2xl bg-white p-3 shadow-md border border-border/80">
                            <img
                              src={status.qr_data_uri}
                              alt="WhatsApp Pairing QR Code"
                              className="size-48 sm:size-56 max-w-full aspect-square object-contain rounded-lg"
                            />
                            <span className="mt-1.5 text-[10px] font-medium text-neutral-500">
                              Scan with WhatsApp camera
                            </span>
                          </div>
                        ) : (
                          <div className="flex size-48 sm:size-56 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-500/30 bg-muted/30 p-4 text-center">
                            <IconLoader2 className="size-8 animate-spin text-emerald-500 mb-2" />
                            <span className="text-xs font-semibold text-foreground">
                              Generating QR code...
                            </span>
                            <span className="text-[11px] text-muted-foreground mt-1">
                              Connecting to WhatsApp servers
                            </span>
                          </div>
                        )}

                        <div className="flex flex-col justify-between w-full space-y-3 min-w-0">
                          <div className="space-y-2">
                            <div className="font-semibold text-foreground text-xs sm:text-sm flex items-center gap-1.5">
                              <IconQrcode className="size-4 text-emerald-600 dark:text-emerald-400" />
                              Pairing Instructions:
                            </div>
                            <ol className="text-muted-foreground list-inside list-decimal space-y-1.5 text-xs sm:text-sm pl-0.5">
                              <li>
                                Open <strong className="text-foreground">WhatsApp</strong> on your mobile phone
                              </li>
                              <li>
                                Tap <strong className="text-foreground">Settings</strong> (iOS) or <strong className="text-foreground">More options ⋮</strong> (Android)
                              </li>
                              <li>
                                Tap <strong className="text-foreground">Linked Devices</strong> &gt; <strong className="text-foreground">Link a Device</strong>
                              </li>
                              <li>
                                Point your phone camera at this QR code to finish pairing
                              </li>
                            </ol>
                          </div>

                          {status?.error && (
                            <div className="text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg text-xs">
                              {status.error}
                            </div>
                          )}

                          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/40">
                            <span className="text-[11px] text-muted-foreground">
                              QR code rotates periodically for security.
                            </span>
                            <a
                              href="/logs"
                              target="_blank"
                              rel="noreferrer"
                              className="text-muted-foreground hover:text-foreground text-[11px] inline-flex items-center gap-1 underline"
                            >
                              Gateway Logs <IconExternalLink className="size-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Field
              label="Session Storage Path"
              description="Directory where the WhatsApp SQLite session credentials are kept (defaults to workspace/whatsapp)."
              error={fieldErrors["session_store_path"]}
            >
              <Input
                value={sessionStorePath}
                placeholder="workspace/whatsapp"
                onChange={(e) => onChange("session_store_path", e.target.value)}
              />
            </Field>
          </CardContent>
        </Card>
      )}

      {/* Bridge Mode Configuration */}
      {!useNative && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <Field
              label="Bridge WebSocket URL"
              description="WebSocket address of the external WhatsApp bridge server (e.g. ws://localhost:3001)."
              error={fieldErrors["bridge_url"]}
              required
            >
              <Input
                value={bridgeUrl}
                placeholder="ws://localhost:3001"
                onChange={(e) => onChange("bridge_url", e.target.value)}
              />
            </Field>
          </CardContent>
        </Card>
      )}

      {/* Common Channel Options */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="space-y-6 p-4 sm:p-6">
          <h3 className="text-foreground text-base font-semibold">
            Messaging & Security Settings
          </h3>

          <ChannelArrayListField
            label={t("channels.fields.allowFrom.label")}
            hint="List of allowed phone numbers or WhatsApp user JIDs permitted to interact with the bot."
            value={asStringArray(config.allow_from)}
            onChange={(values) => onChange("allow_from", values)}
            placeholder="e.g. 1234567890"
            parser={parseAllowFromInput}
            fieldPath="allow_from"
            registerFlusher={registerArrayFieldFlusher}
            resetVersion={arrayFieldResetVersion}
          />

          <Field
            label="Reasoning Channel ID"
            description="Optional target channel/chat ID for internal reasoning step traces."
            error={fieldErrors["reasoning_channel_id"]}
          >
            <Input
              value={asString(config.reasoning_channel_id)}
              placeholder="e.g. internal or chat ID"
              onChange={(e) => onChange("reasoning_channel_id", e.target.value)}
            />
          </Field>

          <SwitchCardField
            label="Group Mention Only"
            description="When enabled in group chats, the bot will only respond when explicitly mentioned or prefixed."
            checked={asBool(groupTriggerConfig.mention_only)}
            onCheckedChange={(checked) =>
              onChange("group_trigger", {
                ...groupTriggerConfig,
                mention_only: checked,
              })
            }
          />

          <SwitchCardField
            label={t("channels.fields.typing.label")}
            description={t("channels.fields.typing.description")}
            checked={asBool(typingConfig.enabled)}
            onCheckedChange={(checked) =>
              onChange("typing", { ...typingConfig, enabled: checked })
            }
          />

          <SwitchCardField
            label={t("channels.fields.placeholder.label")}
            description={t("channels.fields.placeholder.description")}
            checked={placeholderEnabled}
            onCheckedChange={(checked) =>
              onChange("placeholder", {
                ...placeholderConfig,
                enabled: checked,
              })
            }
          >
            {placeholderEnabled && (
              <div className="pt-2">
                <Input
                  value={asString(placeholderConfig.text)}
                  placeholder={t("channels.fields.placeholder.placeholder")}
                  onChange={(e) =>
                    onChange("placeholder", {
                      ...placeholderConfig,
                      text: e.target.value,
                    })
                  }
                />
              </div>
            )}
          </SwitchCardField>
        </CardContent>
      </Card>

      {/* Confirm Unlink Dialog */}
      <AlertDialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconTrash className="text-destructive size-5" />
              Unlink WhatsApp Session
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the local WhatsApp session store
              credentials ({status?.session_store_path || "store.db"}). You will
              need to scan a new QR code to reconnect. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleUnlink()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Unlink & Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
