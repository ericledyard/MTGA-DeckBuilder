"use client";

import { useRef, useState } from "react";

// Parses untapped.gg collection export lines: "4 Lightning Bolt (M21) 160"
function parseCollectionText(
  text: string,
): {
  name: string;
  setCode: string | null;
  collectorNumber: string | null;
  quantity: number;
}[] {
  const LINE = /^(\d+)\s+(.+?)(?:\s+\(([A-Z0-9]+)\)\s+(\S+))?$/;
  return text
    .split("\n")
    .map((raw) => {
      const m = raw.trim().match(LINE);
      if (!m) return null;
      return {
        quantity: parseInt(m[1], 10),
        name: m[2].trim(),
        setCode: m[3] ?? null,
        collectorNumber: m[4] ?? null,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null && c.quantity > 0);
}

export interface ResolvedCollectionCard {
  oracle_id: string;
  name: string;
  quantity_regular: number;
  quantity_foil: number;
  image_uri_normal: string | null;
  rarity: string;
}

interface PreviewRow {
  name: string;
  quantity: number;
  found: boolean;
  resolved?: ResolvedCollectionCard;
}

interface ImportCollectionModalProps {
  onImport: (cards: ResolvedCollectionCard[]) => Promise<void>;
  onClose: () => void;
}

type Step = "input" | "loading" | "preview" | "importing";

export function ImportCollectionModal({
  onImport,
  onClose,
}: ImportCollectionModalProps) {
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText((ev.target?.result as string) ?? "");
    reader.readAsText(file);
  }

  async function handleParse() {
    if (!text.trim()) return;
    setError(null);
    setStep("loading");

    const parsed = parseCollectionText(text);
    if (parsed.length === 0) {
      setError(
        "No card lines found. Expected format: 4 Lightning Bolt (M21) 160",
      );
      setStep("input");
      return;
    }

    // Resolve via existing lookup endpoint
    const res = await fetch("/api/cards/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: parsed.map((c) => ({
          name: c.name,
          setCode: c.setCode,
          collectorNumber: c.collectorNumber,
        })),
      }),
    }).catch(() => null);

    if (!res?.ok) {
      setError("Failed to resolve cards. Please try again.");
      setStep("input");
      return;
    }

    const resolved: {
      oracle_id: string;
      name: string;
      image_uri_normal: string | null;
      rarity: string;
    }[] = await res.json();

    // Build a lookup map: lower(name) → resolved card
    const byName = new Map(resolved.map((r) => [r.name.toLowerCase(), r]));

    const rows: PreviewRow[] = parsed.map((c) => {
      const match = byName.get(c.name.toLowerCase());
      if (!match) return { name: c.name, quantity: c.quantity, found: false };
      return {
        name: c.name,
        quantity: c.quantity,
        found: true,
        resolved: {
          oracle_id: match.oracle_id,
          name: match.name,
          quantity_regular: c.quantity,
          quantity_foil: 0,
          image_uri_normal: match.image_uri_normal,
          rarity: match.rarity,
        },
      };
    });

    setPreview(rows);
    setStep("preview");
  }

  async function handleConfirm() {
    const cards = preview
      .filter((r) => r.found && r.resolved)
      .map((r) => r.resolved!);

    if (cards.length === 0) return;
    setStep("importing");
    await onImport(cards);
    onClose();
  }

  const found = preview.filter((r) => r.found).length;
  const notFound = preview.filter((r) => !r.found).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            Import from untapped.gg
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {(step === "input" || step === "loading") && (
            <>
              <p className="text-sm text-gray-400">
                Export your collection from untapped.gg and paste it below, or
                upload the .txt file.
              </p>

              {error && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 text-sm border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                >
                  Upload .txt file
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {text && (
                  <span className="text-xs text-gray-500 self-center">
                    File loaded
                  </span>
                )}
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  "4 Lightning Bolt (M21) 160\n2 Island (ANB) 59\n..."
                }
                className="w-full h-48 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none font-mono"
              />
            </>
          )}

          {step === "preview" && (
            <>
              <div className="flex gap-4 text-sm">
                <span className="text-green-400 font-medium">
                  ✓ {found} found
                </span>
                {notFound > 0 && (
                  <span className="text-red-400 font-medium">
                    ✗ {notFound} not found
                  </span>
                )}
              </div>

              <div className="space-y-1 max-h-64 overflow-y-auto">
                {preview.map((row, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm ${
                      row.found
                        ? "bg-gray-800/50 text-gray-200"
                        : "bg-red-900/20 text-red-400"
                    }`}
                  >
                    <span className="w-5 text-right font-mono text-gray-400">
                      {row.quantity}
                    </span>
                    <span className="flex-1 truncate">{row.name}</span>
                    {!row.found && (
                      <span className="text-xs text-red-500">not found</span>
                    )}
                  </div>
                ))}
              </div>

              {notFound > 0 && (
                <p className="text-xs text-gray-500">
                  Not-found cards will be skipped. You can add them manually
                  later.
                </p>
              )}
            </>
          )}

          {step === "importing" && (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
              Importing {found} cards…
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 flex justify-end gap-3">
          {step === "input" && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={!text.trim()}
                className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-950 font-semibold rounded-lg transition-colors"
              >
                Preview cards
              </button>
            </>
          )}

          {step === "loading" && (
            <span className="text-sm text-gray-400">Resolving cards…</span>
          )}

          {step === "preview" && (
            <>
              <button
                onClick={() => setStep("input")}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={found === 0}
                className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-950 font-semibold rounded-lg transition-colors"
              >
                Import {found} cards
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
