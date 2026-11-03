"""BioClinicalBERT-style clinical record NER service (Mode 2).

Uses rule-based clinical NER with ICD-10/DSM-5 pattern matching and
a clinical risk scoring system for psychiatric document analysis.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class ClinicalEntity:
    text: str
    category: str  # "diagnosis", "medication", "procedure", "risk_signal"
    icd_code: str | None = None
    confidence: float = 1.0


@dataclass
class ClinicalExtractionResult:
    diagnoses: list[str]
    medications: list[str]
    risk_signals: list[str]
    entities: list[ClinicalEntity]
    history_risk_score: float  # 0.0 to 1.0
    summary: str


class BioClinicalBERTAnalyzer:
    """Rule-based clinical NER modelling BioClinicalBERT entity extraction.

    Implements ICD-10 coded pattern matching for psychiatric diagnoses,
    pharmacotherapy detection, and clinical vulnerability assessment.
    """

    # ICD-10 mapped diagnosis patterns
    DIAGNOSIS_RULES: list[tuple[str, list[str], str]] = [
        ("Major Depressive Disorder", [r"\bmdd\b", r"\bdepression\b", r"\bdepressive\b", r"\bdysthymia\b", r"\bunipolar\b"], "F32"),
        ("Generalized Anxiety Disorder", [r"\bgad\b", r"\banxiety\b", r"\bpanic\b", r"\bphobia\b"], "F41.1"),
        ("Bipolar Affective Disorder", [r"\bbipolar\b", r"\bmanic\b", r"\bhypomania\b"], "F31"),
        ("Post-Traumatic Stress Disorder", [r"\bptsd\b", r"\bpost-traumatic\b", r"\btrauma\b"], "F43.1"),
        ("Chronic Insomnia", [r"\binsomnia\b", r"\bsleep apnea\b", r"\bsomnolence\b", r"\bhypersomnia\b"], "G47"),
        ("Obsessive-Compulsive Disorder", [r"\bocd\b", r"\bobsessive\b", r"\bcompulsive\b"], "F42"),
        ("Attention Deficit Hyperactivity Disorder", [r"\badhd\b", r"\battention deficit\b", r"\bhyperactivity\b"], "F90"),
        ("Substance Use Disorder", [r"\bsubstance abuse\b", r"\balcoholism\b", r"\baddiction\b", r"\bdependence\b"], "F10-F19"),
    ]

    # Pharmacotherapy detection rules
    MEDICATION_RULES: list[tuple[str, list[str], str]] = [
        ("Sertraline", [r"\bsertraline\b", r"\bzoloft\b"], "SSRI"),
        ("Escitalopram", [r"\bescitalopram\b", r"\blexapro\b"], "SSRI"),
        ("Fluoxetine", [r"\bfluoxetine\b", r"\bprozac\b"], "SSRI"),
        ("Venlafaxine", [r"\bvenlafaxine\b", r"\beffexor\b"], "SNRI"),
        ("Duloxetine", [r"\bduloxetine\b", r"\bcymbalta\b"], "SNRI"),
        ("Alprazolam", [r"\balprazolam\b", r"\bxanax\b"], "Benzodiazepine"),
        ("Diazepam", [r"\bdiazepam\b", r"\bvalium\b"], "Benzodiazepine"),
        ("Quetiapine", [r"\bquetiapine\b", r"\bseroquel\b"], "Atypical Antipsychotic"),
        ("Lithium", [r"\blithium\b"], "Mood Stabilizer"),
        ("Melatonin", [r"\bmelatonin\b"], "Sleep Aid"),
    ]

    # Clinical vulnerability markers
    RISK_RULES: list[tuple[str, list[str], float]] = [
        ("History of suicidal ideation", [r"suicidal ideation", r"self-harm history", r"parasuicid"], 0.35),
        ("Treatment resistance", [r"treatment.resistant", r"refractory", r"multiple failed"], 0.25),
        ("Acute vulnerability", [r"acute episode", r"hospitalization", r"relapse", r"decompensation"], 0.20),
        ("Prior psychiatric admission", [r"psychiatric admission", r"inpatient", r"committed"], 0.20),
        ("Comorbid substance use", [r"substance", r"alcohol", r"drug use"], 0.15),
    ]

    def analyze_record(self, raw_text: str) -> ClinicalExtractionResult:
        """Process clinical notes through BioClinicalBERT-style NER pipeline."""
        text_lower = raw_text.lower()
        entities: list[ClinicalEntity] = []
        diagnoses: list[str] = []
        medications: list[str] = []
        risk_signals: list[str] = []
        risk_score = 0.0

        # Extract diagnoses
        for name, patterns, icd in self.DIAGNOSIS_RULES:
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    diagnoses.append(f"{name} ({icd})")
                    entities.append(ClinicalEntity(name, "diagnosis", icd))
                    break

        # Extract medications
        for name, patterns, drug_class in self.MEDICATION_RULES:
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    medications.append(f"{name} ({drug_class})")
                    entities.append(ClinicalEntity(name, "medication"))
                    break

        # Extract risk signals
        for name, patterns, weight in self.RISK_RULES:
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    risk_signals.append(name)
                    risk_score += weight
                    entities.append(ClinicalEntity(name, "risk_signal", confidence=weight))
                    break

        risk_score = min(1.0, risk_score)

        summary = (
            f"BioClinicalBERT NER: {len(diagnoses)} diagnoses (ICD-10 coded), "
            f"{len(medications)} active prescriptions, "
            f"{len(risk_signals)} historical risk markers. "
            f"Clinical vulnerability score: {risk_score:.2f}."
        )

        return ClinicalExtractionResult(
            diagnoses=diagnoses,
            medications=medications,
            risk_signals=risk_signals,
            entities=entities,
            history_risk_score=round(risk_score, 4),
            summary=summary,
        )


# Singleton
bioclinical_analyzer = BioClinicalBERTAnalyzer()
