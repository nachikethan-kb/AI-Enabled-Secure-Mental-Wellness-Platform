"""
Attention-Based Fusion Engine for multimodal mental health analysis.
Combines outputs from multiple analysis modalities using attention mechanisms.
"""

from dataclasses import dataclass
from typing import Any
import numpy as np
import torch
import torch.nn as nn
from torch.nn import functional as F


@dataclass
class ModalityOutput:
    """Container for individual modality analysis outputs."""
    modality_name: str
    primary_signal: str  # Main finding
    confidence: float  # 0.0 to 1.0
    risk_score: float  # 0.0 to 1.0
    secondary_signals: list[str]  # Supporting findings
    metadata: dict[str, Any]  # Additional data


@dataclass
class FusionResult:
    """Result from attention-based fusion of modalities."""
    integrated_risk_score: float
    risk_classification: str  # "low", "medium", "high"
    attention_weights: dict[str, float]  # Weight of each modality
    dominant_modalities: list[str]
    consensus_finding: str
    conflicting_signals: list[tuple[str, str]]  # (modality1, modality2)
    fusion_confidence: float


class AttentionFusionLayer(nn.Module):
    """Attention mechanism for weighted fusion of multimodal signals."""
    
    def __init__(self, num_modalities: int = 5, embedding_dim: int = 64):
        super().__init__()
        self.num_modalities = num_modalities
        self.embedding_dim = embedding_dim
        
        # Attention query, key, value transformations
        self.query_layer = nn.Linear(embedding_dim, embedding_dim)
        self.key_layer = nn.Linear(embedding_dim, embedding_dim)
        self.value_layer = nn.Linear(embedding_dim, embedding_dim)
        self.output_layer = nn.Linear(embedding_dim, 1)
        
        self.temperature = np.sqrt(embedding_dim)
        
    def forward(self, modality_embeddings: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            modality_embeddings: (batch_size, num_modalities, embedding_dim)
        Returns:
            fused_output: (batch_size, 1)
            attention_weights: (batch_size, num_modalities)
        """
        queries = self.query_layer(modality_embeddings)
        keys = self.key_layer(modality_embeddings)
        values = self.value_layer(modality_embeddings)
        
        # Scaled dot-product attention
        scores = torch.bmm(queries, keys.transpose(1, 2)) / self.temperature
        attention_weights = F.softmax(scores, dim=-1)
        
        # Apply attention
        attended = torch.bmm(attention_weights, values)
        fused_output = self.output_layer(attended)
        
        return fused_output.squeeze(-1), attention_weights.squeeze(1)


class AttentionFusionEngine:
    """
    Orchestrates attention-based fusion of multiple modality outputs.
    """
    
    def __init__(self, device: str = "cpu"):
        self.device = torch.device(device)
        self.fusion_layer = AttentionFusionLayer().to(self.device)
        self.modality_buffer = []
        
    def add_modality_output(self, output: ModalityOutput):
        """Queue a modality output for fusion."""
        self.modality_buffer.append(output)
        
    def _encode_modality(self, output: ModalityOutput) -> np.ndarray:
        """Convert modality output to embedding vector."""
        # Create 64-dim embedding from modality features
        embedding = np.zeros(64)
        
        # Risk score component
        embedding[0:16] = output.risk_score
        
        # Confidence component
        embedding[16:32] = output.confidence
        
        # Text-based signals (encoded)
        signal_hash = sum(ord(c) for c in output.primary_signal) % 256
        embedding[32:48] = (signal_hash / 255.0)
        
        # Metadata encoding
        if output.metadata:
            for i, (key, val) in enumerate(list(output.metadata.items())[:8]):
                if isinstance(val, (int, float)):
                    embedding[48 + i] = float(val) / 100.0  # Normalize
        
        return embedding
    
    def fuse(self) -> FusionResult:
        """
        Perform attention-based fusion of all queued modalities.
        """
        if not self.modality_buffer:
            raise ValueError("No modality outputs to fuse")
        
        # Encode all modalities
        embeddings = np.array([self._encode_modality(m) for m in self.modality_buffer])
        embeddings_tensor = torch.FloatTensor(embeddings).unsqueeze(0).to(self.device)
        
        # Apply attention fusion
        with torch.no_grad():
            fused_score, attention_weights = self.fusion_layer(embeddings_tensor)
            fused_score = fused_score.squeeze().item()
            attention_weights_np = attention_weights.squeeze().cpu().numpy()
        
        # Normalize fused score to 0-1 range
        integrated_risk_score = float(torch.sigmoid(torch.tensor(fused_score)).item())
        
        # Classify risk level
        if integrated_risk_score >= 0.75:
            risk_classification = "high"
        elif integrated_risk_score >= 0.5:
            risk_classification = "medium"
        else:
            risk_classification = "low"
        
        # Build attention weights mapping
        attention_map = {
            self.modality_buffer[i].modality_name: float(attention_weights_np[i])
            for i in range(len(self.modality_buffer))
        }
        
        # Identify dominant modalities
        sorted_weights = sorted(attention_map.items(), key=lambda x: x[1], reverse=True)
        dominant_modalities = [m[0] for m in sorted_weights[:2]]
        
        # Detect conflicts
        conflicting_signals = self._detect_conflicts()
        
        # Generate consensus finding
        consensus = self._generate_consensus()
        
        # Calculate fusion confidence
        fusion_confidence = float(np.mean(attention_weights_np))
        
        result = FusionResult(
            integrated_risk_score=round(integrated_risk_score, 4),
            risk_classification=risk_classification,
            attention_weights=attention_map,
            dominant_modalities=dominant_modalities,
            consensus_finding=consensus,
            conflicting_signals=conflicting_signals,
            fusion_confidence=round(fusion_confidence, 4),
        )
        
        # Clear buffer for next fusion
        self.modality_buffer = []
        
        return result
    
    def _detect_conflicts(self) -> list[tuple[str, str]]:
        """Detect conflicting signals between modalities."""
        conflicts = []
        
        for i, m1 in enumerate(self.modality_buffer):
            for m2 in self.modality_buffer[i+1:]:
                # Check for risk score misalignment
                if abs(m1.risk_score - m2.risk_score) > 0.5:
                    conflicts.append((m1.modality_name, m2.modality_name))
        
        return conflicts
    
    def _generate_consensus(self) -> str:
        """Generate consensus finding from all modalities."""
        if not self.modality_buffer:
            return "Insufficient data for consensus"
        
        # Average risk score
        avg_risk = np.mean([m.risk_score for m in self.modality_buffer])
        
        # Collect primary signals
        signals = [m.primary_signal for m in self.modality_buffer]
        
        if avg_risk >= 0.75:
            consensus = f"HIGH RISK INDICATORS detected across modalities: {', '.join(signals[:2])}"
        elif avg_risk >= 0.5:
            consensus = f"MODERATE RISK: {', '.join(signals[:2])} detected"
        else:
            consensus = f"LOW RISK: General wellbeing indicated by {', '.join(signals[:2])}"
        
        return consensus
