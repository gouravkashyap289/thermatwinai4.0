from __future__ import annotations

import csv
import math
import random
from datetime import datetime, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "synthetic_well_data.csv"
FIELDS = [
    "timestamp", "well_id", "reservoir_temperature", "reservoir_pressure", "wellhead_temperature",
    "oil_viscosity", "oil_rate", "water_rate", "water_cut", "steam_volume", "steam_pressure",
    "steam_temperature", "injection_duration", "soak_time", "css_phase", "spm", "stroke_length",
    "vfd_frequency", "motor_current", "rod_load_min", "rod_load_max", "pump_fillage",
    "pump_efficiency", "energy_consumption", "steam_oil_ratio", "rod_floating", "pump_failure", "rod_failure",
]


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def generate() -> int:
    random.seed(26120)
    start = datetime(2025, 1, 1)
    rows = 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for well_number in range(1, 21):
            well_id = f"BW-{well_number:02d}"
            base_pressure = random.uniform(72, 98)
            water_cut = random.uniform(0.16, 0.45)
            for step in range(365 * 4):
                timestamp = start + timedelta(hours=step * 6)
                cycle_step = step % 120
                phase = "INJECTION" if cycle_step < 8 else "SOAKING" if cycle_step < 16 else "PRODUCTION" if cycle_step < 88 else "COOLING"
                if phase == "INJECTION":
                    temp = 58 + cycle_step * 8.4
                    steam_volume = random.uniform(250, 430)
                elif phase == "SOAKING":
                    temp = 126 - (cycle_step - 8) * 1.6
                    steam_volume = 0
                else:
                    temp = 114 * math.exp(-(cycle_step - 16) * 0.0105) + 25
                    steam_volume = 0
                temp += random.gauss(0, 2.2) + (well_number % 5 - 2) * 1.3
                viscosity = 1650 * math.exp(-0.035 * (temp - 32)) * random.uniform(0.94, 1.07)
                spm = clamp(random.gauss(5.9, 0.7), 3.8, 8.6)
                fillage = clamp(0.86 - viscosity / 4200 - max(0, spm - 6.2) * 0.045 + random.gauss(0, 0.035), 0.35, 0.95)
                pump_eff = clamp(0.92 - viscosity / 2700 - abs(spm - 5.7) * 0.035 + (fillage - 0.7) * 0.2, 0.25, 0.92)
                pressure = base_pressure - step * 0.003 + (12 if phase in ("INJECTION", "SOAKING") else 0) + random.gauss(0, 1.2)
                oil_rate = max(7, 120 * clamp(900 / max(viscosity, 120), 0.42, 1.8) * pump_eff * clamp(pressure / 84, 0.6, 1.25) * (1 - 0.4 * water_cut) + random.gauss(0, 4))
                water_rate = oil_rate * water_cut / max(0.05, 1 - water_cut)
                motor = 21 + spm * 1.65 + viscosity / 115 + (1 - fillage) * 9 + random.gauss(0, 1.2)
                load_min = random.uniform(15, 23)
                load_max = load_min + random.uniform(34, 52) + max(0, spm - 6.4) * 5
                rod_float_prob = clamp(0.04 + max(0, spm - 5.5) * 0.1 + max(0, 0.72 - fillage) * 0.9 + viscosity / 3300, 0.01, 0.97)
                pump_fail_prob = clamp(0.02 + rod_float_prob * 0.35 + max(0, motor - 43) * 0.018, 0.01, 0.8)
                abnormal = random.random() < 0.012
                if abnormal:
                    fillage *= random.uniform(0.5, 0.78)
                    motor *= random.uniform(1.12, 1.35)
                    rod_float_prob = clamp(rod_float_prob + 0.28, 0, 0.99)
                energy = motor * random.uniform(40, 50) * 0.0105 / max(oil_rate / 24, 0.5)
                row = {
                    "timestamp": timestamp.isoformat(), "well_id": well_id,
                    "reservoir_temperature": temp, "reservoir_pressure": pressure,
                    "wellhead_temperature": 28 + temp * 0.34 + random.gauss(0, 1.3), "oil_viscosity": viscosity,
                    "oil_rate": oil_rate, "water_rate": water_rate, "water_cut": water_cut,
                    "steam_volume": steam_volume, "steam_pressure": random.uniform(62, 88),
                    "steam_temperature": random.uniform(270, 315), "injection_duration": 48 if phase == "INJECTION" else 0,
                    "soak_time": 36, "css_phase": phase, "spm": spm, "stroke_length": random.uniform(2.1, 2.8),
                    "vfd_frequency": random.uniform(38, 52), "motor_current": motor, "rod_load_min": load_min,
                    "rod_load_max": load_max, "pump_fillage": fillage, "pump_efficiency": pump_eff,
                    "energy_consumption": energy, "steam_oil_ratio": steam_volume / max(oil_rate * 5.2, 1),
                    "rod_floating": int(random.random() < rod_float_prob * 0.12),
                    "pump_failure": int(random.random() < pump_fail_prob * 0.045),
                    "rod_failure": int(random.random() < (0.001 + max(0, load_max - 65) * 0.0008)),
                }
                writer.writerow({key: round(value, 4) if isinstance(value, float) else value for key, value in row.items()})
                rows += 1
    return rows


if __name__ == "__main__":
    count = generate()
    print(f"Wrote {count:,} rows to {OUTPUT}")

