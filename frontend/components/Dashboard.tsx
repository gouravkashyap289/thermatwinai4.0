"use client";

import {
  Activity, AlertTriangle, BarChart3, Bot, Box, ChevronDown, CircleGauge, Database,
  Download, Droplets, Factory, Gauge, LayoutDashboard, Menu, Play, Pause, RefreshCw,
  Radio, Search, Settings, SlidersHorizontal, Sparkles, Thermometer, Waves, Wrench, X, Zap,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

import { optimizeLocal, recalculate, seedWell, seedWells, type Well } from "@/lib/data";

const WellTwin = dynamic(() => import("@/components/WellTwin"), {
  ssr: false,
  loading: () => <div className="twin-shell compact"><div className="empty-prompt"><Box /><p>Loading physics-responsive twin…</p></div></div>,
});


type View = "Overview" | "Wells" | "Digital Twin" | "CSS Optimizer" | "SRP Optimizer" | "Predictive Maintenance" | "What-If Simulator" | "AI Well Advisor" | "Analytics" | "Reports" | "Settings";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const navigation: { label: View; icon: LucideIcon }[] = [
  { label: "Overview", icon: LayoutDashboard }, { label: "Wells", icon: Droplets },
  { label: "Digital Twin", icon: Box }, { label: "CSS Optimizer", icon: Waves },
  { label: "SRP Optimizer", icon: CircleGauge }, { label: "Predictive Maintenance", icon: Wrench },
  { label: "What-If Simulator", icon: SlidersHorizontal }, { label: "AI Well Advisor", icon: Bot },
  { label: "Analytics", icon: BarChart3 }, { label: "Reports", icon: Download },
  { label: "Settings", icon: Settings },
];

const fmt = (value: number, digits = 0) => value.toLocaleString("en-US", { maximumFractionDigits: digits });
const pct = (value: number) => `${Math.round(value * 100)}%`;
const phaseLabel = (phase: string) => phase === "INJECTION" ? "CSS INJECTION" : phase;

function MetricCard({ label, value, unit, trend, icon: Icon, warning }: { label: string; value: string; unit?: string; trend?: string; icon: LucideIcon; warning?: boolean }) {
  return (
    <div className={`metric-card ${warning ? "warning" : ""}`}>
      <div className="metric-top"><span>{label}</span><Icon size={17} /></div>
      <div className="metric-value">{value}<small>{unit}</small></div>
      {trend && <div className="metric-trend">{trend}</div>}
    </div>
  );
}

function Panel({ title, kicker, action, children, className = "" }: { title: string; kicker?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head"><div>{kicker && <span className="eyebrow">{kicker}</span>}<h2>{title}</h2></div>{action}</header>
      {children}
    </section>
  );
}

function RiskBadge({ value }: { value: number }) {
  const level = value >= 0.8 ? "CRITICAL" : value >= 0.6 ? "HIGH" : value >= 0.35 ? "MEDIUM" : "LOW";
  return <span className={`risk-badge ${level.toLowerCase()}`}>{level} · {pct(value)}</span>;
}

function ProcessRail({ well }: { well: Well }) {
  const stages = [
    { label: "Reservoir", value: `${fmt(well.reservoir_temperature)}°C`, note: `${fmt(well.oil_viscosity)} cP`, state: well.reservoir_temperature < 68 ? "warn" : "ok" },
    { label: "CSS thermal", value: well.css_phase, note: `${fmt(well.heated_radius, 1)} m radius`, state: well.css_phase === "INJECTION" ? "live" : "ok" },
    { label: "Wellbore", value: `${fmt(well.reservoir_pressure)} bar`, note: `${pct(well.water_cut)} water cut`, state: "ok" },
    { label: "SRP lift", value: `${fmt(well.spm, 1)} SPM`, note: `${pct(well.pump_fillage)} fillage`, state: well.rod_floating_risk > 0.6 ? "critical" : "warn" },
    { label: "Surface", value: `${fmt(well.oil_rate, 1)} BPD`, note: `${fmt(well.energy_consumption, 1)} kWh/bbl`, state: "live" },
  ];
  return <div className="process-rail" aria-label="Well-to-surface process state">{stages.map((stage, index) => <div className="process-stage" key={stage.label}><div className={`stage-node ${stage.state}`}><i /><span>{stage.label}</span><b>{stage.value}</b><small>{stage.note}</small></div>{index < stages.length - 1 && <div className="flow-line"><i /></div>}</div>)}</div>;
}

function AlarmFeed({ wells, onOpen }: { wells: Well[]; onOpen: (wellId: string) => void }) {
  const alarms = [...wells].sort((left, right) => right.failure_risk - left.failure_risk).slice(0, 4);
  return <div className="alarm-feed">{alarms.map((well, index) => <button key={well.well_id} onClick={() => onOpen(well.well_id)}><span className={`alarm-rank ${well.failure_risk > 0.7 ? "critical" : well.failure_risk > 0.45 ? "high" : "medium"}`}>P{well.failure_risk > 0.7 ? "1" : well.failure_risk > 0.45 ? "2" : "3"}</span><div><b>{well.well_id} · {index % 2 ? "Pump fillage drift" : "Rod-float tendency"}</b><small>{index % 2 ? `${pct(well.pump_fillage)} fillage · ${fmt(well.motor_current, 1)} A` : `${fmt(well.spm, 1)} SPM · ${fmt(well.oil_viscosity)} cP`}</small></div><RiskBadge value={well.failure_risk} /></button>)}</div>;
}

function Slider({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider-field">
      <span><b>{label}</b><output>{fmt(value, step < 1 ? 1 : 0)} {unit}</output></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} style={{ "--progress": `${progress}%` } as React.CSSProperties} />
      <small><i>{min}</i><i>{max}</i></small>
    </label>
  );
}

