"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClinicConfig } from "../../types/config";

type ModeId = "easy" | "challenging" | "skeptical" | "creepy";

const MODES: { id: ModeId; label: string; description: string }[] = [
  {
    id: "easy",
    label: "Easy",
    description: "Friendly, curious caller who wants information and is easy to book.",
  },
  {
    id: "challenging",
    label: "Challenging",
    description:
      "Busy, distracted caller with objections about time, money, or commitment.",
  },
  {
    id: "skeptical",
    label: "Skeptical",
    description:
      "Questioning your methods, wants proof and reassurance before scheduling.",
  },
  {
    id: "creepy",
    label: "Creepy",
    description:
      "Inappropriate, boundary-pushing caller. Good for teaching VAs to set boundaries.",
  },
];

export default function HomePage() {
  const [clinic, setClinic] = useState<ClinicConfig | null>(null);

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

  return (
    <main className="min-h-screen bg-slate-50 flex justify-center p-6">
      <div className="w-full max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">VA Call Trainer</h1>
          <p className="text-slate-600">
            Choose a call style below and practice handling real-world scenarios.
          </p>

          <div className="mt-4 inline-flex flex-col gap-1 text-sm text-slate-700">
            <span>
              <strong>Clinic:</strong> {clinic?.clinicName ?? "Not set"}
            </span>
            <span>
              <strong>Doctor:</strong> {clinic?.doctorName ?? "Not set"}
            </span>
            {!clinic && (
              <span className="text-amber-700">
                Clinic not configured.{" "}
                <Link href="/setup" className="underline font-medium">
                  Go to Setup
                </Link>
              </span>
            )}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {MODES.map((mode) => (
            <Link
              key={mode.id}
              href={`/train?mode=${mode.id}`}
              className="block rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <h2 className="text-lg font-semibold mb-1">
                {mode.label} Mode
              </h2>
              <p className="text-sm text-slate-600">{mode.description}</p>
              <p className="mt-3 text-xs text-slate-500">
                Click to start a training call in this style.
              </p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
