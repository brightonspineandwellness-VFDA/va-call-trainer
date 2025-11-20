import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ClinicConfig } from "../../types/config";
export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Role = "staff" | "patient";

type Turn = {
  role: Role;
  text: string;
};

function buildPatientSystemPrompt(clinic: ClinicConfig, mode: string) {
  return `
You are simulating a new patient calling a chiropractic office.

Clinic:
- Name: ${clinic.clinicName}
- Doctor: ${clinic.doctorName}
- First visit cost: $${clinic.firstVisitCost}
- Address: ${clinic.address}
- Office hours: ${clinic.officeHours}
- Services: chiropractic${clinic.services.decompression ? ", decompression" : ""}${clinic.services.classIVLaser ? ", Class IV laser" : ""}${clinic.services.shockwave ? ", shockwave" : ""}

Mode: ${mode}

Rules:
- Keep messages short (1–2 sentences).
- You only reply as the patient.
- No internal thoughts.
`;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const audioFile = form.get("audio") as File;
    const mode = (form.get("mode") as string) || "easy";
    const clinicJson = form.get("clinicConfig") as string;
    const turnsJson = form.get("turns") as string;

    if (!audioFile || !clinicJson || !turnsJson) {
      return NextResponse.json(
        { error: "Missing audio, clinicConfig, or turns" },
        { status: 400 }
      );
    }

    const clinicConfig: ClinicConfig = JSON.parse(clinicJson);
    const turns: Turn[] = JSON.parse(turnsJson);

    // 1) TRANSCRIBE STAFF AUDIO
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });

    const staffText = transcription.text.trim();

    const updatedTurns: Turn[] = [...turns, { role: "staff", text: staffText }];

    // 2) PATIENT AI REPLY
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
      chat.choices[0]?.message?.content?.trim() || "Okay, go ahead.";

    const finalTurns: Turn[] = [
      ...updatedTurns,
      { role: "patient", text: patientText },
    ];

    // 3) SPEECH (TTS)
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-realtime-preview",
      voice: "alloy",
      input: patientText,
      response_format: "mp3",
    });

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
