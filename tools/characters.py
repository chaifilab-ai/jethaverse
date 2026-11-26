"""Characters and families for Gokuldham Guide: one list shared by tools/build_data.py and pipeline/cast/*.
Aliases drive name search (English, Hindi, nicknames) and the caption/text name matching."""

FAMILIES = [  # house, members
    ("Gada", ["Jethalal", "Daya", "Tapu", "Champaklal", "Sundar"]),
    ("Mehta", ["Taarak", "Anjali"]),
    ("Iyer", ["Iyer", "Babita"]),
    ("Bhide", ["Bhide", "Madhavi", "Sonu"]),
    ("Sodhi", ["Sodhi", "Roshan", "Gogi"]),
    ("Hathi", ["Dr. Hathi", "Komal", "Goli"]),
    ("Others", ["Popatlal", "Pinku", "Abdul", "Bagha", "Bawri", "Nattu Kaka", "Chalu Pandey", "Rita", "Tapu Sena"]),
]

CHARACTERS = {  # name: (full name / role, search aliases incl. Hindi)
    "Jethalal": ("Jethalal Champaklal Gada, electronics shop owner", ["jetha", "jethalal", "jethiya", "jethalal gada", "जेठालाल", "जेठा"]),
    "Daya": ("Dayaben Gada, Jethalal's wife", ["daya", "dayaben", "daya bhabhi", "दया", "दयाबेन"]),
    "Tapu": ("Tipendra (Tapu) Gada, Jethalal's son", ["tapu", "tappu", "tipendra", "टप्पू"]),
    "Champaklal": ("Champaklal (Bapuji) Gada, Jethalal's father", ["champaklal", "chachaji", "champak chacha", "champak", "bapuji", "bapu ji", "चंपकलाल", "बापूजी"]),
    "Sundar": ("Sundarlal, Daya's brother", ["sundar", "sunder", "sundarlal", "सुंदर"]),
    "Taarak": ("Taarak Mehta, writer and narrator", ["taarak", "tarak", "mehta", "mehta saheb", "तारक"]),
    "Anjali": ("Anjali Mehta, Taarak's wife", ["anjali", "अंजलि"]),
    "Iyer": ("Krishnan Subramaniam Iyer, scientist", ["iyer", "aiyar", "krishnan", "अय्यर"]),
    "Babita": ("Babita Iyer, Iyer's wife", ["babita", "babitaji", "babita ji", "बबीता"]),
    "Bhide": ("Atmaram Bhide, society secretary and tutor", ["bhide", "atmaram", "bhide master", "secretary", "भिड़े", "भिडे"]),
    "Madhavi": ("Madhavi Bhide, Bhide's wife", ["madhavi", "madhvi", "माधवी"]),
    "Sonu": ("Sonalika (Sonu) Bhide, Bhide's daughter", ["sonu", "sonalika", "सोनू"]),
    "Sodhi": ("Roshan Singh Sodhi, garage owner", ["sodhi", "roshan singh", "सोढ़ी", "सोढी"]),
    "Roshan": ("Roshan Kaur Sodhi, Sodhi's wife", ["roshan", "mrs sodhi", "रोशन"]),
    "Gogi": ("Gurucharan (Gogi) Sodhi, Sodhi's son", ["gogi", "गोगी"]),
    "Dr. Hathi": ("Dr. Hansraj Hathi, doctor", ["hathi", "haathi", "dr hathi", "doctor hathi", "hansraj", "हाथी"]),
    "Komal": ("Komal Hathi, Dr. Hathi's wife", ["komal", "कोमल"]),
    "Goli": ("Gulabkumar (Goli) Hathi, Dr. Hathi's son", ["goli", "gulab", "गोली"]),
    "Popatlal": ("Popatlal Pandey, journalist", ["popatlal", "popat", "patrakar", "पोपटलाल"]),
    "Pinku": ("Pinku, Tapu Sena member", ["pinku", "पिंकू"]),
    "Abdul": ("Abdul, society shopkeeper", ["abdul", "अब्दुल"]),
    "Bagha": ("Bagha, Gada Electronics staff", ["bagha", "baagha", "baga", "bagha bhai", "बाघा", "बागा"]),
    "Nattu Kaka": ("Nattu Kaka, Gada Electronics staff", ["natwar", "nattu", "natu", "nattu kaka", "नट्टू"]),
    "Chalu Pandey": ("Inspector Chalu Pandey, police inspector", ["chalu", "chalu pandey", "chalu panday", "inspector chalu", "चालू", "चालू पांडे", "चालू पांडेय"]),
    "Bawri": ("Bawri, Bagha's girlfriend", ["bawri", "bavri", "बावरी"]),
    "Rita": ("Rita Reporter, TV reporter", ["rita", "rita reporter", "रीटा", "रिटा"]),
    "Tapu Sena": ("Tapu Sena, the kids' gang", ["tapu sena", "tapusena", "tapu army", "टप्पू सेना", "टप्पूसेना"]),
}



