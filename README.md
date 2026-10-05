# ThermaTwin AI

AI-enabled well-to-surface digital twin prototype for heavy-oil CSS and sucker-rod-pump optimization. All operational values are clearly identified as **physics-informed simulated data for prototype demonstration**; the project is not a field-control system and contains no Baghewala telemetry.

## Architecture

```text
Browser / Next.js  ── REST + WebSocket ── FastAPI
   │                                           │
   ├─ Recharts analytics                       ├─ WellDigitalTwin physics
   ├─ React Three Fiber twin                   ├─ CSS/SRP optimizers
   └─ What-if + advisor                        └─ synthetic data / ML scripts
```

The prototype uses deterministic physics relationships for the live experience. Optional training scripts produce four scikit-learn/XGBoost-compatible model artifacts from the synthetic dataset. Runtime state and approval records are currently kept in memory; PostgreSQL/TimescaleDB persistence is planned for field deployment.

## Quick start

1. Generate data: `python scripts/generate_data.py`
2. Backend: `cd backend`, create a virtual environment, install `requirements.txt`, then run `uvicorn app.main:app --reload`
3. Frontend: `cd frontend`, run `pnpm install`, then `pnpm dev`
4. Open `http://localhost:3000`

The UI falls back to an in-browser simulation when the API is offline. For containers, copy `.env.example` to `.env` if desired and run `docker compose up --build`.

## ML training

After generating the dataset, install `ml/requirements.txt` and run `python ml/train_models.py`. Metrics are written to `ml/models/metrics.json`; model files are written to the same folder.

## Demo flow

Open **BW-07**, inspect its cooling reservoir and rod-float risk, open **What-If Simulator**, select **Optimize Well**, and send the calculated scenario for approval. In **Action Center**, review the evidence, add an engineering note, approve or reject the recommendation, and inspect the audit trail. **AI Well Advisor** explains the same condition using the current simulated state.

## Prototype assumptions

- Viscosity follows a simplified exponential temperature relationship.
- Heating, cooling, inflow, pump fillage, energy, and failure scores are directional engineering approximations, not field-calibrated correlations.
- Optimizers search feasible grids and calculate their reported deltas; no improvement percentages are hardcoded.
- Replace the modular equations in `backend/app/simulation.py` with calibrated field models before operational use.

