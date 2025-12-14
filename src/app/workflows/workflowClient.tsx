"use client";

import { useEffect, useMemo, useState } from "react";

type WorkflowKind = "PERSONAL" | "BUSINESS";

type WorkflowRow = {
  id: string;
  kind: WorkflowKind;
  name: string;
  data: any;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function formatDate(d: any) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString();
}

function pill(kind: WorkflowKind) {
  return kind === "BUSINESS"
    ? "bg-cyan-500/10 border border-cyan-400/30 text-cyan-100"
    : "bg-purple-500/10 border border-purple-400/30 text-purple-100";
}

export default function WorkflowClient({ initialWorkflows }: { initialWorkflows: WorkflowRow[] }) {
  const [rows, setRows] = useState<WorkflowRow[]>(() => initialWorkflows);
  useEffect(() => setRows(initialWorkflows), [initialWorkflows]);

  const [activeId, setActiveId] = useState<string | null>(rows[0]?.id ?? null);

  const active = useMemo(() => rows.find((r) => r.id === activeId) ?? null, [rows, activeId]);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<WorkflowKind>("PERSONAL");
  const [dataText, setDataText] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    setName(active.name);
    setKind(active.kind);
    setDataText(JSON.stringify(active.data ?? {}, null, 2));
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }

  async function refresh() {
    const res = await fetch("/api/workflows", { cache: "no-store" });
    if (!res.ok) return;
    const body = await res.json().catch(() => null);
    const next = Array.isArray(body?.workflows) ? body.workflows : [];
    setRows(next);
    if (!activeId && next[0]?.id) setActiveId(next[0].id);
    if (activeId && !next.some((r: any) => r.id === activeId)) setActiveId(next[0]?.id ?? null);
  }

  async function save() {
    if (!active) return;
    let parsed: any = null;
    try {
      parsed = JSON.parse(dataText || "{}");
    } catch {
      flash("Data JSON is invalid.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${active.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, kind, data: parsed }),
      });
      if (!res.ok) {
        flash(`Save failed (${res.status})`);
        return;
      }
      flash("Updated ✅");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!active) return;
    const ok = window.confirm(`Delete "${active.name}"? This cannot be undone.`);
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${active.id}`, { method: "DELETE" });
      if (!res.ok) {
        flash(`Delete failed (${res.status})`);
        return;
      }
      flash("Deleted ✅");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-gray-300">
        No saved workflows yet. Create one inside the “Recommend tools for me” wizard.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="text-xs text-gray-400 mb-2">Your workflows</div>

        <div className="space-y-2">
          {rows.map((r) => {
            const activeRow = r.id === activeId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveId(r.id)}
                className={
                  activeRow
                    ? "w-full text-left rounded-2xl border border-purple-400/40 bg-white/10 px-3 py-2 transition"
                    : "w-full text-left rounded-2xl border border-white/10 bg-black/10 px-3 py-2 hover:bg-white/5 hover:border-white/20 transition"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-100 truncate">{r.name}</div>
                    <div className="mt-1 text-[11px] text-gray-400 truncate">
                      Updated: {formatDate(r.updatedAt)}
                    </div>
                  </div>

                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${pill(r.kind)}`}>
                    {r.kind === "BUSINESS" ? "Business" : "Personal"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-gray-400">Edit workflow</div>
            <div className="text-sm text-gray-200 mt-1">
              Tip: these fields are the exact same payload used by the recommender wizard.
            </div>
          </div>

          {toast && (
            <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] text-gray-100">
              {toast}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <div className="mb-1 text-[11px] text-gray-400">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
              placeholder="e.g., My day job (Support) / My Agency workflow"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-[11px] text-gray-400">Type</div>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as WorkflowKind)}
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
            >
              <option value="PERSONAL" className="bg-[#020617]">
                Personal
              </option>
              <option value="BUSINESS" className="bg-[#020617]">
                Business
              </option>
            </select>
          </label>
        </div>

        <label className="block mt-3">
          <div className="mb-1 text-[11px] text-gray-400">Data (JSON)</div>
          <textarea
            value={dataText}
            onChange={(e) => setDataText(e.target.value)}
            rows={14}
            className="w-full rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-gray-100 font-mono placeholder:text-gray-500 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
          />
        </label>

        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="rounded-full px-4 py-2 text-xs font-semibold border border-rose-400/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15 hover:border-rose-300/30 transition disabled:opacity-60"
          >
            Delete
          </button>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-full px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-500/70 to-blue-500/60 border border-purple-400/40 hover:opacity-90 transition disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
