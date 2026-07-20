import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  type ArrangementSection,
  type SectionType,
  sectionTypeDefs,
  arrangementTemplates,
  generateArrangement,
  autoArrange,
} from "~/data/mock";

export const Route = createFileRoute("/arrangement")({
  component: Arrangement,
});

const defaultSections: ArrangementSection[] = [
  { id: "s1", label: "Intro", type: "intro", startBar: 1, bars: 4, color: "#3b82f6", energy: 5 },
  { id: "s2", label: "Verse 1", type: "verse", startBar: 5, bars: 16, color: "#10b981", energy: 6 },
  { id: "s3", label: "Hook", type: "hook", startBar: 21, bars: 8, color: "#7c3aed", energy: 8 },
  { id: "s4", label: "Verse 2", type: "verse", startBar: 29, bars: 16, color: "#10b981", energy: 7 },
  { id: "s5", label: "Hook", type: "hook", startBar: 45, bars: 8, color: "#7c3aed", energy: 9 },
  { id: "s6", label: "Bridge", type: "bridge", startBar: 53, bars: 8, color: "#f59e0b", energy: 6 },
  { id: "s7", label: "Hook (Out)", type: "hook", startBar: 61, bars: 8, color: "#7c3aed", energy: 8 },
  { id: "s8", label: "Outro", type: "outro", startBar: 69, bars: 4, color: "#ef4444", energy: 4 },
];

