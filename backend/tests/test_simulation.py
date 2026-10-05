import unittest

from fastapi.testclient import TestClient

from app.main import app, recommendations
from app.simulation import WellDigitalTwin, optimize_srp


class SimulationTests(unittest.TestCase):
    def test_heating_lowers_viscosity_and_increases_rate(self):
        cool = WellDigitalTwin("T-01", reservoir_temperature=50).to_dict()
        hot = WellDigitalTwin("T-02", reservoir_temperature=90).to_dict()
        self.assertLess(hot["oil_viscosity"], cool["oil_viscosity"])
        self.assertGreater(hot["oil_rate"], cool["oil_rate"])

    def test_optimizer_returns_calculated_candidate(self):
        well = WellDigitalTwin("T-03", spm=7.3, pump_fillage=0.58)
        result = optimize_srp(well, {"spm": 7.3, "vfd_frequency": 48, "stroke_length": 2.4})
        self.assertIn("optimized", result)
        self.assertGreaterEqual(result["optimized"]["spm"], 4.2)


class RecommendationWorkflowTests(unittest.TestCase):
    def setUp(self):
        recommendations.clear()
        self.client = TestClient(app)

    def test_recommendation_requires_human_decision(self):
        created = self.client.post("/api/recommendations", json={
            "well_id": "BW-07",
            "action": "Reduce pump speed from 7.1 to 5.8 SPM",
            "rationale": "Lower modeled rod-floating risk while preserving production.",
            "current_spm": 7.1,
            "proposed_spm": 5.8,
            "risk_before": 0.72,
            "risk_after": 0.31,
            "oil_before": 42.0,
            "oil_after": 46.0,
        })
        self.assertEqual(created.status_code, 201)
        recommendation = created.json()
        self.assertEqual(recommendation["status"], "PENDING")
        self.assertEqual(recommendation["mode"], "ADVISORY")

        decided = self.client.patch(
            f"/api/recommendations/{recommendation['id']}",
            json={"status": "APPROVED", "note": "Approved for supervised trial."},
        )
        self.assertEqual(decided.status_code, 200)
        self.assertEqual(decided.json()["status"], "APPROVED")


if __name__ == "__main__":
    unittest.main()