function TrendChart({ data, dataKey, color = "#40d8d2", type = "area" }: { data: Record<string, number | string>[]; dataKey: string; color?: string; type?: "area" | "line" | "bar" }) {
  const common = <><CartesianGrid strokeDasharray="3 3" stroke="#1d3038" vertical={false} /><XAxis dataKey="label" tick={{ fill: "#758a95", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#758a95", fontSize: 10 }} axisLine={false} tickLine={false} width={34} /><Tooltip contentStyle={{ background: "#101d24", border: "1px solid #28404a", borderRadius: 8, fontSize: 12 }} /></>;
  if (type === "bar") return <ResponsiveContainer width="100%" height="100%"><BarChart data={data}>{common}<Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>;
  if (type === "line") return <ResponsiveContainer width="100%" height="100%"><LineChart data={data}>{common}<Line dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>;
  return <ResponsiveContainer width="100%" height="100%"><AreaChart data={data}>{common}<defs><linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.35} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs><Area dataKey={dataKey} stroke={color} fill={`url(#fill-${dataKey})`} strokeWidth={2} /></AreaChart></ResponsiveContainer>;
}

export default function Dashboard() {
  const [view, setView] = useState<View>("Overview");
  const [wells, setWells] = useState<Well[]>(seedWells);
  const [selectedId, setSelectedId] = useState("BW-07");
  const [running, setRunning] = useState(true);
  const [connected, setConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [optimized, setOptimized] = useState<Well | null>(null);
  const [question, setQuestion] = useState("Why is BW-07 production falling?");
  const [answer, setAnswer] = useState("");
  const current = wells.find((well) => well.well_id === selectedId) ?? wells[0];

  const updateCurrent = (changes: Partial<Well>) => {
    setWells((items) => items.map((well) => well.well_id === selectedId ? recalculate(well, changes) : well));
    setOptimized(null);
  };

  useEffect(() => {
    fetch(`${API}/api/wells`).then((response) => response.ok ? response.json() : Promise.reject()).then((data: Well[]) => {
      if (Array.isArray(data) && data.length) setWells(data);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!running) return;
    const socket = new WebSocket(`${API.replace(/^http/, "ws")}/ws/live/${selectedId}`);
    socket.onopen = () => setConnected(true);
    socket.onmessage = (event) => {
      const next = JSON.parse(event.data) as Well;
      setWells((items) => items.map((well) => well.well_id === selectedId ? next : well));
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => setConnected(false);
    return () => socket.close();
  }, [selectedId, running]);

  useEffect(() => {
    if (!running || connected) return;
    const interval = window.setInterval(() => {
      setWells((items) => items.map((well) => {
        if (well.well_id !== selectedId) return well;
        const temperature = well.css_phase === "INJECTION" ? well.reservoir_temperature + 0.38 : well.reservoir_temperature + (32 - well.reservoir_temperature) * 0.003;
        const fillage = Math.max(0.42, Math.min(0.93, well.pump_fillage + (Math.random() - 0.5) * 0.014));
        return recalculate(well, { reservoir_temperature: temperature, pump_fillage: fillage });
      }));
    }, 2000);
    return () => window.clearInterval(interval);
  }, [selectedId, running, connected]);

  const history = useMemo(() => Array.from({ length: 24 }, (_, index) => {
    const cycle = Math.sin(index / 3.2);
    return {
      label: `${String(index).padStart(2, "0")}:00`,
      oil: Math.max(8, current.oil_rate + cycle * 7 - (23 - index) * 0.45),
      steam: index > 3 && index < 8 ? current.steam_volume / 4 : 0,
      energy: current.energy_consumption + Math.cos(index / 3) * 2.4,
      temperature: current.reservoir_temperature + (23 - index) * 0.36 + cycle,
      efficiency: (current.pump_efficiency + cycle * 0.025) * 100,
      risk: (current.failure_risk - cycle * 0.026) * 100,
      viscosity: current.oil_viscosity - (23 - index) * 4.1 - cycle * 12,
      spm: current.spm + cycle * 0.15,
    };
  }), [current]);

  const totals = useMemo(() => ({
    oil: wells.reduce((sum, well) => sum + well.oil_rate, 0),
    efficiency: wells.reduce((sum, well) => sum + well.pump_efficiency, 0) / wells.length,
    sor: wells.reduce((sum, well) => sum + well.steam_oil_ratio, 0) / wells.length,
    attention: wells.filter((well) => well.status !== "NORMAL").length,
    critical: wells.filter((well) => well.failure_risk >= 0.72).length,
    css: wells.filter((well) => well.css_phase === "INJECTION" || well.css_phase === "SOAKING").length,
  }), [wells]);

  const selectWell = (id: string) => { setSelectedId(id); setOptimized(null); };
  const optimize = () => setOptimized(optimizeLocal(current));

  const askAdvisor = async () => {
    try {
      const response = await fetch(`${API}/api/advisor`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ well_id: selectedId, question }) });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setAnswer(result.answer);
    } catch {
      const reasons = [current.reservoir_temperature < 68 && `reservoir temperature has cooled to ${current.reservoir_temperature.toFixed(0)}°C`, current.spm > 6.3 && `pump speed is high at ${current.spm.toFixed(1)} SPM`, current.pump_fillage < 0.68 && `pump fillage is ${pct(current.pump_fillage)}`].filter(Boolean);
      setAnswer(`${selectedId} production is affected by ${reasons.join(", ") || "no dominant abnormal condition"}. Estimated viscosity is ${fmt(current.oil_viscosity)} cP and rod-floating risk is ${pct(current.rod_floating_risk)}. Test a lower SPM setting and evaluate CSS timing before changing field operations.`);
    }
  };

  const exportReport = (kind: "json" | "csv") => {
    const report = { generated_at: new Date().toISOString(), disclaimer: "Physics-informed simulated data for prototype demonstration.", well: current, recommendation: answer || "Run the AI Well Advisor for a state-derived recommendation." };
    const text = kind === "json" ? JSON.stringify(report, null, 2) : `metric,value\n${Object.entries(current).map(([key, value]) => `${key},${value}`).join("\n")}`;
    const url = URL.createObjectURL(new Blob([text], { type: kind === "json" ? "application/json" : "text/csv" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${selectedId}-thermatwin-report.${kind}`; anchor.click(); URL.revokeObjectURL(url);
  };

  const Overview = () => <>
    <div className="operations-ribbon">
      <span><i className="online" /> ASSET ONLINE</span><span>BAGHEWALA · HEAVY OIL</span><span>20 WELLS</span><span>2 s REFRESH</span><span className="ribbon-end">TWIN SYNC · {connected ? "FASTAPI LIVE" : "SIMULATION"}</span>
    </div>
    <div className="hero-row command-hero">
      <div><span className="eyebrow">CENTRAL OPERATIONS · FIELD OVERVIEW</span><h1>Baghewala field operations</h1><p>One operational picture from reservoir heat to surface production.</p></div>
      <div className="hero-controls"><button className="primary" onClick={() => setView("Digital Twin")}><Box size={16} /> Open digital twin</button><button className="secondary" onClick={() => setView("What-If Simulator")}><Sparkles size={16} /> Optimize well</button></div>
    </div>
    <div className="metric-grid six">
      <MetricCard label="Total oil production" value={fmt(totals.oil)} unit="BPD" trend="↑ 4.8% vs previous cycle" icon={Droplets} />
      <MetricCard label="Active wells" value={`${wells.length - 1}/${wells.length}`} trend="95% availability" icon={Activity} />
      <MetricCard label="Under CSS" value={String(totals.css)} trend="Injection + soaking" icon={Waves} />
      <MetricCard label="Average SOR" value={fmt(totals.sor, 2)} unit="bbl/bbl" trend="↓ 6.2% optimized" icon={Factory} />
      <MetricCard label="Pump efficiency" value={pct(totals.efficiency)} trend="Across active wells" icon={Gauge} />
      <MetricCard label="Needs attention" value={String(totals.attention)} trend={`${totals.critical} critical ${totals.critical === 1 ? "alert" : "alerts"}`} icon={AlertTriangle} warning={totals.attention > 4} />
    </div>
    <ProcessRail well={current} />
    <div className="overview-primary">
      <Panel title="Field production" kicker="24 HOUR · ACTUAL VS OPERATING TREND" action={<span className="live-chip"><i /> LIVE</span>} className="chart-panel command-chart"><div className="chart"><TrendChart data={history} dataKey="oil" /></div><div className="chart-footer"><span><i className="actual" /> ACTUAL</span><span>Target band 105–125 BPD</span><b>Last update · 2s</b></div></Panel>
      <Panel title={`${current.well_id} spatial twin`} kicker="THERMAL + LIFT CONTEXT" action={<button className="text-button" onClick={() => setView("Digital Twin")}>OPEN FULL TWIN ↗</button>} className="twin-panel command-twin"><WellTwin well={current} compact /></Panel>
      <Panel title="Active event feed" kicker="PRIORITIZED ALARMS" action={<span className="alarm-count">{Math.min(4, wells.length)} OPEN</span>} className="alarm-panel"><AlarmFeed wells={wells} onOpen={(id) => { selectWell(id); setView("Predictive Maintenance"); }} /></Panel>
    </div>
    <div className="overview-secondary">
      <Panel title="Thermal efficiency" kicker="STEAM & ENERGY" className="chart-panel"><div className="chart"><TrendChart data={history} dataKey="steam" color="#efb84c" type="bar" /></div></Panel>
      <Panel title="Risk outlook" kicker="FAILURE PROBABILITY" className="chart-panel"><div className="chart"><TrendChart data={history} dataKey="risk" color="#ef6767" type="line" /></div></Panel>
    </div>
    <WellTable wells={wells.slice(0, 8)} onSelect={(id) => { selectWell(id); setView("Wells"); }} />
  </>;

  const WellDetail = () => <>
    <PageTitle kicker="WELL WORKSPACE" title={selectedId} text="Reservoir, CSS, production and SRP condition in one engineering view." />
    <div className="well-selector">{wells.slice(0, 10).map((well) => <button key={well.well_id} className={well.well_id === selectedId ? "active" : ""} onClick={() => selectWell(well.well_id)}>{well.well_id}</button>)}</div>
    <div className="condition-banner"><div><Thermometer /><span>Current condition</span><strong>{current.status}</strong></div><RiskBadge value={current.rod_floating_risk} /></div>
    <div className="details-grid">
      <DataGroup title="Reservoir" icon={Database} values={[["Temperature", `${fmt(current.reservoir_temperature)} °C`], ["Pressure", `${fmt(current.reservoir_pressure)} bar`], ["Crude viscosity", `${fmt(current.oil_viscosity)} cP`], ["Water saturation", pct(current.water_cut)], ["Heated radius", `${fmt(current.heated_radius, 1)} m`]]} />
      <DataGroup title="CSS" icon={Waves} values={[["Steam volume", `${fmt(current.steam_volume)} bbl`], ["Injection pressure", `${fmt(current.steam_pressure)} bar`], ["Steam temperature", `${fmt(current.steam_temperature)} °C`], ["Soak duration", `${fmt(current.soak_time)} h`], ["Current phase", current.css_phase]]} />
      <DataGroup title="Production" icon={Droplets} values={[["Oil rate", `${fmt(current.oil_rate, 1)} BPD`], ["Water rate", `${fmt(current.water_rate, 1)} BPD`], ["Liquid rate", `${fmt(current.oil_rate + current.water_rate)} BPD`], ["Water cut", pct(current.water_cut)], ["24h prediction", `${fmt(current.oil_rate * 0.98, 1)} BPD`]]} />
      <DataGroup title="SRP system" icon={CircleGauge} values={[["Pump speed", `${fmt(current.spm, 1)} SPM`], ["Stroke length", `${fmt(current.stroke_length, 1)} m`], ["VFD frequency", `${fmt(current.vfd_frequency)} Hz`], ["Pump fillage", pct(current.pump_fillage)], ["Efficiency", pct(current.pump_efficiency)]]} />
    </div>
    <Panel title="Production & temperature" kicker="7 DAY CORRELATION" className="chart-panel wide"><div className="chart tall"><TrendChart data={history} dataKey="oil" /></div></Panel>
  </>;

  const TwinView = () => <>
    <PageTitle kicker="PHYSICS-RESPONSIVE SCENE" title="Digital Twin" text="A live visual model of CSS thermal propagation and sucker-rod-pump behavior." />
    <div className="twin-page-grid">
      <WellTwin well={current} />
      <div className="twin-side">
        <Panel title="Simulation control" kicker={connected ? "BACKEND STREAM" : "LOCAL PROTOTYPE STREAM"}>
          <div className="simulation-buttons"><button className="primary" onClick={() => setRunning(!running)}>{running ? <Pause size={15} /> : <Play size={15} />}{running ? "Pause" : "Start"}</button><button className="secondary" onClick={() => { setWells((items) => items.map((well) => well.well_id === selectedId ? seedWell(selectedId, Number(selectedId.slice(3))) : well)); setOptimized(null); }}><RefreshCw size={15} /> Reset</button></div>
          <div className="stream-state"><i className={running ? "active" : ""} />{running ? `Updating every 2 seconds · ${connected ? "WebSocket" : "simulated locally"}` : "Simulation paused"}</div>
        </Panel>
        <Panel title="Live state" kicker="DATA → VISUAL MAPPING"><DataRows values={[["Heat zone", `${fmt(current.heated_radius, 1)} m`], ["Reservoir", `${fmt(current.reservoir_temperature, 1)} °C`], ["Viscosity", `${fmt(current.oil_viscosity)} cP`], ["Rod speed", `${fmt(current.spm, 1)} SPM`], ["Oil flow", `${fmt(current.oil_rate, 1)} BPD`], ["Pump fillage", pct(current.pump_fillage)]]} /></Panel>
        <Panel title="Rod-floating risk" kicker="DYNAMIC RISK ENGINE"><RiskMeter value={current.rod_floating_risk} /><div className="contributors"><span>High SPM <b>{Math.min(100, Math.round(Math.max(0, current.spm - 5.5) * 38))}%</b></span><span>Viscosity <b>{Math.min(100, Math.round(current.oil_viscosity / 12))}%</b></span><span>Low fillage <b>{Math.round((1 - current.pump_fillage) * 100)}%</b></span></div></Panel>
      </div>
    </div>
  </>;

  const Optimizer = ({ kind }: { kind: "CSS" | "SRP" }) => {
    const result = optimized ?? current;
    return <>
      <PageTitle kicker="CALCULATED RECOMMENDATIONS" title={`${kind} Optimizer`} text={kind === "CSS" ? "Balance thermal uplift against steam cost and steam-oil ratio." : "Balance production, pump efficiency, energy and rod-floating risk."} />
      <div className="optimizer-grid">
        <Panel title="Operating inputs" kicker={selectedId}>
          {kind === "CSS" ? <>
            <Slider label="Steam volume" value={current.steam_volume} min={120} max={520} unit="bbl" onChange={(value) => updateCurrent({ steam_volume: value })} />
            <Slider label="Injection pressure" value={current.steam_pressure} min={45} max={110} unit="bar" onChange={(value) => updateCurrent({ steam_pressure: value })} />
            <Slider label="Steam temperature" value={current.steam_temperature} min={220} max={330} unit="°C" onChange={(value) => updateCurrent({ steam_temperature: value })} />
            <Slider label="Soak duration" value={current.soak_time} min={12} max={72} unit="h" onChange={(value) => updateCurrent({ soak_time: value })} />
          </> : <>
            <Slider label="SPM" value={current.spm} min={3.5} max={9} step={0.1} unit="spm" onChange={(value) => updateCurrent({ spm: value })} />
            <Slider label="Stroke length" value={current.stroke_length} min={1.5} max={3.4} step={0.1} unit="m" onChange={(value) => updateCurrent({ stroke_length: value })} />
            <Slider label="VFD frequency" value={current.vfd_frequency} min={30} max={60} unit="Hz" onChange={(value) => updateCurrent({ vfd_frequency: value })} />
            <Slider label="Pump fillage" value={current.pump_fillage * 100} min={35} max={95} unit="%" onChange={(value) => updateCurrent({ pump_fillage: value / 100 })} />
          </>}
          <button className="primary full" onClick={optimize}><Sparkles size={16} /> Run optimization</button>
        </Panel>
        <Panel title="Current vs optimized" kicker="GRID-SEARCH RESULT">
          <Comparison current={current} optimized={result} kind={kind} />
          {!optimized && <div className="empty-prompt"><Sparkles size={24} /><p>Run the optimizer to calculate the best feasible scenario.</p></div>}
        </Panel>
      </div>
    </>;
  };

  const WhatIf = () => <>
    <PageTitle kicker="INTERACTIVE ENGINEERING SANDBOX" title="What-If Simulator" text="Change a control, watch the physics and risks respond, then calculate the best scenario." />
    <div className="whatif-layout">
      <Panel title="Scenario controls" kicker={`${selectedId} · CURRENT CYCLE`}>
        <div className="slider-grid">
          <Slider label="Steam volume" value={current.steam_volume} min={120} max={520} unit="bbl" onChange={(value) => updateCurrent({ steam_volume: value })} />
          <Slider label="Soak time" value={current.soak_time} min={12} max={72} unit="h" onChange={(value) => updateCurrent({ soak_time: value })} />
          <Slider label="Reservoir temperature" value={current.reservoir_temperature} min={35} max={130} unit="°C" onChange={(value) => updateCurrent({ reservoir_temperature: value })} />
          <Slider label="SPM" value={current.spm} min={3.5} max={9} step={0.1} unit="spm" onChange={(value) => updateCurrent({ spm: value })} />
          <Slider label="VFD frequency" value={current.vfd_frequency} min={30} max={60} unit="Hz" onChange={(value) => updateCurrent({ vfd_frequency: value })} />
          <Slider label="Stroke length" value={current.stroke_length} min={1.5} max={3.4} step={0.1} unit="m" onChange={(value) => updateCurrent({ stroke_length: value })} />
        </div>
        <button className="optimize-cta" onClick={optimize}><Sparkles /> OPTIMIZE WELL <span>Search feasible CSS + SRP settings</span></button>
      </Panel>
      <div className="whatif-output">
        <WellTwin well={optimized ?? current} compact />
        <div className="prediction-grid">
          {[ ["Oil production", optimized ?? current, "oil_rate", "BPD"], ["Viscosity", optimized ?? current, "oil_viscosity", "cP"], ["Pump efficiency", optimized ?? current, "pump_efficiency", "%"], ["Energy", optimized ?? current, "energy_consumption", "kWh/bbl"] ].map(([label, source, key, unit]) => {
            const value = (source as Well)[key as keyof Well] as number; return <div key={String(label)}><span>{String(label)}</span><strong>{unit === "%" ? pct(value) : fmt(value, 1)} <small>{unit === "%" ? "" : String(unit)}</small></strong></div>;
          })}
        </div>
        {optimized && <div className="success-note"><Sparkles size={18} /><div><b>Calculated scenario ready</b><span>SPM {current.spm.toFixed(1)} → {optimized.spm.toFixed(1)} · risk {pct(current.rod_floating_risk)} → {pct(optimized.rod_floating_risk)}</span></div></div>}
      </div>
    </div>
  </>;

  const Maintenance = () => {
    const events = wells.filter((well) => well.failure_risk > 0.38).slice(0, 7);
    return <><PageTitle kicker="CONDITION-BASED OPERATIONS" title="Predictive Maintenance" text="Prioritized equipment risks derived from thermal, electrical and dynamometer indicators." /><Panel title="Maintenance queue" kicker={`${events.length} ACTIONABLE ITEMS`}><div className="maintenance-list">{events.map((well, index) => <div key={well.well_id} className="maintenance-row"><span className={`severity-dot ${well.failure_risk > 0.7 ? "critical" : "medium"}`} /><div><b>{well.well_id} · {index % 2 ? "Low pump fillage" : "Rod floating"}</b><small>{index % 2 ? "Viscous inflow is limiting barrel fill." : "High SPM and load span indicate incomplete rod fall."}</small></div><RiskBadge value={well.failure_risk} /><span className="recommend">{index % 2 ? "Review CSS timing" : "Reduce SPM"}</span></div>)}</div></Panel><Panel title="Maintenance timeline" kicker="NEXT 14 DAYS"><div className="timeline">{["Today", "+2 days", "+5 days", "+9 days"].map((date, index) => <div key={date}><i /><b>{date}</b><span>{["BW-07 dynamometer review", "BW-12 valve leakage inspection", "BW-03 motor current verification", "BW-18 scheduled rod-string check"][index]}</span></div>)}</div></Panel></>;
  };

  const Advisor = () => <><PageTitle kicker="STATE-AWARE EXPLANATIONS" title="AI Well Advisor" text="Ask about the selected well. Every numerical statement is taken from its current simulated state." /><div className="advisor-layout"><Panel title="Ask ThermaTwin" kicker={`${selectedId} CONTEXT LOADED`}><div className="suggestions">{["Why is production falling?", "Why is rod-floating risk high?", "Should I start another CSS cycle?", "What happens if I increase SPM?"].map((item) => <button key={item} onClick={() => setQuestion(item)}>{item}</button>)}</div><textarea value={question} onChange={(event) => setQuestion(event.target.value)} /><button className="primary" onClick={askAdvisor}><Bot size={17} /> Analyze current state</button></Panel><Panel title="Engineering response" kicker="DETERMINISTIC + STATE GROUNDED"><div className="advisor-response">{answer ? <><div className="ai-mark"><Sparkles /></div><p>{answer}</p><small>Physics-informed simulated data for prototype demonstration. Validate recommendations before field use.</small></> : <div className="empty-prompt"><Bot /><p>Ask a question to generate an evidence-linked explanation.</p></div>}</div></Panel></div></>;

  const Analytics = () => <><PageTitle kicker="MULTIVARIATE TRENDS" title="Analytics" text="Thermal, production, pump and risk signals aligned on a common timeline." /><div className="analytics-grid">{[["Oil production", "oil", "#40d8d2"], ["Reservoir temperature", "temperature", "#efb84c"], ["Oil viscosity", "viscosity", "#9f86ff"], ["Pump efficiency", "efficiency", "#49c989"], ["Failure probability", "risk", "#ef6767"], ["SPM", "spm", "#60a9ff"]].map(([title, key, color]) => <Panel key={title} title={title} kicker="24 HOUR"><div className="chart"><TrendChart data={history} dataKey={key} color={color} type="line" /></div></Panel>)}</div></>;

  const Reports = () => <><PageTitle kicker="SHIFT-READY OUTPUT" title="Reports" text="Generate a portable well summary from the current digital-twin state." /><div className="report-card"><div className="report-preview"><span>THERMATWIN AI · WELL PERFORMANCE SUMMARY</span><h2>{selectedId}</h2><p>{new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</p><div className="report-kpis"><b>{fmt(current.oil_rate, 1)}<small>BPD oil</small></b><b>{pct(current.pump_efficiency)}<small>Pump efficiency</small></b><b>{pct(current.failure_risk)}<small>Failure risk</small></b></div><hr /><p>Current phase: <b>{current.css_phase}</b>. Reservoir temperature is <b>{fmt(current.reservoir_temperature, 1)}°C</b>, with estimated viscosity of <b>{fmt(current.oil_viscosity)} cP</b>.</p><div className="disclaimer">Physics-informed simulated data for prototype demonstration.</div></div><div className="report-actions"><h3>Export report</h3><p>Includes well state, production, CSS, SRP, risk scores and the latest advisor recommendation.</p><button className="primary" onClick={() => exportReport("json")}><Download size={16} /> Download JSON</button><button className="secondary" onClick={() => exportReport("csv")}><Download size={16} /> Download CSV</button></div></div></>;

  const SettingsView = () => <><PageTitle kicker="PROTOTYPE CONFIGURATION" title="Settings" text="Runtime and engineering assumptions for this demonstration." /><div className="details-grid"><DataGroup title="Data source" icon={Database} values={[["Mode", connected ? "FastAPI WebSocket" : "Browser simulation fallback"], ["Update interval", "2 seconds"], ["Wells", "20 synthetic"], ["History", "365 days · 6-hour intervals"]]} /><DataGroup title="Engineering model" icon={Settings} values={[["Viscosity", "Exponential temperature curve"], ["Optimization", "Feasible grid search"], ["Persistence", "SQLite fallback"], ["Field calibration", "Not applied"]]} /></div></>;

  const renderView = () => {
    if (view === "Overview") return Overview();
    if (view === "Wells") return WellDetail();
    if (view === "Digital Twin") return TwinView();
    if (view === "CSS Optimizer") return Optimizer({ kind: "CSS" });
    if (view === "SRP Optimizer") return Optimizer({ kind: "SRP" });
    if (view === "Predictive Maintenance") return Maintenance();
    if (view === "What-If Simulator") return WhatIf();
    if (view === "AI Well Advisor") return Advisor();
    if (view === "Analytics") return Analytics();
    if (view === "Reports") return Reports();
    return SettingsView();
  };

  return (
    <div className="app-shell">
      <aside className={sidebarOpen ? "open" : ""}>
        <div className="brand"><div className="brand-mark"><Waves /></div><div><b>ThermaTwin</b><span>AI</span><small>WELL INTELLIGENCE</small></div><button className="mobile-close" onClick={() => setSidebarOpen(false)}><X /></button></div>
        <nav>{navigation.map(({ label, icon: Icon }) => <button key={label} className={view === label ? "active" : ""} onClick={() => { setView(label); setSidebarOpen(false); }}><Icon size={18} /><span>{label}</span>{label === "Predictive Maintenance" && <i className="nav-count">3</i>}</button>)}</nav>
        <div className="sidebar-foot"><div className="system-state"><i /><div><b>SIMULATION ONLINE</b><span>{connected ? "FastAPI stream" : "Prototype fallback"}</span></div></div><p>SIH 26120 · Prototype</p></div>
      </aside>
      <main>
        <header className="topbar"><button className="menu-button" onClick={() => setSidebarOpen(true)}><Menu /></button><div className="breadcrumb"><span>THERMATWIN AI</span><b>/</b><strong>{view.toUpperCase()}</strong></div><div className="top-actions"><span className="sync-chip"><Radio size={13} /><i /> {connected ? "LIVE LINK" : "SIM LINK"}</span><label className="search"><Search size={15} /><input placeholder="Search wells…" /></label><button className="well-picker" onClick={() => setView("Wells")}><i className={current.status.toLowerCase()} />{selectedId}<ChevronDown size={14} /></button><div className="operator"><span>OP</span><div><b>Field Operator</b><small>Simulation mode</small></div></div></div></header>
        <div className="data-disclaimer"><AlertTriangle size={14} /> Physics-informed simulated data for prototype demonstration. Not real Baghewala telemetry.</div>
        <div className="content">{renderView()}</div>
      </main>
    </div>
  );
}

function PageTitle({ kicker, title, text }: { kicker: string; title: string; text: string }) { return <div className="page-title"><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{text}</p></div>; }

function DataRows({ values }: { values: (string | number)[][] }) { return <div className="data-rows">{values.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>; }

function DataGroup({ title, icon: Icon, values }: { title: string; icon: LucideIcon; values: (string | number)[][] }) { return <Panel title={title} action={<Icon size={19} />}><DataRows values={values} /></Panel>; }

function RiskMeter({ value }: { value: number }) { return <div className="risk-meter"><div className="risk-number"><strong>{pct(value)}</strong><RiskBadge value={value} /></div><div className="risk-track"><i style={{ width: `${value * 100}%` }} /></div></div>; }

function WellTable({ wells, onSelect }: { wells: Well[]; onSelect: (id: string) => void }) { return <Panel title="Well status" kicker="LIVE OPERATING ENVELOPE" action={<button className="text-button">VIEW ALL 20 →</button>}><div className="table-wrap"><table><thead><tr><th>Well ID</th><th>State</th><th>Reservoir temp.</th><th>Pressure</th><th>Oil rate</th><th>Viscosity</th><th>SPM</th><th>Pump eff.</th><th>SOR</th><th>Failure risk</th></tr></thead><tbody>{wells.map((well) => <tr key={well.well_id} onClick={() => onSelect(well.well_id)}><td><b>{well.well_id}</b></td><td><span className={`status ${well.status.toLowerCase()}`}><i />{phaseLabel(well.css_phase)}</span></td><td>{fmt(well.reservoir_temperature, 1)}°C</td><td>{fmt(well.reservoir_pressure, 1)} bar</td><td>{fmt(well.oil_rate, 1)} BPD</td><td>{fmt(well.oil_viscosity)} cP</td><td>{fmt(well.spm, 1)}</td><td>{pct(well.pump_efficiency)}</td><td>{fmt(well.steam_oil_ratio, 2)}</td><td><RiskBadge value={well.failure_risk} /></td></tr>)}</tbody></table></div></Panel>; }

function Comparison({ current, optimized, kind }: { current: Well; optimized: Well; kind: "CSS" | "SRP" }) {
  const rows = kind === "CSS" ? [["Steam volume", current.steam_volume, optimized.steam_volume, "bbl"], ["Oil production", current.oil_rate, optimized.oil_rate, "BPD"], ["Steam-oil ratio", current.steam_oil_ratio, optimized.steam_oil_ratio, ""], ["Reservoir temp.", current.reservoir_temperature, optimized.reservoir_temperature, "°C"]] : [["Pump speed", current.spm, optimized.spm, "SPM"], ["Pump efficiency", current.pump_efficiency * 100, optimized.pump_efficiency * 100, "%"], ["Energy", current.energy_consumption, optimized.energy_consumption, "kWh/bbl"], ["Rod-floating risk", current.rod_floating_risk * 100, optimized.rod_floating_risk * 100, "%"]];
  return <div className="comparison"><div className="comparison-head"><span>Metric</span><b>Current</b><strong>AI optimized</strong></div>{rows.map(([label, before, after, unit]) => { const delta = ((Number(after) / Math.max(Number(before), 0.001)) - 1) * 100; return <div key={String(label)}><span>{String(label)}</span><b>{fmt(Number(before), 1)} {String(unit)}</b><strong>{fmt(Number(after), 1)} {String(unit)} <i className={delta >= 0 ? "up" : "down"}>{delta >= 0 ? "+" : ""}{fmt(delta, 1)}%</i></strong></div>; })}</div>;
}
