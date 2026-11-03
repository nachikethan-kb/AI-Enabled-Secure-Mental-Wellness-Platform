import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  BarChart3,
  Brain,
  Heart,
  Zap,
  Shield,
  Eye,
  MessageSquare,
} from "lucide-react";
import { api } from "../lib/api";

export default function ComprehensiveAssessmentPage() {
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await api.getMultimodalDashboard();
        setAssessment(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const getRiskColor = (risk) => {
    if (typeof risk === "string") {
      const lower = risk.toLowerCase();
      if (lower === "high") return "text-red-600 bg-red-50";
      if (lower === "medium") return "text-yellow-600 bg-yellow-50";
      return "text-green-600 bg-green-50";
    }
    if (risk >= 0.75) return "text-red-600 bg-red-50";
    if (risk >= 0.5) return "text-yellow-600 bg-yellow-50";
    return "text-green-600 bg-green-50";
  };

  const getRiskBgColor = (risk) => {
    if (typeof risk === "string") {
      const lower = risk.toLowerCase();
      if (lower === "high") return "bg-red-100";
      if (lower === "medium") return "bg-yellow-100";
      return "bg-green-100";
    }
    if (risk >= 0.75) return "bg-red-100";
    if (risk >= 0.5) return "bg-yellow-100";
    return "bg-green-100";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 flex items-center justify-center">
        <div className="card-glass text-white text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-lg">Loading your comprehensive assessment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="card-glass border-l-4 border-red-500">
          <p className="text-red-600 font-semibold">Error: {error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Comprehensive Mental Health Assessment
          </h1>
          <p className="text-slate-300">Multimodal analysis with AI-powered insights</p>
        </div>

        {/* Critical Alerts */}
        {assessment?.alert_flags && assessment.alert_flags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 space-y-2"
          >
            {assessment.alert_flags.map((flag, idx) => (
              <div
                key={idx}
                className={`${
                  flag.includes("CRITICAL") || flag.includes("Safety")
                    ? "bg-red-500/20 border-l-4 border-red-500"
                    : "bg-yellow-500/20 border-l-4 border-yellow-500"
                } p-4 rounded-lg text-white flex items-start gap-3`}
              >
                {flag.includes("CRITICAL") || flag.includes("Safety") ? (
                  <AlertTriangle className="h-5 w-5 mt-0.5 text-red-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 mt-0.5 text-yellow-400" />
                )}
                <div>
                  <p className="font-semibold">{flag}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Risk Score */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-glass"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400">Overall Risk Score</p>
              <TrendingUp className="h-5 w-5 text-purple-400" />
            </div>
            <p className={`text-3xl font-bold ${getRiskColor(assessment?.unified_wellness_index)}`}>
              {typeof assessment?.unified_wellness_index === 'number'
                ? (100 - assessment.unified_wellness_index).toFixed(0)
                : 'N/A'}
              %
            </p>
            <p className={`text-sm mt-2 ${getRiskColor(assessment?.risk_classification)}`}>
              {assessment?.risk_classification || 'Not classified'}
            </p>
          </motion.div>

          {/* Active Modes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-glass"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400">Analysis Modes</p>
              <BarChart3 className="h-5 w-5 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {assessment?.modes_active?.length || 0}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              {assessment?.modes_active?.join(", ").substring(0, 30)}...
            </p>
          </motion.div>

          {/* PHQ-9 Score */}
          {assessment?.phq9_summary && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card-glass"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400">PHQ-9 Score</p>
                <Brain className="h-5 w-5 text-green-400" />
              </div>
              <p className="text-3xl font-bold text-white">
                {assessment.phq9_summary.score}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {assessment.phq9_summary.risk_level}
              </p>
            </motion.div>
          )}

          {/* Safety Status */}
          {assessment?.safety_status && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card-glass"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400">Safety Level</p>
                <Shield className="h-5 w-5 text-orange-400" />
              </div>
              <p className="text-3xl font-bold text-white">✓</p>
              <p className="text-xs text-slate-400 mt-2">Status: Monitored</p>
            </motion.div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: "overview", label: "Overview", icon: Eye },
            { id: "fusion", label: "Fusion Analysis", icon: Zap },
            { id: "safety", label: "Safety", icon: Shield },
            { id: "bias", label: "Bias Detection", icon: Brain },
            { id: "explanations", label: "Explanations", icon: MessageSquare },
          ].map((tab_item) => (
            <button
              key={tab_item.id}
              onClick={() => setTab(tab_item.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition ${
                tab === tab_item.id
                  ? "bg-purple-500 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              <tab_item.icon className="h-4 w-4" />
              {tab_item.label}
            </button>
          ))}
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {tab === "overview" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Recommendations */}
              {assessment?.recommendations && assessment.recommendations.length > 0 && (
                <div className="card-glass">
                  <h2 className="text-xl font-bold text-white mb-4">Recommendations</h2>
                  <ul className="space-y-2">
                    {assessment.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-slate-300">
                        <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Active Modes Details */}
              {assessment?.phq9_summary && (
                <div className="card-glass">
                  <h3 className="text-lg font-bold text-white mb-3">PHQ-9 Analysis</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-400 text-sm">Dominant Emotion</p>
                      <p className="text-white font-semibold">
                        {assessment.phq9_summary.dominant_emotion}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Mental State</p>
                      <p className="text-white font-semibold">
                        {assessment.phq9_summary.mental_state_label}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Fusion Analysis Tab */}
          {tab === "fusion" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-glass">
              <h2 className="text-xl font-bold text-white mb-4">Attention-Based Fusion</h2>
              <div className="space-y-4">
                <p className="text-slate-300">
                  The fusion engine combines multiple analysis modalities using attention
                  mechanisms to generate integrated risk assessments.
                </p>
                {assessment?.explainability_layer && (
                  <div className="space-y-3">
                    <p className="text-white font-semibold">Modality Weights:</p>
                    {assessment.explainability_layer.map((item, idx) => (
                      <div key={idx} className="bg-slate-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-white font-medium">{item.modality}</p>
                          <p className="text-purple-400 font-bold">{(item.weight * 100).toFixed(0)}%</p>
                        </div>
                        <p className="text-slate-400 text-sm">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Safety Tab */}
          {tab === "safety" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-glass">
              <h2 className="text-xl font-bold text-white mb-4">Safety Assessment</h2>
              <div className="space-y-4">
                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-2">Assessment Status</p>
                  <p className="text-white font-semibold">Comprehensive Safety Monitoring Active</p>
                  <p className="text-slate-400 text-xs mt-2">
                    All modalities are being monitored for safety-related indicators
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Bias Detection Tab */}
          {tab === "bias" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-glass">
              <h2 className="text-xl font-bold text-white mb-4">Bias Detection & Mitigation</h2>
              <div className="space-y-4">
                <div className="bg-green-500/20 border-l-4 border-green-500 p-4 rounded-lg">
                  <p className="text-green-400 font-semibold">✓ Bias Detection Active</p>
                  <p className="text-slate-300 text-sm mt-1">
                    The system is monitoring for demographic and representation biases
                    and adjusting confidence levels accordingly.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Explanations Tab */}
          {tab === "explanations" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-glass">
              <h2 className="text-xl font-bold text-white mb-4">Model Explanations (SHAP/LIME)</h2>
              <div className="space-y-4">
                <p className="text-slate-300">
                  Detailed feature importance and contribution analysis for transparency
                  and model interpretability.
                </p>
                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-white font-semibold mb-2">Explainability Available For:</p>
                  <ul className="text-slate-400 text-sm space-y-1">
                    <li>• PHQ-9 Text Analysis</li>
                    <li>• Sensor/Wearable Analysis</li>
                    <li>• Emotion Detection</li>
                    <li>• Risk Classification</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex gap-4"
        >
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
          >
            ← Back to Dashboard
          </button>
          <button
            onClick={() => navigate("/assessment")}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
          >
            Start New Assessment
          </button>
        </motion.div>
      </div>
    </main>
  );
}
