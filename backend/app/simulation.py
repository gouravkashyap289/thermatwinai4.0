from __future__ import annotations

from dataclasses import asdict, dataclass
from math import exp
from random import Random


PHASES = ("INJECTION", "SOAKING", "PRODUCTION", "COOLING")


@dataclass
class WellDigitalTwin:
    well_id: str
    reservoir_temperature: float = 62.0
    reservoir_pressure: float = 78.0
    oil_viscosity: float = 0.0
    oil_rate: float = 0.0
    water_rate: float = 38.0
    water_cut: float = 0.28
    steam_volume: float = 280.0
    steam_pressure: float = 72.0
    steam_temperature: float = 290.0
    soak_time: float = 36.0
    css_phase: str = "COOLING"
    spm: float = 7.1
    stroke_length: float = 2.4
    vfd_frequency: float = 46.0
    motor_current: float = 39.0
    rod_load_min: float = 18.0
    rod_load_max: float = 61.0
    pump_fillage: float = 0.61
    pump_efficiency: float = 0.0
    energy_consumption: float = 0.0
    steam_oil_ratio: float = 0.0
    failure_risk: float = 0.0
    rod_floating_risk: float = 0.0
    heated_radius: float = 0.0
    status: str = "ATTENTION"
    tick_count: int = 0

    def __post_init__(self) -> None:
        self.recalculate()

    @staticmethod
    def viscosity_at(temperature: float) -> float:
        # Prototype correlation only; replace with field-calibrated PVT data.
        return 1650.0 * exp(-0.035 * (temperature - 32.0))

    def recalculate(self) -> None:
        self.oil_viscosity = self.viscosity_at(self.reservoir_temperature)
        viscosity_penalty = min(0.42, self.oil_viscosity / 2600.0)
        speed_penalty = max(0.0, abs(self.spm - 5.8) * 0.035)
        self.pump_efficiency = max(0.28, min(0.91, 0.91 - viscosity_penalty - speed_penalty + (self.pump_fillage - 0.65) * 0.24))
        pressure_factor = max(0.55, min(1.25, self.reservoir_pressure / 82.0))
        thermal_factor = max(0.42, min(1.8, 900.0 / max(self.oil_viscosity, 120.0)))
        self.oil_rate = max(8.0, 118.0 * pressure_factor * thermal_factor * self.pump_efficiency * (1.0 - 0.45 * self.water_cut))
        self.water_rate = self.oil_rate * self.water_cut / max(0.05, 1.0 - self.water_cut)
        self.motor_current = 21.0 + self.spm * 1.65 + self.oil_viscosity / 115.0 + (1.0 - self.pump_fillage) * 9.0
        self.energy_consumption = self.motor_current * self.vfd_frequency * 0.0105 / max(self.oil_rate / 24.0, 0.5)
        self.steam_oil_ratio = self.steam_volume / max(self.oil_rate * 5.2, 1.0)
        load_span = self.rod_load_max - self.rod_load_min
        self.rod_floating_risk = min(0.99, max(0.02, 0.05 + max(0, self.spm - 5.5) * 0.105 + max(0, 0.72 - self.pump_fillage) * 0.9 + self.oil_viscosity / 3100 + max(0, load_span - 40) * 0.012))
        self.failure_risk = min(0.98, 0.06 + self.rod_floating_risk * 0.58 + max(0, self.motor_current - 42) * 0.018 + max(0, 0.55 - self.pump_efficiency) * 0.55)
        self.heated_radius = max(4.0, min(28.0, 4.0 + (self.reservoir_temperature - 32.0) * 0.28 + self.steam_volume * 0.012))
        self.status = "CRITICAL" if self.failure_risk >= 0.72 else "ATTENTION" if self.failure_risk >= 0.42 else "NORMAL"

    def step(self) -> dict:
        rng = Random(f"{self.well_id}:{self.tick_count}")
        self.tick_count += 1
        if self.css_phase == "INJECTION":
            self.reservoir_temperature += 0.34 + self.steam_volume / 3600
            if self.tick_count % 20 == 0:
                self.css_phase = "SOAKING"
        elif self.css_phase == "SOAKING":
            self.reservoir_temperature += 0.04
            if self.tick_count % 16 == 0:
                self.css_phase = "PRODUCTION"
        else:
            self.reservoir_temperature += (32.0 - self.reservoir_temperature) * 0.003
            if self.css_phase == "PRODUCTION" and self.tick_count % 28 == 0:
                self.css_phase = "COOLING"
        self.reservoir_pressure += rng.uniform(-0.22, 0.18)
        self.pump_fillage = min(0.93, max(0.42, self.pump_fillage + rng.uniform(-0.015, 0.014)))
        self.recalculate()
        return self.to_dict()

    def apply(self, **changes: float) -> dict:
        for key, value in changes.items():
            if value is not None and hasattr(self, key):
                setattr(self, key, float(value))
        self.recalculate()
        return self.to_dict()

    def to_dict(self) -> dict:
        data = asdict(self)
        data.pop("tick_count")
        return {key: round(value, 3) if isinstance(value, float) else value for key, value in data.items()}