# ---------------------------------------------------------------------------------------------
# Finding characters in English text (SonyLIV titles and synopses)
# ---------------------------------------------------------------------------------------------
import re

# aliases too generic to find a character in free text
SKIP_ALIAS = {"secretary", "mehta", "gulab", "krishnan", "mrs sodhi", "sundar", "roshan singh"}
# "X's <relation>" names a character who is in the story even when the synopsis never says their name
RELATIONS = [  # (owner, relation words, character it points to)
    (["Jethalal", "Tapu", "Champaklal"], "wife|bhabhi|mother|mom|mummy", "Daya"),
    (["Jethalal", "Daya", "Champaklal"], "son", "Tapu"),
    (["Tapu", "Daya"], "father|dad|papa|husband", "Jethalal"),
    (["Champaklal"], "son", "Jethalal"),
    (["Jethalal", "Tapu", "Daya"], "father|dad|papa|bapuji|grandfather|dada|father-in-law", "Champaklal"),
    (["Bhide", "Sonu"], "wife|mother|mom|mummy", "Madhavi"),
    (["Madhavi", "Sonu"], "husband|father|dad|papa", "Bhide"),
    (["Bhide", "Madhavi"], "daughter", "Sonu"),
    (["Iyer"], "wife", "Babita"),
    (["Babita"], "husband", "Iyer"),
    (["Sodhi"], "wife", "Roshan"),
    (["Roshan", "Gogi"], "husband|father|dad|papa", "Sodhi"),
    (["Sodhi", "Roshan"], "son", "Gogi"),
    (["Dr. Hathi"], "wife", "Komal"),
    (["Dr. Hathi", "Komal"], "son", "Goli"),
    (["Komal", "Goli"], "husband|father|dad|papa", "Dr. Hathi"),
    (["Taarak"], "wife", "Anjali"),
    (["Anjali"], "husband", "Taarak"),
    (["Daya"], "brother", "Sundar"),
]


def _alts(words):
    return "|".join(re.escape(w) for w in sorted(set(words), key=len, reverse=True))


def _alias_rx(name):
    ws = [a for a in [name] + list(CHARACTERS[name][1]) if a.isascii() and a.lower() not in SKIP_ALIAS]
    ws = [w.rstrip(".") for w in ws]
    return _alts(ws) if ws else None


ALIAS_RX = {n: re.compile(r"(?<![A-Za-z])(?:" + _alias_rx(n) + r")(?![A-Za-z])", re.I) for n in CHARACTERS if _alias_rx(n)}
if "Sodhi" in ALIAS_RX:  # Sodhi's full name must still find Sodhi
    ALIAS_RX["Sodhi"] = re.compile(r"(?<![A-Za-z])(?:sodhi|roshan singh)(?![A-Za-z])", re.I)
RELATION_RX = [
    (re.compile(r"(?<![A-Za-z])(?:" + _alts(a for o in owners for a in [x.rstrip('.') for x in [o] + list(CHARACTERS[o][1]) if x.isascii()] ) + r")(?:['\u2019]s)?\s+(?:" + rel + r")(?![A-Za-z])", re.I), target)
    for owners, rel, target in RELATIONS
]


def detect_cast(text, relations=True):
    """Characters named in an English title + synopsis, in CHARACTERS order."""
    t = re.sub(r"roshan singh", " ", text, flags=re.I)  # Sodhi's full name must not light up his wife, Roshan
    found = {n for n, rx in ALIAS_RX.items() if rx.search(text if n == "Sodhi" else t)}
    if relations:
        found |= {target for rx, target in RELATION_RX if rx.search(text)}
    return [n for n in CHARACTERS if n in found]
