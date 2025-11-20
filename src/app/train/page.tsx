"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { ClinicConfig } from "../../types/config";

type ModeId = "easy" | "challenging" | "skeptical" | "creepy";
type Role = "staff" | "patient";

type Turn = {
  role: Role;
  text: string;
};

const MODE_LABELS: Record<ModeId, string> = {
  easy: "Easy",
  challenging: "Challenging",
  skeptical: "Skeptical",
  creepy: "Creepy",
};

export default function TrainPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawMode = (searchParams.get("mode") || "easy") as ModeId;
  const mode: ModeId = MODE_LABELS[rawMode] ? rawMode : "easy";

  const [clinic, setClinic] = useState<ClinicConfig | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [transcript, setTranscript] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false); // talking to backend
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Load clinic config on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("clinicConfig");
    if (stored) {
      try {
        setClinic(JSON.parse(stored));
      } catch (err) {
        console.error("Failed to parse clinicConfig", err);
      }
    }
  }, []);

  // Helper: format transcript from turns[]
  function rebuildTranscript(updated: Turn[]) {
    const text = updated
      .map((t) => `${t.role === "staff" ? "VA" : "Patient"}: ${t.text}`)
      .join("\n");
    setTranscript(text);
  }

  async function ensureRecorderAndStart() {
    setError(null);

    if (!clinic) {
      setError("Clinic setup is missing. Go back and fill out Setup first.");
      alert("Please complete the clinic Setup page before training.");
      router.push("/setup");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setError("This browser does not support microphone recording.");
      alert("Your browser does not support microphone recording.");
      return;
    }

    // If we already have a recorder, just start it
    if (mediaRecorderRef.current) {
      chunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];
        await sendTurnToBackend(blob);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
      setError("Could not access microphone. Check browser permissions.");
      alert(
        "Could not access microphone. Please allow mic access in your browser."
      );
    }
  }

  async function sendTurnToBackend(audioBlob: Blob) {
    if (!clinic) return;

    setIsBusy(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "staff.webm");
      formData.append("mode", mode);
      formData.append("clinicConfig", JSON.stringify(clinic));
      formData.append("turns", JSON.stringify(turns));

      const res = await fetch("/api/voice-turn", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("API error:", text);
        setError("Server error from /api/voice-turn.");
        return;
      }

      const data = await res.json() as {
        staffText: string;
        patientText: string;
        audioBase64: string;
        turns: Turn[];
      };

      // Update local turns & transcript
      setTurns(data.turns);
      rebuildTranscript(data.turns);

      // Play patient audio reply
      if (data.audioBase64) {
        const audio = new Audio(
          `data:audio/mp3;base64,${data.audioBase64}`
        );
        try {
          await audio.play();
        } catch (err) {
          console.error("Error playing audio", err);
        }
      }
    } catch (err) {
      console.error("Error sending turn to backend", err);
      setError("Network error while talking to /api/voice-turn.");
    } finally {
      setIsBusy(false);
    }
  }

  // UI handlers
  function handleStartTalking() {
    if (isBusy) return; // don't let them talk while backend is responding
    ensureRecorderAndStart();
  }

  function handleStopTalking() {
    if (!mediaRecorderRef.current) {
      setIsRecording(false);
      return;
    }
    if (mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  function handleEndCall() {
    if (turns.length === 0) {
      alert("No conversation yet. Try a practice turn first.");
      return;
    }

    // For now just show a simple summary; later you can call a scoring API
    alert("Call ended. In a later phase we'll add scoring + feedback.");
    router.push("/home");
  }

  return (
    <main className="min-h-screen bg-slate-50 flex justify-center p-6">
      <div className="w-full max-w-4xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-2 border-b pb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{MODE_LABELS[mode]} Mode</h1>
            <button
              onClick={() => router.push("/home")}
              className="text-xs rounded border px-3 py-1 bg-white hover:bg-slate-100"
            >
              ← Back to modes
            </button>
          </div>

          <div className="text-sm text-slate-700 flex flex-col gap-1">
            <span>
              <strong>Clinic:</strong>{" "}
              {clinic?.clinicName ?? "Not set"}
            </span>
            <span>
              <strong>Doctor:</strong>{" "}
              {clinic?.doctorName ?? "Not set"}
            </span>
            <span>
              <strong>First Visit Cost:</strong>{" "}
              {clinic ? `$${clinic.firstVisitCost}` : "Not set"}
            </span>
          </div>

          {!clinic && (
            <p className="text-xs text-amber-700">
              Clinic info not configured.{" "}
              <button
                className="underline"
                onClick={() => router.push("/setup")}
              >
                Go to Setup
              </button>{" "}
              so the training can use real details.
            </p>
          )}

          {error && (
            <p className="text-xs text-red-600 mt-1">
              {error}
            </p>
          )}
        </header>

        {/* Transcript area */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Call Transcript
          </h2>
          <div className="h-64 w-full rounded-lg border bg-white p-3 text-sm overflow-y-auto whitespace-pre-wrap">
            {transcript || (
              <span className="text-slate-400">
                Press and hold the mic button, speak, and release.
                Your side and the patient&apos;s replies will appear here.
              </span>
            )}
          </div>
        </section>

        {/* Controls */}
        <section className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Mic button */}
          <button
            type="button"
            disabled={isBusy}
            onMouseDown={handleStartTalking}
            onMouseUp={handleStopTalking}
            onMouseLeave={() => isRecording && handleStopTalking()}
            onTouchStart={handleStartTalking}
            onTouchEnd={handleStopTalking}
            className={`flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold shadow-sm transition ${
              isRecording
                ? "bg-red-600 text-white"
                : "bg-white hover:bg-slate-100"
            } ${isBusy ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <span className="text-lg mr-2">🎙</span>
            {isBusy
              ? "Patient replying..."
              : isRecording
              ? "Listening... Release to stop"
              : "Hold to Talk"}
          </button>

          {/* End Call button */}
          <button
            type="button"
            onClick={handleEndCall}
            className="rounded bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-900"
          >
            End Call &amp; Score
          </button>
        </section>
      </div>
    </main>
  );
}
