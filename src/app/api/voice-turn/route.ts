// src/app/api/voice-turn/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ClinicConfig } from "../../types/config";


export const runtime = "nodejs"; // we need Node for the OpenAI SDK

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

The staff member is a VA in training for inbound new patient calls.

General rules:
- ALWAYS have clear intent to schedule an appointment.
- Do NOT open with random questions. You are calling to book.
- Use short, natural sentences (1–2 per reply).
- Let the STAFF lead the call. You react.
- Ask realistic follow-up questions about cost, time, insurance, x-rays, and "will this really work" especially in challenging/skeptical modes.
- If STAFF forgets something important (like first visit cost, what to bring, when you’re scheduled), you should politely ask.

Mode behavior:
- easy: cooperative, minimal questions, focus on booking.
- challenging: intent to book but asks about first visit cost, insurance, visit length.
- skeptical: multiple objections about cost, number of visits, "will this really work?", x-rays; may or may not book depending on how clear and honest the staff is.
- creepy: first 1–2 turns normal, then moderately inappropriate (mild flirtation, personal questions); never explicit or abusive; test if staff sets boundaries or ends call.

Always stay within these boundaries:
- DO NOT be explicit, graphic, or threatening.
- Keep the conversation focused on the appointment and their behavior.

You respond ONLY with what the patient says next.
Do not describe internal thoughts.

Mode: ${mode}
`.trim();
}

export async function POST(req: NextRequest) {
  try {
    // Expect multipart/form-data: audio file + JSON fields
    const formData = await req.formData();

    const audioFile = formData.get("audio");
    const mode = (formData.get("mode") as string) || "easy";
    const clinicJson = formData.get("clinicConfig") as string;
    const turnsJson = formData.get("turns") as string;

    if (!audioFile || !clinicJson || !turnsJson) {
      return NextResponse.json(
        { error: "Missing audio, clinicConfig, or turns" },
        { status: 400 }
      );
    }

    const clinicConfig = JSON.parse(clinicJson) as ClinicConfig;
    const turns = JSON.parse(turnsJson) as Turn[];

    // 1) Transcribe staff audio
    const audioBlob = audioFile as File; // Next.js gives a File-like object
    const transcription = await openai.audio.transcriptions.create({
      file: audioBlob,
      model: "gpt-4o-mini-transcribe", // if this errors, switch to "whisper-1"
    });

    const staffText = (transcription.text || "").trim();

    const updatedTurns: Turn[] = [
      ...turns,
      { role: "staff", text: staffText },
    ];

    // 2) Get patient reply (Chat Completions)
    const systemPrompt = buildPatientSystemPrompt(clinicConfig, mode);

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...updatedTurns.map((t) => ({
        role: t.role === "staff" ? ("user" as const) : ("assistant" as const),
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

    // 3) Convert patient reply text to speech
    // 3) Convert patient reply text to speech (OpenAI TTS)
const speech = await openai.audio.speech.create({
  model: "gpt-4o-mini-tts",
  voice: "alloy",
  input: patientText,
  response_format: "mp3"
});

const audioBuffer = Buffer.from(await speech.arrayBuffer());
const audioBase64 = audioBuffer.toString("base64");



    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    const audioBase64 = audioBuffer.toString("base64");

    return NextResponse.json({
      staffText,
      patientText,
      audioBase64,
      turns: finalTurns,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
