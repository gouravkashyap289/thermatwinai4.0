# Architecture decision record

ThermaTwin AI is intentionally split into two independently runnable services. Next.js owns visualization and operator interaction. FastAPI owns simulation state, optimization, explanations, and live WebSocket updates. The synthetic CSV is portable training input; model artifacts are optional accelerators rather than runtime requirements.

The initial version keeps well state in memory because the demo has 20 wells and one operator. A repository boundary can be added when persisted multi-user scenarios are required. The API models and time-series-shaped CSV are already compatible with replacing that store with PostgreSQL/TimescaleDB.

The 3D twin is not a decorative animation: temperature drives heat radius and color, CSS phase drives steam/oil particles, SPM drives rod motion, oil rate drives flow density, and rod-floating risk triggers a downhole alert.

