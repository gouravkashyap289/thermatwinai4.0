from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import classification_report, mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputRegressor
from xgboost import XGBClassifier, XGBRegressor


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "ml" / "models"
DATA = pd.read_csv(ROOT / "data" / "synthetic_well_data.csv")


def regression(name: str, features: list[str], targets: list[str]):
    x_train, x_test, y_train, y_test = train_test_split(DATA[features], DATA[targets], test_size=0.2, random_state=26120)
    base = XGBRegressor(n_estimators=180, max_depth=5, learning_rate=0.06, n_jobs=4, random_state=26120)
    model = base if len(targets) == 1 else MultiOutputRegressor(base)
    model.fit(x_train, y_train.squeeze() if len(targets) == 1 else y_train)
    predicted = model.predict(x_test)
    metrics = {"rmse": mean_squared_error(y_test, predicted) ** 0.5, "mae": mean_absolute_error(y_test, predicted), "r2": r2_score(y_test, predicted)}
    joblib.dump({"model": model, "features": features, "targets": targets}, MODEL_DIR / f"{name}.joblib")
    return metrics


def classification():
    features = ["spm", "rod_load_min", "rod_load_max", "pump_fillage", "motor_current", "oil_viscosity", "pump_efficiency"]
    x_train, x_test, y_train, y_test = train_test_split(DATA[features], DATA[["rod_floating", "pump_failure"]], test_size=0.2, random_state=26120, stratify=DATA["rod_floating"])
    models, metrics = {}, {}
    for target in y_train:
        model = XGBClassifier(n_estimators=160, max_depth=4, learning_rate=0.07, scale_pos_weight=8, n_jobs=4, random_state=26120)
        model.fit(x_train, y_train[target])
        predicted = model.predict(x_test)
        models[target] = model
        metrics[target] = classification_report(y_test[target], predicted, output_dict=True, zero_division=0)
    joblib.dump({"models": models, "features": features}, MODEL_DIR / "failure_prediction.joblib")
    return metrics


if __name__ == "__main__":
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    results = {
        "production": regression("production_prediction", ["reservoir_temperature", "reservoir_pressure", "oil_viscosity", "steam_volume", "soak_time", "spm", "pump_efficiency", "water_cut"], ["oil_rate"]),
        "pump_efficiency": regression("pump_efficiency", ["spm", "oil_viscosity", "motor_current", "rod_load_min", "rod_load_max", "pump_fillage", "reservoir_temperature"], ["pump_efficiency"]),
        "failure": classification(),
        "css_performance": regression("css_performance", ["steam_volume", "steam_pressure", "steam_temperature", "soak_time", "reservoir_temperature", "reservoir_pressure"], ["oil_rate", "steam_oil_ratio"]),
    }
    (MODEL_DIR / "metrics.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))
