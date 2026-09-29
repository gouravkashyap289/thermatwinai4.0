from typing import Literal

from pydantic import BaseModel, Field


CssPhase = Literal["INJECTION", "SOAKING", "PRODUCTION", "COOLING"]


class ScenarioInput(BaseModel):
    well_id: str = "BW-07"
    steam_volume: float = Field(280, ge=0, le=800)
    injection_pressure: float = Field(72, ge=20, le=150)
    steam_temperature: float = Field(290, ge=180, le=360)
    soak_time: float = Field(36, ge=0, le=120)
    reservoir_temperature: float | None = Field(None, ge=20, le=180)
    spm: float = Field(7.1, ge=1, le=12)
    vfd_frequency: float = Field(46, ge=20, le=70)
    stroke_length: float = Field(2.4, ge=1, le=4)


class AdvisorRequest(BaseModel):
    well_id: str = "BW-07"
    question: str = Field(min_length=3, max_length=500)


class WellState(BaseModel):
    well_id: str
    reservoir_temperature: float
    reservoir_pressure: float
    oil_viscosity: float
    oil_rate: float
    water_rate: float
    water_cut: float
    steam_volume: float
    steam_pressure: float
    steam_temperature: float
    soak_time: float
    css_phase: CssPhase
    spm: float
    stroke_length: float
    vfd_frequency: float
    motor_current: float
    rod_load_min: float
    rod_load_max: float
    pump_fillage: float
    pump_efficiency: float
    energy_consumption: float
    steam_oil_ratio: float
    failure_risk: float
    rod_floating_risk: float
    heated_radius: float
    status: str

