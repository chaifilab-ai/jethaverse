"""Name matching in English text (tools/characters.py). Run:  python -m unittest tests.test_cast"""
import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
from characters import detect_cast


class DetectCast(unittest.TestCase):
    def test_plain_names(self):
        self.assertEqual(detect_cast("Jethalal and Goli go to Babita's house."), ["Jethalal", "Babita", "Goli"])

    def test_spelling_variants(self):
        self.assertIn("Madhavi", detect_cast("Madhvi is upset"))
        self.assertIn("Bagha", detect_cast("Baagha and Bawri meet"))
        self.assertIn("Bawri", detect_cast("Baagha and Bawri meet"))
        self.assertIn("Champaklal", detect_cast("Chachaji arrives"))

    def test_relations_name_the_person_not_in_the_text(self):
        self.assertIn("Goli", detect_cast("Dr. Hathi's son gets into trouble"))
        self.assertIn("Madhavi", detect_cast("Bhide's wife plans a party"))
        self.assertIn("Babita", detect_cast("Iyer's wife is angry"))
        self.assertIn("Daya", detect_cast("Jethalal's wife is angry"))
        self.assertNotIn("Goli", detect_cast("Dr. Hathi's wife is angry"))
        self.assertEqual(detect_cast("Dr. Hathi's wife is angry"), ["Dr. Hathi", "Komal"])

    def test_sodhi_is_not_roshan(self):
        self.assertEqual(detect_cast("Roshan Singh Sodhi cooks"), ["Sodhi"])
        self.assertEqual(detect_cast("Roshan cooks"), ["Roshan"])

    def test_the_gang_and_the_inspector(self):
        self.assertIn("Tapu Sena", detect_cast("Tapu Sena plans a prank"))
        self.assertIn("Chalu Pandey", detect_cast("Inspector Chalu Pandey arrives"))
        self.assertNotIn("Chalu Pandey", detect_cast("Popatlal Pandey writes a story"))
        self.assertIn("Rita", detect_cast("Rita Reporter interviews him"))

    def test_nothing_found(self):
        self.assertEqual(detect_cast("Everyone prepares for the festival."), [])


if __name__ == "__main__":
    unittest.main()