function Arrangement() {
  const [sections, setSections] = useState<ArrangementSection[]>(defaultSections);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [dragState, setDragState] = useState<{
    dragId: string;
    startX: number;
    origStartBar: number;
    isResize: boolean;
    resizeEdge: "left" | "right" | null;
  } | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const totalBars = useCallback(() => {
    if (sections.length === 0) return 8;
    const last = sections[sections.length - 1];
    return last.startBar + last.bars - 1;
  }, [sections]);

  const recalcPositions = (secs: ArrangementSection[]): ArrangementSection[] => {
    let currentStart = 1;
    return secs.map((s, i) => {
      const updated = { ...s, startBar: currentStart };
      currentStart += s.bars;
      return updated;
    });
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    setSections((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      return recalcPositions(filtered);
    });
    if (selectedId === id) setSelectedId(null);
  };

  const handleDblClick = (id: string, label: string) => {
    setEditingId(id);
    setEditLabel(label);
  };

  const handleLabelSave = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, label: editLabel || s.label } : s))
    );
    setEditingId(null);
  };

  const handleAddSection = (type: SectionType) => {
    const def = sectionTypeDefs.find((d) => d.type === type);
    const newSection: ArrangementSection = {
      id: `s-${Date.now()}`,
      label: def?.label || type,
      type,
      startBar: 1,
      bars: 8,
      color: def?.color || "#7c3aed",
      energy: 5,
      notes: "",
    };
    setSections((prev) => recalcPositions([...prev, newSection]));
    setShowAddMenu(false);
  };

  const handleTemplate = (templateId: string) => {
    const generated = generateArrangement(templateId);
    setSections(generated);
    setSelectedId(null);
  };

  const handleAutoArrange = () => {
    const generated = autoArrange();
    setSections(generated);
    setSelectedId(null);
  };

  const handleBarChange = (id: string, bars: number) => {
    setSections((prev) =>
      recalcPositions(prev.map((s) => (s.id === id ? { ...s, bars: Math.max(1, Math.min(64, bars)) } : s)))
    );
  };

  const handleEnergyChange = (id: string, energy: number) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, energy } : s))
    );
  };

  const handleNotesChange = (id: string, notes: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, notes } : s))
    );
  };

  const handleTempoToggle = (id: string, enabled: boolean) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, tempo: enabled ? (s.tempo || 140) : null } : s))
    );
  };

  const handleKeyToggle = (id: string, enabled: boolean) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, keyChange: enabled ? (s.keyChange || "Dm") : null } : s))
    );
  };

  // Drag and drop for reordering
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent, id: string, isResize: boolean, edge: "left" | "right" | null) => {
    e.preventDefault();
    const section = sections.find((s) => s.id === id);
    if (!section) return;
    setDragState({
      dragId: id,
      startX: e.clientX,
      origStartBar: section.startBar,
      isResize,
      resizeEdge: edge,
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e: MouseEvent) => {
      const totalB = totalBars();
      const timelineWidth = timelineRef.current?.getBoundingClientRect().width || 800;
      const deltaPx = e.clientX - dragState.startX;
      const barsPerPx = totalB / timelineWidth;
      const deltaBars = Math.round(deltaPx * barsPerPx);

      if (dragState.isResize && dragState.resizeEdge) {
        setSections((prev) => {
          const sec = prev.find((s) => s.id === dragState.dragId);
          if (!sec) return prev;
          const newBars = dragState.resizeEdge === "right"
            ? Math.max(1, sec.bars + deltaBars)
            : Math.max(1, sec.bars - deltaBars);
          return prev.map((s) => s.id === dragState.dragId ? { ...s, bars: newBars } : s);
        });
      } else {
        // Reorder — move section to new position in list
        setSections((prev) => {
          const idx = prev.findIndex((s) => s.id === dragState.dragId);
          if (idx === -1) return prev;
          const newStart = Math.max(0, dragState.origStartBar + deltaBars);

          // Find insertion index based on new start position
          const without = prev.filter((s) => s.id !== dragState.dragId);
          let insertIdx = 0;
          let cumulativeStart = 1;
          for (let i = 0; i < without.length; i++) {
            if (cumulativeStart + without[i].bars / 2 > newStart) {
              insertIdx = i;
              break;
            }
            cumulativeStart += without[i].bars;
            insertIdx = i + 1;
          }

          const item = prev[idx];
          const result = [...without.slice(0, insertIdx), item, ...without.slice(insertIdx)];
          return recalcPositions(result);
        });
      }
    };

    const handleUp = () => {
      setSections((prev) => recalcPositions(prev));
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragState, totalBars]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Backspace" && selectedId && document.activeElement === document.body) {
        handleDelete(selectedId);
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        setEditingId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId]);

  const selected = sections.find((s) => s.id === selectedId);
  const totalBarCount = totalBars();

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Song Arrangement</h1>
          <p className="text-sm text-[var(--color-juice-200)] mt-1">Structure your track with visual section blocks</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleAutoArrange} className="btn-glass text-xs">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Auto-Arrange
          </button>
          <div className="relative" ref={addMenuRef}>
            <button onClick={() => setShowAddMenu(!showAddMenu)} className="btn-primary text-xs">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              Add Section
            </button>
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-[var(--color-juice-800)] border border-[var(--color-glass-border)] rounded-xl shadow-xl p-2 space-y-0.5">
                {sectionTypeDefs.map((def) => (
                  <button
                    key={def.type}
                    onClick={() => handleAddSection(def.type)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-[var(--color-juice-100)] hover:bg-[var(--color-glass-bg)] hover:text-white transition-all flex items-center gap-2"
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: def.color }} />
                    {def.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Main Timeline */}
        <div className="lg:col-span-8 space-y-4">
          {/* Timeline View */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Timeline</h2>
              <div className="text-xs text-[var(--color-juice-300)]">
                {sections.length} sections · {totalBarCount} bars
              </div>
            </div>

            {/* Bar numbers */}
            <div className="flex mb-2" ref={timelineRef}>
              {Array.from({ length: Math.min(totalBarCount, 96) }).map((_, i) => (
                <div key={i} className="flex-shrink-0" style={{ width: `${100 / Math.min(totalBarCount, 96)}%`, minWidth: "8px" }}>
                  {i % 4 === 0 && (
                    <span className="text-[9px] text-[var(--color-juice-400)] font-mono">{i + 1}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Section blocks */}
            <div
              className="relative rounded-xl bg-[var(--color-juice-750)] overflow-hidden"
              style={{ height: "64px" }}
            >
              {sections.map((section) => {
                const isSelected = selectedId === section.id;
                return (
                  <div
                    key={section.id}
                    onClick={() => handleSelect(section.id)}
                    onDoubleClick={() => handleDblClick(section.id, section.label)}
                    onMouseDown={(e) => handleDragStart(e, section.id, false, null)}
                    className={`absolute top-1.5 bottom-1.5 rounded-lg flex items-center px-2 cursor-pointer transition-all select-none ${
                      isSelected ? "ring-2 ring-white/30 brightness-110" : "hover:brightness-110"
                    }`}
                    style={{
                      left: `${((section.startBar - 1) / totalBarCount) * 100}%`,
                      width: `${(section.bars / totalBarCount) * 100}%`,
                      backgroundColor: `${section.color}40`,
                      borderLeft: `3px solid ${section.color}`,
                      minWidth: section.bars < 2 ? "16px" : undefined,
                      cursor: dragState ? "grabbing" : "grab",
                    }}
                    title={`${section.label}: ${section.bars} bars · Energy: ${section.energy}/10`}
                  >
                    {section.bars >= 3 && (
                      <span className="text-[11px] font-medium text-white truncate leading-tight">
                        {section.label}
                      </span>
                    )}
                    {section.bars >= 5 && (
                      <span className="text-[10px] text-white/60 ml-auto">{section.bars}b</span>
                    )}
                    {/* Resize handles */}
                    {isSelected && (
                      <>
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/10 rounded-l-lg"
                          onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e, section.id, true, "left"); }}
                        />
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/10 rounded-r-lg"
                          onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e, section.id, true, "right"); }}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Guide */}
            <p className="text-[10px] text-[var(--color-juice-400)] mt-2">
              Drag blocks to reorder · Drag edges to resize · Double-click to rename · Click to select · Backspace to delete
            </p>
          </div>

          {/* Section List */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Sections</h2>
            <div className="space-y-1.5">
              {sections.map((section) => (
                <div
                  key={section.id}
                  onClick={() => handleSelect(section.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                    selectedId === section.id
                      ? "bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20"
                      : "bg-[var(--color-glass-bg)] border border-transparent hover:border-[var(--color-glass-border)]"
                  }`}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: section.color }} />
                  {editingId === section.id ? (
                    <input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onBlur={() => handleLabelSave(section.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleLabelSave(section.id); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1 bg-transparent text-sm text-white outline-none border-b border-[var(--color-accent)]"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 text-sm font-medium text-white">{section.label}</span>
                  )}
                  <span className="text-xs text-[var(--color-juice-300)]">
                    {section.startBar}–{section.startBar + section.bars - 1}
                  </span>
                  <span className="text-xs text-[var(--color-juice-400)]">{section.bars}b</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: i <= section.energy / 3.5 ? section.color : "var(--color-juice-500)" }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(section.id); }}
                    className="p-1 rounded-md hover:bg-red-500/10 text-[var(--color-juice-400)] hover:text-red-400 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-4 space-y-4">
          {/* Selected section properties */}
          {selected ? (
            <div className="card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Section Properties</h3>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="btn-glass p-1.5 text-xs text-red-400"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>

              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] uppercase tracking-wider">Name</label>
                <input
                  value={selected.label}
                  onChange={(e) => setSections((prev) => prev.map((s) => s.id === selected.id ? { ...s, label: e.target.value } : s))}
                  className="w-full mt-1 bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] uppercase tracking-wider">Bar Count</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="64"
                    value={selected.bars}
                    onChange={(e) => handleBarChange(selected.id, parseInt(e.target.value) || 1)}
                    className="w-20 bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent)]"
                  />
                  <span className="text-xs text-[var(--color-juice-300)]">bars</span>
                  <span className="text-xs text-[var(--color-juice-400)] ml-auto">
                    Bars {selected.startBar}–{selected.startBar + selected.bars - 1}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] uppercase tracking-wider">Energy Level</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={selected.energy}
                    onChange={(e) => handleEnergyChange(selected.id, parseInt(e.target.value))}
                    className="flex-1 accent-[var(--color-accent)]"
                  />
                  <span className="text-sm font-bold text-white w-6 text-center">{selected.energy}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--color-juice-300)] uppercase tracking-wider">Tempo Change</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selected.tempo}
                    onChange={(e) => handleTempoToggle(selected.id, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-[var(--color-juice-500)] peer-checked:bg-[var(--color-accent)] rounded-full peer transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:after:translate-x-3.5" />
                </label>
              </div>
              {selected.tempo && (
                <input
                  type="number"
                  value={selected.tempo}
                  onChange={(e) => setSections((prev) => prev.map((s) => s.id === selected.id ? { ...s, tempo: parseInt(e.target.value) || 140 } : s))}
                  className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white outline-none"
                  placeholder="BPM"
                />
              )}

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--color-juice-300)] uppercase tracking-wider">Key Change</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selected.keyChange}
                    onChange={(e) => handleKeyToggle(selected.id, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-[var(--color-juice-500)] peer-checked:bg-[var(--color-accent)] rounded-full peer transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:after:translate-x-3.5" />
                </label>
              </div>
              {selected.keyChange && (
                <select
                  value={selected.keyChange}
                  onChange={(e) => setSections((prev) => prev.map((s) => s.id === selected.id ? { ...s, keyChange: e.target.value } : s))}
                  className="w-full bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white outline-none"
                >
                  {["Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm", "C", "D", "E", "F", "G", "A", "B"].map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              )}

              <div>
                <label className="text-[10px] text-[var(--color-juice-300)] uppercase tracking-wider">Notes</label>
                <textarea
                  value={selected.notes || ""}
                  onChange={(e) => handleNotesChange(selected.id, e.target.value)}
                  placeholder="Add production notes..."
                  className="w-full mt-1 bg-[var(--color-juice-700)] border border-[var(--color-glass-border)] rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--color-juice-400)] outline-none focus:border-[var(--color-accent)] resize-none h-20"
                />
              </div>
            </div>
          ) : (
            <div className="card p-4 text-center">
              <p className="text-xs text-[var(--color-juice-300)]">Select a section to edit properties</p>
            </div>
          )}

          {/* Templates */}
          <div className="card p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white mb-2">Templates</h3>
            {arrangementTemplates.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => handleTemplate(tmpl.id)}
                className="w-full text-left p-3 rounded-lg bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)] hover:border-[var(--color-glass-border-hover)] transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">{tmpl.name}</span>
                  {tmpl.structure.length > 0 && (
                    <span className="text-[10px] text-[var(--color-juice-400)]">{tmpl.structure.reduce((s, st) => s + st.bars, 0)} bars</span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--color-juice-300)] mt-0.5">{tmpl.description}</p>
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[var(--color-glass-bg)]">
                <span className="text-[10px] text-[var(--color-juice-300)] uppercase tracking-wider">Total Bars</span>
                <p className="text-xl font-bold text-white mt-0.5">{totalBarCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-glass-bg)]">
                <span className="text-[10px] text-[var(--color-juice-300)] uppercase tracking-wider">Sections</span>
                <p className="text-xl font-bold text-white mt-0.5">{sections.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-glass-bg)]">
                <span className="text-[10px] text-[var(--color-juice-300)] uppercase tracking-wider">Duration ~</span>
                <p className="text-xl font-bold text-white mt-0.5">
                  {Math.floor(totalBarCount * 4 / 140 * 60)}s
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-glass-bg)]">
                <span className="text-[10px] text-[var(--color-juice-300)] uppercase tracking-wider">Avg Energy</span>
                <p className="text-xl font-bold text-white mt-0.5">
                  {sections.length > 0 ? (sections.reduce((s, sec) => s + sec.energy, 0) / sections.length).toFixed(1) : "—"}
                </p>
              </div>
            </div>
            <button className="btn-primary w-full text-xs justify-center mt-3">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Export Arrangement
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
