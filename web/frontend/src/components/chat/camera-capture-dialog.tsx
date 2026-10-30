import {
  IconAlertCircle,
  IconCheck,
  IconPhoto,
  IconRefresh,
  IconSwitchHorizontal,
  IconX,
} from "@tabler/icons-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface CameraCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (file: File) => void
}

export function CameraCaptureDialog({
  open,
  onOpenChange,
  onCapture,
}: CameraCaptureDialogProps) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const nativeInputRef = useRef<HTMLInputElement>(null)

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(
    async (mode: "environment" | "user") => {
      stopStream()
      setError(null)
      setIsStarting(true)

      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t("chat.cameraNotSupported", "Camera stream not supported in this browser."))
        setIsStarting(false)
        return
      }

      try {
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: mode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })
        } catch {
          // Fallback if specific facingMode is rejected
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : t("chat.cameraPermissionDenied", "Camera access denied or unavailable."),
        )
      } finally {
        setIsStarting(false)
      }
    },
    [stopStream, t],
  )

  useEffect(() => {
    if (open && !capturedUrl) {
      void startCamera(facingMode)
    } else if (!open) {
      stopStream()
      if (capturedUrl) {
        URL.revokeObjectURL(capturedUrl)
        setCapturedUrl(null)
        setCapturedBlob(null)
      }
      setError(null)
    }

    return () => {
      stopStream()
    }
  }, [open, facingMode, startCamera, stopStream, capturedUrl])

  const handleCaptureSnapshot = () => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    if (facingMode === "user") {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(
      (blob) => {
        if (blob) {
          stopStream()
          setCapturedBlob(blob)
          setCapturedUrl(URL.createObjectURL(blob))
        }
      },
      "image/jpeg",
      0.92,
    )
  }

  const handleRetake = () => {
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl)
      setCapturedUrl(null)
      setCapturedBlob(null)
    }
    void startCamera(facingMode)
  }

  const handleConfirm = () => {
    if (!capturedBlob) return
    const file = new File([capturedBlob], `capture-${Date.now()}.jpg`, {
      type: "image/jpeg",
    })
    onCapture(file)
    onOpenChange(false)
  }

  const toggleFacingMode = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment"
    setFacingMode(nextMode)
    void startCamera(nextMode)
  }

  const handleNativeCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) {
      onCapture(file)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md sm:max-w-lg p-0 overflow-hidden bg-black/95 text-white border-white/10 sm:rounded-2xl"
      >
        <DialogHeader className="p-3 sm:p-4 pb-2 flex flex-row items-center justify-between text-left">
          <div className="flex-1 min-w-0 pr-2">
            <DialogTitle className="text-sm sm:text-base font-semibold text-white">
              {t("chat.cameraTitle", "Capture image")}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60 truncate">
              {capturedUrl
                ? t("chat.cameraPreviewHint", "Review your captured photo")
                : t("chat.cameraLiveHint", "Align your shot and take a picture")}
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-white/80 hover:text-white hover:bg-white/15 h-8 w-8 rounded-full shrink-0"
            onClick={() => onOpenChange(false)}
            title={t("common.close", "Close")}
          >
            <IconX className="size-4" />
          </Button>
        </DialogHeader>

        <div className="relative aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden">
          {capturedUrl ? (
            <img
              src={capturedUrl}
              alt={t("chat.capturedPhoto", "Captured photo")}
              className="h-full w-full object-contain"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${
                  facingMode === "user" ? "-scale-x-100" : ""
                }`}
              />
              {isStarting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white">
                  {t("chat.startingCamera", "Starting camera...")}
                </div>
              )}
            </>
          )}

          {error && !capturedUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 text-center">
              <IconAlertCircle className="size-8 text-amber-400" />
              <p className="text-xs text-white/80 max-w-xs">{error}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-1 gap-1.5 text-xs"
                onClick={() => nativeInputRef.current?.click()}
              >
                <IconPhoto className="size-3.5" />
                {t("chat.pickImage", "Pick a image")}
              </Button>
            </div>
          )}
        </div>

        {/* Shutter and preview controls */}
        <div className="p-3 sm:p-4 bg-black/80 flex items-center justify-center">
          {capturedUrl ? (
            <div className="flex w-full items-center gap-3 max-w-sm">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10 border-white/20 text-white hover:bg-white/15 gap-2 rounded-xl"
                onClick={handleRetake}
              >
                <IconRefresh className="size-4" />
                {t("chat.retakePhoto", "Retake")}
              </Button>
              <Button
                type="button"
                className="flex-1 h-10 bg-primary text-primary-foreground hover:bg-primary/90 gap-2 rounded-xl"
                onClick={handleConfirm}
              >
                <IconCheck className="size-4" />
                {t("chat.usePhoto", "Use Photo")}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 items-center justify-items-center w-full max-w-xs mx-auto">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                onClick={() => nativeInputRef.current?.click()}
                title={t("chat.pickImage", "Pick a image")}
              >
                <IconPhoto className="size-5" />
              </Button>

              <button
                type="button"
                onClick={handleCaptureSnapshot}
                disabled={isStarting || !!error}
                className="group relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-white p-1 transition active:scale-95 disabled:opacity-50"
                aria-label={t("chat.takePhoto", "Take photo")}
              >
                <span className="h-full w-full rounded-full bg-white transition group-hover:scale-95 group-active:scale-90" />
              </button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                onClick={toggleFacingMode}
                title={t("chat.switchCamera", "Switch Camera")}
              >
                <IconSwitchHorizontal className="size-5" />
              </Button>
            </div>
          )}
        </div>

        {/* Image file picker fallback */}
        <input
          ref={nativeInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleNativeCapture}
        />
      </DialogContent>
    </Dialog>
  )
}
