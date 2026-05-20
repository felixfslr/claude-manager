"use client";
// Mic button that captures browser audio via MediaRecorder, POSTs the blob
// to /api/stt, and hands the resulting transcription text back to the parent
// via onTranscription. The parent decides where to put the text.
//
// States: idle → recording (red pulse) → uploading (spinner) → idle.

import { useRef, useState } from "react";
import { Mic, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface VoiceInputButtonProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  /** ISO code for the ElevenLabs scribe_v2 model. Defaults to German. */
  language?: string;
  className?: string;
}

type RecorderState = "idle" | "recording" | "uploading";

export function VoiceInputButton({
  onTranscription,
  disabled,
  language = "de",
  className,
}: VoiceInputButtonProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    if (state !== "idle") return;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        toast.error("Voice input not supported in this browser");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        // Release the mic as soon as recording ends.
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        if (blob.size === 0) {
          setState("idle");
          return;
        }
        await uploadBlob(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setState("recording");
    } catch (err) {
      console.error("[voice] getUserMedia failed:", err);
      toast.error(
        err instanceof Error ? err.message : "Microphone access denied"
      );
      setState("idle");
    }
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    setState("uploading");
    rec.stop();
  };

  const uploadBlob = async (blob: Blob) => {
    try {
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      form.append("language", language);
      const res = await fetch("/api/stt", { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `STT failed (${res.status})`);
      }
      const data = (await res.json()) as { text?: string };
      if (data.text) {
        onTranscription(data.text);
      } else {
        toast.info("No speech detected");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setState("idle");
    }
  };

  const onClick = () => {
    if (state === "recording") {
      stopRecording();
    } else if (state === "idle") {
      void startRecording();
    }
  };

  const label =
    state === "recording"
      ? "Stop recording"
      : state === "uploading"
      ? "Transcribing…"
      : "Voice input";

  return (
    <Button
      type="button"
      size="icon-xs"
      variant={state === "recording" ? "destructive" : "ghost"}
      onClick={onClick}
      disabled={disabled || state === "uploading"}
      aria-label={label}
      title={label}
      className={className}
    >
      {state === "uploading" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : state === "recording" ? (
        <Square className="size-3.5 animate-pulse" />
      ) : (
        <Mic className="size-3.5" />
      )}
    </Button>
  );
}
