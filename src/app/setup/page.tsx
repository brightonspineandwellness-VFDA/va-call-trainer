"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClinicConfig } from "../types/config";


const defaultConfig: ClinicConfig = {
  clinicName: "",
  doctorName: "",
  firstVisitCost: 0,
  address: "",
  officeHours: "",
  services: {
    decompression: false,
    classIVLaser: false,
    shockwave: false,
  },
};

export default function SetupPage() {
  const [config, setConfig] = useState<ClinicConfig>(defaultConfig);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function handleChange(
    field: keyof ClinicConfig,
    value: string | number
  ) {
    setSaved(false);
    setConfig((prev: ClinicConfig) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleServiceChange(
    serviceKey: keyof ClinicConfig["services"]
  ) {
    setSaved(false);
    setConfig((prev: ClinicConfig) => ({
      ...prev,
      services: {
        ...prev.services,
        [serviceKey]: !prev.services[serviceKey],
      },
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "clinicConfig",
        JSON.stringify(config)
      );
    }

    console.log("Clinic config saved:", config);
    setSaved(true);

    setTimeout(() => {
      router.push("/home");
    }, 800);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-2xl rounded-xl border bg-white p-6 shadow-md">
        <h1 className="text-2xl font-bold mb-4">Clinic Setup</h1>
        <p className="text-sm text-slate-600 mb-6">
          Enter the clinic details below. Your VA will use this info when
          handling calls, scheduling, and explaining care plans.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Clinic Name
            </label>
            <input
              type="text"
              className="w-full rounded border px-3 py-2 text-sm"
              value={config.clinicName}
              onChange={(e) =>
                handleChange("clinicName", e.target.value)
              }
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Doctor Name
            </label>
            <input
              type="text"
              className="w-full rounded border px-3 py-2 text-sm"
              value={config.doctorName}
              onChange={(e) =>
                handleChange("doctorName", e.target.value)
              }
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              First Visit Cost ($)
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded border px-3 py-2 text-sm"
              value={config.firstVisitCost}
              onChange={(e) =>
                handleChange(
                  "firstVisitCost",
                  Number(e.target.value || 0)
                )
              }
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Address
            </label>
            <textarea
              className="w-full rounded border px-3 py-2 text-sm"
              rows={2}
              value={config.address}
              onChange={(e) =>
                handleChange("address", e.target.value)
              }
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Office Hours
            </label>
            <textarea
              className="w-full rounded border px-3 py-2 text-sm"
              rows={2}
              placeholder="e.g. Mon–Thu 9–1 & 3–6, Fri 9–1"
              value={config.officeHours}
              onChange={(e) =>
                handleChange("officeHours", e.target.value)
              }
              required
            />
          </div>

          <div>
            <p className="block text-sm font-medium mb-1">
              Services Offered
            </p>
            <div className="flex flex-col gap-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.services.decompression}
                  onChange={() =>
                    handleServiceChange("decompression")
                  }
                />
                <span>Spinal Decompression</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.services.classIVLaser}
                  onChange={() =>
                    handleServiceChange("classIVLaser")
                  }
                />
                <span>Class IV Laser Therapy</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.services.shockwave}
                  onChange={() =>
                    handleServiceChange("shockwave")
                  }
                />
                <span>Shockwave Therapy</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 rounded bg-black px-4 py-2 text-sm font-semibold text-white"
          >
            Save Clinic Setup
          </button>

          {saved && (
            <p className="text-sm text-emerald-600 mt-2">
              Setup saved! Redirecting you to the main app…
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
