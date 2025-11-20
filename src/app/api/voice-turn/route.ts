import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ClinicConfig } from "../../types/config";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const runtime = "nodejs"; // required for OpenAI SDK on Vercel

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Role = "staff" | "patient";

type Turn = {
  role: Role;
  text: string;
};

function buildPatientSystemPrompt(clinic: ClinicConfig, mode: string) {
  return `
You are simulating a new patient calling a chiropractic office.

Clinic details:
- Name: ${clinic.clinicName}
- Doctor: ${clinic.doctorName}
- First visit cost: $${clinic.firstVisitCost}
- Address: ${clinic.address}
- Office hours: ${clinic.officeHours}
- Services: chiropractic${
    clinic.services.decompression ? ", decompression" : ""
  }${clinic.services.classIVLaser ? ", Class IV laser" : ""}${
    clinic.services.shockwave ? ", shockwave" : ""
  }.

General rules:
- Keep replies short (1–2 sentences).
- Natural tone.
- Intent: schedule an appointment.
- Ask realistic questions about cost, insurance, visit length, "will this work".
- Staff leads, you respond.
- NO explicit or graphic content.

Mode behavior:
- easy: cooperative.
- challenging: asks more questions about cost, insurance, time.
- skeptical: lots of objections about cost, x-rays, effectiveness.
- creepy: mildly inappropriate, but never explicit or abusive (tests boundaries).

Respond ONLY with what the patient says next.
Mode: ${mode}
`.trim();
}

export async function POST(req: NextRequest) {
  try {
    // Expect multipart/form-data: audio file + JSON fields
    const formData = await req.formData();

    const audioFile = formData.get("audio") as File | null;
    const mode = (formData.get("mode") as string) || "easy";
    const clinicJson = formData.get("clinicConfig") as string | null;
    const turnsJson = formData.get("turns") as string | null;

    if (!audioFile || !clinicJson || !turnsJson) {
      return NextResponse.json(
        { error: "Missing audio, clinicConfig, or turns" },
        { status: 400 }
      );
    }

    const clinicConfig = JSON.parse(clinicJson) as ClinicConfig;
    const turns = JSON.parse(turnsJson) as Turn[];

    //
    // 1) Transcribe staff audio
    //
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "gpt-4o-mini-transcribe", // or "whisper-1" if needed
    });

    const staffText = (transcription.text || "").trim();

    const updatedTurns: Turn[] = [
      ...turns,
      { role: "staff", text: staffText },
    ];

    //
    // 2) Get patient reply via Chat Completions
    //
    const systemPrompt = buildPatientSystemPrompt(clinicConfig, mode);

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...updatedTurns.map<ChatCompletionMessageParam>((t) => ({
        role: t.role === "staff" ? "user" : "assistant",
        content: t.text,
      })),
    ];

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
    });

    const patientText =
      chat.choices[0]?.message?.content?.trim() || "...";

    const finalTurns: Turn[] = [
      ...updatedTurns,
      { role: "patient", text: patientText },
    ];

    //
    // 3) TTS – Convert patient reply to audio
    //
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-realtime-preview",
      voice: "alloy",
      input: patientText,
      response_format: "mp3",
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    const audioBase64 = audioBuffer.toString("base64");

    //
    // 4) Return JSON payload
    //
    return NextResponse.json({
      staffText,
      patientText,
      audioBase64,
      turns: finalTurns,
    });
  } catch (err) {
    console.error("VOICE API ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
