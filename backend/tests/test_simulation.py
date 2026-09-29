import unittest

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


if __name__ == "__main__":
    unittest.main()

