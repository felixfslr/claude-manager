// Speech-to-text proxy: forwards an audio blob to ElevenLabs scribe_v2 and
// returns the transcription. Used by the mic button in the run-form and
// follow-up chat input.
//
// The ElevenLabs API key is resolved via the existing settings store, with
// an ELEVENLABS_API_KEY env var fallback. We do NOT expose the key to the
// browser — the blob is POSTed here, we forward it with the server-side key.

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/settings";

const ELEVENLABS_ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";
const DEFAULT_LANGUAGE = "de";
const DEFAULT_MODEL = "scribe_v2";

export async function POST(request: NextRequest) {
  try {
    const apiKey = await getToken("elevenlabsApiKey");
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "ElevenLabs API key not configured. Add it in Settings or set ELEVENLABS_API_KEY.",
        },
        { status: 400 }
      );
    }

    const incoming = await request.formData();
    const file = incoming.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    const language = (incoming.get("language") as string | null) ?? DEFAULT_LANGUAGE;

    // Rebuild the multipart body for the upstream call. We can't forward the
    // request body directly because we also need to add our own fields.
    const forward = new FormData();
    forward.append("file", file, "recording.webm");
    forward.append("model_id", DEFAULT_MODEL);
    if (language) forward.append("language_code", language);

    const upstream = await fetch(ELEVENLABS_ENDPOINT, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: forward,
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: `ElevenLabs error ${upstream.status}: ${text.slice(0, 500)}` },
        { status: 502 }
      );
    }

    const data = (await upstream.json()) as {
      text?: string;
      transcription?: { text?: string };
    };
    const text = data.text ?? data.transcription?.text ?? "";
    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "STT failed" },
      { status: 500 }
    );
  }
}
