from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from math import sin
import os
from uuid import uuid4

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .models import AdvisorRequest, RecommendationCreate, RecommendationDecision, ScenarioInput
from .simulation import make_wells, optimize_css, optimize_srp


app = FastAPI(title="ThermaTwin AI API", version="0.1.0")
allowed_origins = [
    "http://localhost:3000",
    "https://thermatwinai4-0.vercel.app",
    *[origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "").split(",") if origin.strip()],
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
wells = make_wells()
recommendations: list[dict] = []


def get_well(well_id: str):
    well = wells.get(well_id.upper())
    if not well:
        raise HTTPException(404, f"Unknown well: {well_id}")
    return well


@app.get("/api/health")
def health() -> dict:
    return {"status": "healthy", "data_source": "physics-informed simulated data"}


@app.get("/api/wells")
def list_wells() -> list[dict]:
    return [well.to_dict() for well in wells.values()]


@app.get("/api/wells/{well_id}")
def well_detail(well_id: str) -> dict:
    return get_well(well_id).to_dict()


@app.get("/api/wells/{well_id}/history")
def well_history(well_id: str, hours: int = 168) -> list[dict]:
    well = get_well(well_id).to_dict()
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    points = []
    for index in range(min(max(hours // 6, 8), 120)):
        age = (hours // 6 - index) * 6
        cooling = age * 0.012
        cycle = sin(index / 4.2)
        points.append({
            "timestamp": (now - timedelta(hours=age)).isoformat(),
            "oil_rate": round(max(8, well["oil_rate"] - cooling + cycle * 4.2), 2),
            "reservoir_temperature": round(well["reservoir_temperature"] + cooling * 0.35 + cycle, 2),
            "pump_efficiency": round(max(0.25, well["pump_efficiency"] + cycle * 0.018), 3),
            "failure_risk": round(min(0.99, max(0.01, well["failure_risk"] - cycle * 0.02)), 3),
        })
    return points


@app.post("/api/simulate")
@app.post("/api/what-if")
def simulate(scenario: ScenarioInput) -> dict:
    well = get_well(scenario.well_id)
    changes = scenario.model_dump(exclude={"well_id"}, exclude_none=True)
    return well.apply(**changes)


@app.post("/api/predict/production")
def predict_production(scenario: ScenarioInput) -> dict:
    state = simulate(scenario)
    return {"well_id": scenario.well_id, "predicted_24h_bbl": round(state["oil_rate"], 1), "predicted_72h_bbl": round(state["oil_rate"] * 2.91, 1), "model": "prototype physics surrogate"}


@app.post("/api/predict/failure")
def predict_failure(scenario: ScenarioInput) -> dict:
    state = simulate(scenario)
    level = "CRITICAL" if state["rod_floating_risk"] >= 0.8 else "HIGH" if state["rod_floating_risk"] >= 0.6 else "MEDIUM" if state["rod_floating_risk"] >= 0.35 else "LOW"
    return {"rod_floating": state["rod_floating_risk"], "pump_failure": state["failure_risk"], "level": level, "contributors": {"high_spm": round(max(0, state["spm"] - 5.5) / 4, 2), "high_viscosity": round(min(1, state["oil_viscosity"] / 1400), 2), "low_fillage": round(max(0, 0.8 - state["pump_fillage"]), 2), "load_span": round((state["rod_load_max"] - state["rod_load_min"]) / 70, 2)}}


@app.post("/api/optimize/css")
def css_optimizer(scenario: ScenarioInput) -> dict:
    return optimize_css(get_well(scenario.well_id), scenario.model_dump(exclude={"well_id"}, exclude_none=True))


@app.post("/api/optimize/srp")
def srp_optimizer(scenario: ScenarioInput) -> dict:
    return optimize_srp(get_well(scenario.well_id), scenario.model_dump(exclude={"well_id"}, exclude_none=True))


@app.get("/api/alerts")
def alerts() -> list[dict]:
    now = datetime.now(UTC).isoformat()
    output = []
    for well in wells.values():
        state = well.to_dict()
        if state["rod_floating_risk"] > 0.58:
            output.append({"well_id": well.well_id, "severity": "CRITICAL" if state["rod_floating_risk"] > 0.8 else "HIGH", "timestamp": now, "event": "HIGH ROD FLOATING RISK", "reason": "SPM, viscosity, fillage and rod-load interaction", "recommended_action": "Reduce SPM and verify pump fillage."})
        if state["pump_efficiency"] < 0.48:
            output.append({"well_id": well.well_id, "severity": "MEDIUM", "timestamp": now, "event": "PUMP EFFICIENCY BELOW THRESHOLD", "reason": "High fluid viscosity or low fillage", "recommended_action": "Review CSS timing and stroke setting."})
    return output


@app.post("/api/advisor")
def advisor(request: AdvisorRequest) -> dict:
    state = get_well(request.well_id).to_dict()
    reasons = []
    actions = []
    if state["reservoir_temperature"] < 68:
        reasons.append(f"reservoir cooling ({state['reservoir_temperature']:.0f}°C) has raised estimated viscosity to {state['oil_viscosity']:.0f} cP")
        actions.append("evaluate the next CSS cycle")
    if state["spm"] > 6.3:
        reasons.append(f"pump speed is high at {state['spm']:.1f} SPM relative to current fillage")
        actions.append("test a lower SPM setting")
    if state["pump_fillage"] < 0.68:
        reasons.append(f"pump fillage is only {state['pump_fillage'] * 100:.0f}%")
        actions.append("inspect inflow and fluid pound indicators")
    if not reasons:
        reasons.append("the current simulated thermal and pump indicators are within the prototype operating envelope")
        actions.append("continue monitoring the live trend")
    answer = f"{request.well_id} is primarily affected by " + "; ".join(reasons) + ". I recommend " + ", then ".join(actions) + f". Current modeled rod-floating risk is {state['rod_floating_risk'] * 100:.0f}% and predicted oil rate is {state['oil_rate']:.1f} BPD."
    return {"answer": answer, "evidence": state, "disclaimer": "Engineering guidance from physics-informed simulated data for prototype demonstration."}


@app.get("/api/recommendations")
def list_recommendations() -> list[dict]:
    return recommendations


@app.post("/api/recommendations", status_code=201)
def create_recommendation(request: RecommendationCreate) -> dict:
    get_well(request.well_id)
    recommendation = {
        "id": str(uuid4()),
        **request.model_dump(),
        "status": "PENDING",
        "created_at": datetime.now(UTC).isoformat(),
        "decided_at": None,
        "decision_note": "",
        "mode": "ADVISORY",
    }
    recommendations.insert(0, recommendation)
    return recommendation


@app.patch("/api/recommendations/{recommendation_id}")
def decide_recommendation(recommendation_id: str, decision: RecommendationDecision) -> dict:
    recommendation = next((item for item in recommendations if item["id"] == recommendation_id), None)
    if recommendation is None:
        raise HTTPException(404, "Unknown recommendation")
    if recommendation["status"] != "PENDING":
        raise HTTPException(409, "Recommendation has already been decided")
    recommendation.update(
        status=decision.status,
        decision_note=decision.note,
        decided_at=datetime.now(UTC).isoformat(),
    )
    return recommendation


@app.websocket("/ws/live/{well_id}")
async def live(websocket: WebSocket, well_id: str) -> None:
    await websocket.accept()
    well = wells.get(well_id.upper())
    if not well:
        await websocket.close(code=1008, reason="Unknown well")
        return
    try:
        while True:
            await websocket.send_json(well.step())
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        return