def make_wells() -> dict[str, WellDigitalTwin]:
    wells = {}
    for number in range(1, 21):
        rng = Random(number)
        well_id = f"BW-{number:02d}"
        well = WellDigitalTwin(
            well_id=well_id,
            reservoir_temperature=62.0 if number == 7 else rng.uniform(52, 94),
            reservoir_pressure=rng.uniform(70, 96),
            steam_volume=rng.uniform(210, 390),
            css_phase=PHASES[number % len(PHASES)],
            spm=7.1 if number == 7 else rng.uniform(4.6, 7.4),
            pump_fillage=0.61 if number == 7 else rng.uniform(0.58, 0.9),
            water_cut=rng.uniform(0.18, 0.46),
            vfd_frequency=rng.uniform(38, 52),
            rod_load_min=rng.uniform(15, 22),
            rod_load_max=rng.uniform(52, 68),
        )
        wells[well_id] = well
    return wells


def optimize_css(well: WellDigitalTwin, scenario: dict) -> dict:
    current = well.apply(**{k: v for k, v in scenario.items() if k in {"steam_volume", "steam_pressure", "steam_temperature", "soak_time"}})
    best = None
    for steam in range(180, 421, 30):
        for soak in range(18, 61, 6):
            temperature = well.reservoir_temperature + steam * 0.055 * min(1.15, well.steam_temperature / 290)
            viscosity = well.viscosity_at(temperature)
            oil = max(10.0, current["oil_rate"] * (1 + (current["oil_viscosity"] - viscosity) / max(current["oil_viscosity"], 1) * 0.55) * (1 - abs(soak - 36) / 180))
            sor = steam / max(oil * 5.2, 1)
            cost = steam * 4.2
            score = oil - sor * 12 - cost * 0.006
            candidate = {"steam_volume": steam, "soak_time": soak, "predicted_oil_rate": oil, "predicted_sor": sor, "estimated_steam_cost": cost, "score": score}
            if best is None or candidate["score"] > best["score"]:
                best = candidate
    assert best is not None
    return {"current": current, "optimized": {**best, "injection_pressure": round(max(55, min(90, well.steam_pressure - (best["steam_volume"] - 280) * 0.025)), 1), "production_cutoff": "oil rate < 55 BPD or water cut > 52%"}, "improvement": {"oil_production_pct": round((best["predicted_oil_rate"] / current["oil_rate"] - 1) * 100, 1), "steam_consumption_pct": round((best["steam_volume"] / current["steam_volume"] - 1) * 100, 1), "sor_pct": round((best["predicted_sor"] / current["steam_oil_ratio"] - 1) * 100, 1)}}


def optimize_srp(well: WellDigitalTwin, scenario: dict) -> dict:
    current = well.apply(**{k: v for k, v in scenario.items() if k in {"spm", "vfd_frequency", "stroke_length", "reservoir_temperature"}})
    best = None
    for spm_tenths in range(42, 76, 3):
        spm = spm_tenths / 10
        for frequency in range(36, 53, 2):
            clone = WellDigitalTwin(**{k: v for k, v in current.items() if k in WellDigitalTwin.__dataclass_fields__})
            state = clone.apply(spm=spm, vfd_frequency=frequency)
            score = state["oil_rate"] + state["pump_efficiency"] * 45 - state["energy_consumption"] * 1.8 - state["rod_floating_risk"] * 55
            candidate = {"spm": spm, "vfd_frequency": frequency, "stroke_length": scenario.get("stroke_length", well.stroke_length), "score": score, **{k: state[k] for k in ("oil_rate", "pump_efficiency", "energy_consumption", "rod_floating_risk", "failure_risk")}}
            if best is None or candidate["score"] > best["score"]:
                best = candidate
    assert best is not None
    return {"current": current, "optimized": best, "improvement": {"pump_efficiency_pct": round((best["pump_efficiency"] / current["pump_efficiency"] - 1) * 100, 1), "energy_pct": round((best["energy_consumption"] / current["energy_consumption"] - 1) * 100, 1), "rod_floating_risk_pct": round((best["rod_floating_risk"] / current["rod_floating_risk"] - 1) * 100, 1)}}
