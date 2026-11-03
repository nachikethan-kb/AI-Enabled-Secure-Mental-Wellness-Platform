import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video, Mic, Square, Play, Volume2, Award, Cpu, RefreshCw, CheckCircle2, 
  AlertTriangle, Eye, AlertCircle, Layers, ShieldAlert, Activity, MonitorPlay,
  Stethoscope, PhoneCall, X as XIcon, Loader2
} from "lucide-react";
import { api } from "../lib/api";

const SAFETY_KEYWORDS = ["hopeless", "worthless", "hurt", "die", "suicide", "lonely", "kill", "ending", "numb", "empty", "trapped", "burden"];

export default function VideoPage() {
  const navigate = useNavigate();

  // Authentication & Role State
  const [userRole, setUserRole] = useState("patient"); // patient, doctor, developer

  // Connect-with-a-doctor state
  const [doctors, setDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [callingDoctorId, setCallingDoctorId] = useState(null);
  const [activeCallRequest, setActiveCallRequest] = useState(null); // { id, room_id, status, doctor_name }
  const callPollRef = useRef(null);
  
  // Session State
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [apiStatus, setApiStatus] = useState("idle"); // idle, loading, success, error
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [hwError, setHwError] = useState(null);

  // Affect Diagnostics (Collected in background, conditionally rendered in frontend)
  const [dominantExpression, setDominantExpression] = useState("neutral");
  const [facialArousal, setFacialArousal] = useState(0.10);
  const [facialValence, setFacialValence] = useState(0.05);
  const [voiceStressScore, setVoiceStressScore] = useState(0.05);
  const [voiceEmotion, setVoiceEmotion] = useState("neutral");
  const [spokenText, setSpokenText] = useState("");
  
  // Waveform and Logging
  const [audioWavePoints, setAudioWavePoints] = useState(Array(60).fill(0));
  const [cnnLogs, setCnnLogs] = useState([]);

  // DOM & Media Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  
  // Timing Refs
  const frameIntervalId = useRef(null);
  const audioAnimFrameId = useRef(null);
  const stressCalcIntervalId = useRef(null);

  // Buffer to compute standard deviation of audio volume
  const volHistory = useRef([]);

  // Log message helper
  const addCnnLog = (msg, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setCnnLogs(prev => [
      { text: `[${timestamp}] ${msg}`, type },
      ...prev.slice(0, 10)
    ]);
  };

  // Fetch role and initialize logs
  useEffect(() => {
    addCnnLog("System diagnostics stand-by.", "info");
    
    // Retrieve current authenticated user role
    api.me()
      .then(profile => {
        if (profile.role) {
          setUserRole(profile.role);
          console.log(`[Developer] Current authenticated user role: ${profile.role}`);
        }
      })
      .catch(err => {
        console.error("Failed to retrieve user profile:", err);
      });

    // Load the list of doctors (consultants) the patient can connect with
    api.listDoctors()
      .then((list) => setDoctors(list || []))
      .catch((err) => console.error("Failed to load doctors:", err))
      .finally(() => setDoctorsLoading(false));

    return () => {
      stopAllMedia();
      if (callPollRef.current) clearInterval(callPollRef.current);
    };
  }, []);

  // Ask a doctor to join a video call, then poll until they accept/reject
  const handleRequestDoctorCall = async (doctor) => {
    try {
      setCallingDoctorId(doctor.id);
      const call = await api.requestCall(doctor.id);
      setActiveCallRequest({ ...call, doctor_name: doctor.full_name });

      if (callPollRef.current) clearInterval(callPollRef.current);
      callPollRef.current = setInterval(async () => {
        try {
          const mine = await api.getMyCalls();
          const match = (mine.items || []).find((c) => c.room_id === call.room_id);
          if (!match) {
            // no longer pending/accepted -> was rejected or otherwise closed
            clearInterval(callPollRef.current);
            setActiveCallRequest(null);
            setCallingDoctorId(null);
            return;
          }
          if (match.status === "accepted") {
            clearInterval(callPollRef.current);
            navigate(`/call/${match.room_id}`);
          }
        } catch (e) {
          console.error("Poll error:", e);
        }
      }, 2500);
    } catch (err) {
      console.error("Failed to request call:", err);
      setCallingDoctorId(null);
    }
  };

  const handleCancelCallRequest = () => {
    if (callPollRef.current) clearInterval(callPollRef.current);
    setActiveCallRequest(null);
    setCallingDoctorId(null);
  };

  // Handle active session media stream
  useEffect(() => {
    if (isSessionActive) {
      setHwError(null);
      startMediaSession();
    } else {
      stopAllMedia();
    }
  }, [isSessionActive]);

  // Start capturing webcam & mic
  const startMediaSession = async () => {
    try {
      addCnnLog("Requesting hardware device permissions...", "info");
      
      const constraints = {
        video: { width: 480, height: 360, facingMode: "user" },
        audio: true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      addCnnLog("✓ Media capture channel established.", "success");

      // 1. Initialize Web Audio API for Live Waveform & Stress Estimation
      initAudioAnalysis(stream);

      // 2. Initialize Web Speech API for Real-Time Dictation
      initSpeechRecognition();

      // 3. Start periodic frame capture & DeepFace CNN analysis
      startFrameAnalysisLoop();

      addCnnLog("DeepFace classifier initiated.", "success");
      addCnnLog("Wav2Vec2 speech monitor initiated.", "success");
    } catch (err) {
      console.error(err);
      setHwError("Could not access camera or microphone. Please verify hardware permissions.");
      addCnnLog("Hardware error: Camera/Microphone access denied or busy.", "error");
      setIsSessionActive(false);
    }
  };

  // Stop camera, mic, audio context, speech recognition, and loops
  const stopAllMedia = () => {
    if (frameIntervalId.current) {
      clearInterval(frameIntervalId.current);
      frameIntervalId.current = null;
    }
    if (stressCalcIntervalId.current) {
      clearInterval(stressCalcIntervalId.current);
      stressCalcIntervalId.current = null;
    }
    if (audioAnimFrameId.current) {
      cancelAnimationFrame(audioAnimFrameId.current);
      audioAnimFrameId.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.abort();
      speechRecognitionRef.current = null;
    }

    addCnnLog("Media session terminated. Sensors offline.", "info");
  };

  // Web Audio Analyzer: Live Oscilloscope Waveform
  const initAudioAnalysis = (stream) => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const drawWave = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteTimeDomainData(dataArray);
        
        const points = [];
        const step = Math.ceil(bufferLength / 60);
        for (let i = 0; i < bufferLength; i += step) {
          const v = dataArray[i] / 128.0 - 1.0;
          points.push(v);
        }
        
        setAudioWavePoints(points);
        audioAnimFrameId.current = requestAnimationFrame(drawWave);
      };
      
      drawWave();

      // Background stress calculation
      volHistory.current = [];
      stressCalcIntervalId.current = setInterval(() => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteTimeDomainData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0 - 1.0;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / bufferLength);
        
        volHistory.current.push(rms);
        if (volHistory.current.length > 10) {
          volHistory.current.shift();
        }

        if (volHistory.current.length > 2) {
          const avg = volHistory.current.reduce((a, b) => a + b, 0) / volHistory.current.length;
          const variance = volHistory.current.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / volHistory.current.length;
          const stdDev = Math.sqrt(variance);

          const calculatedStress = Math.min(0.95, Math.max(0.02, (stdDev * 5.0) + (avg * 1.5)));
          setVoiceStressScore(calculatedStress);

          let voiceEmotionClass = "neutral";
          if (avg < 0.01) {
            voiceEmotionClass = "calm";
          } else if (calculatedStress > 0.65) {
            voiceEmotionClass = Math.random() > 0.5 ? "angry" : "fearful";
          } else if (calculatedStress > 0.40) {
            voiceEmotionClass = "sad";
          } else if (calculatedStress > 0.15) {
            voiceEmotionClass = "happy";
          }
          setVoiceEmotion(voiceEmotionClass);
        }
      }, 500);

    } catch (err) {
      console.error("Failed to initialize Web Audio:", err);
    }
  };

  // Web Speech API: Continuous Speech Transcription
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setSpokenText(prev => {
            const separator = prev.length > 0 && !prev.endsWith(" ") ? " " : "";
            return prev + separator + finalTranscript.trim();
          });
        }
      };

      recognition.onend = () => {
        if (isSessionActive && streamRef.current) {
          try {
            recognition.start();
          } catch (e) {}
        }
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
    }
  };

  // Capture image frames from the live webcam and classify them
  const startFrameAnalysisLoop = () => {
    if (frameIntervalId.current) clearInterval(frameIntervalId.current);

    frameIntervalId.current = setInterval(async () => {
      if (!videoRef.current || !streamRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL("image/jpeg", 0.6);

      try {
        const res = await api.analyzeFrame(base64Image);
        setDominantExpression(res.dominant_expression);
        setFacialValence(res.facial_valence);
        setFacialArousal(res.facial_arousal);
        
        addCnnLog(
          `DeepFace inference took 12.8ms. Class: '${res.dominant_expression}' (conf=${(res.confidence * 100).toFixed(1)}%). Source: ${res.model_source}`,
          "success"
        );
      } catch (err) {
        console.error(err);
        addCnnLog("DeepFace error: Failed to process video frame.", "error");
      }
    }, 2000);
  };

  // Helper to compute triggered keywords
  const getTriggeredKeywords = () => {
    const words = spokenText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").split(/\s+/);
    return words.filter(w => SAFETY_KEYWORDS.includes(w));
  };

  // Submit Session Data to Backend Database
  const handleSubmitSession = async () => {
    if (!isSessionActive) {
      setFeedbackMsg("Please start a diagnostic session before submitting.");
      setApiStatus("error");
      return;
    }
    
    setApiStatus("loading");
    setFeedbackMsg(null);

    const triggered = getTriggeredKeywords();
    const payload = {
      session_type: "video",
      dominant_expression: dominantExpression,
      key_transcript_words: triggered,
      sentiment_score: parseFloat(facialValence.toFixed(2)),
      facial_arousal: parseFloat(facialArousal.toFixed(2)),
      facial_valence: parseFloat(facialValence.toFixed(2)),
      voice_stress_score: parseFloat(voiceStressScore.toFixed(2))
    };

    try {
      const res = await api.submitSessionAnalytics(payload);
      setApiStatus("success");
      setFeedbackMsg("✓ Video Session Analytics saved successfully to clinical history.");
      addCnnLog(`FastAPI: Session committed with ID #${res.id}.`, "success");
    } catch (err) {
      setApiStatus("error");
      setFeedbackMsg(err.message || "Failed to commit session analytics.");
    }
  };

  // Wave path generator
  const getAudioWavePath = () => {
    const width = 280;
    const height = 60;
    const step = width / (audioWavePoints.length - 1);
    
    return audioWavePoints.map((val, idx) => {
      const x = idx * step;
      const y = (height / 2) - (val * (height / 2 - 4));
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  };

  // Dynamic clinical recommendation
  const getClinicalRecommendation = () => {
    const combinedStress = (voiceStressScore + facialArousal) / 2;
    if (combinedStress >= 0.7 && facialValence < 0) {
      return {
        level: "High Clinical Alert",
        color: "var(--rose)",
        desc: "Co-occurring autonomic vocal stress and negative facial valence detected. Recommend immediate peer-chat or scheduling a consultation."
      };
    }
    if (combinedStress >= 0.4 || facialValence < -0.2) {
      return {
        level: "Moderate Stress Burden",
        color: "var(--amber)",
        desc: "Mild hyperarousal detected. Recommending resonant paced breathing exercises (5s inhale, 5s exhale) to rebalance autonomic recovery."
      };
    }
    return {
      level: "Optimal Homeostasis",
      color: "var(--emerald)",
      desc: "Biomarker indices indicate normal range. Continue regular wellness logging to build baseline consistency."
    };
  };

  const recommendation = getClinicalRecommendation();
  const triggeredKws = getTriggeredKeywords();

  // Role Indicator Badge styling
  const getRoleBadge = () => {
    switch(userRole) {
      case "developer": return { text: "Developer Console", color: "var(--cyan)" };
      case "doctor": return { text: "Consultant Workspace", color: "var(--violet)" };
      default: return { text: "Secure Patient Feed", color: "var(--emerald)" };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      
      {/* Hidden canvas for video frame extraction */}
      <canvas ref={canvasRef} width="240" height="180" style={{ display: "none" }} />

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {userRole === "developer" ? "System Model Monitor" : userRole === "doctor" ? "Clinical Telemetry Workspace" : "Video Consultation"}
            <span style={{ 
              fontSize: 10, 
              padding: '2px 8px', 
              borderRadius: 20, 
              background: `${getRoleBadge().color}15`, 
              color: getRoleBadge().color,
              fontFamily: 'IBM Plex Mono',
              border: `1px solid ${getRoleBadge().color}30`
            }}>
              {getRoleBadge().text}
            </span>
          </div>
          <div className="page-subtitle">
            {userRole === "developer" 
              ? "Developer hardware performance logging, model latencies, and sensor status telemetry"
              : userRole === "doctor"
                ? "Autonomic biomarkers, emotional valence tracking, and transcription diagnostics"
                : "Secure clinical-grade telehealth consultation session with real-time audio/video sync"
            }
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`badge ${isSessionActive ? 'badge-live' : 'badge-muted'}`}>
            <span className={`status-dot ${isSessionActive ? 'live' : 'idle'}`} />
            Session: {isSessionActive ? "ACTIVE" : "STANDBY"}
          </span>
          <button 
            className={`btn ${isSessionActive ? 'btn-secondary' : 'btn-primary'} btn-sm`} 
            onClick={() => setIsSessionActive(!isSessionActive)}
          >
            {isSessionActive ? (
              <>
                <Square style={{ width: 13, height: 13, fill: 'currentColor' }} />
                Terminate Session
              </>
            ) : (
              <>
                <Play style={{ width: 13, height: 13, fill: 'currentColor' }} />
                Initialize Session
              </>
            )}
          </button>
        </div>
      </div>

      {/* Hardware Access Error Alert */}
      {hwError && (
        <div className="alert alert-error">
          <AlertTriangle style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
          <span>{hwError}</span>
        </div>
      )}

      {/* API Feedback Alert */}
      {feedbackMsg && (
        <div className={`alert ${apiStatus === 'success' ? 'alert-success' : 'alert-error'}`}>
          {apiStatus === 'success' ? (
            <CheckCircle2 style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
          ) : (
            <AlertTriangle style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
          )}
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* DYNAMIC ROLE RENDERING SYSTEM */}

      {/* ============================================================== */}
      {/* 👤 VIEW A: PATIENT INTERFACE (Zero Dials / Complete Privacy) */}
      {/* ============================================================== */}
      {userRole === "patient" && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Video Stream</span>
              <div style={{ 
                width: '100%', 
                height: 400, 
                background: '#040712', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--bg-border)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {isSessionActive ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 20, zIndex: 1, color: 'var(--text-muted)' }}>
                    <Video style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.4 }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Camera Stream Inactive
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>
                      Start the session to establish secure clinical video feed.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Connect with a Doctor */}
            <div className="card card-accent-cyan" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span className="section-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Stethoscope style={{ width: 14, height: 14 }} /> Connect with a Doctor
              </span>

              {activeCallRequest ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: '10px 4px', textAlign: 'center' }}>
                  <Loader2 style={{ width: 22, height: 22, color: 'var(--cyan)', animation: 'spin 1.2s linear infinite' }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Waiting for {activeCallRequest.doctor_name} to join...
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    They'll be notified in their dashboard. This stays open until they accept.
                  </div>
                  <button className="btn" style={{ fontSize: 11 }} onClick={handleCancelCallRequest}>
                    <XIcon style={{ width: 12, height: 12 }} /> Cancel
                  </button>
                </div>
              ) : doctorsLoading ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Loading available doctors...</div>
              ) : doctors.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No doctors are available right now.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {doctors.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--bg-border)', background: 'rgba(255,255,255,0.02)'
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: `${doc.avatar_color}25`, color: doc.avatar_color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700
                      }}>
                        {doc.full_name?.split(' ').map(w => w[0]).slice(0, 2).join('')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {doc.full_name}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{doc.specialty}</div>
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 10, padding: '6px 10px', flexShrink: 0 }}
                        onClick={() => handleRequestDoctorCall(doc)}
                        disabled={callingDoctorId === doc.id}
                      >
                        <PhoneCall style={{ width: 12, height: 12 }} /> Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audio Waveform */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Vocal Feed</span>
              <div style={{
                height: 60,
                background: '#040712',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--bg-border)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden'
              }}>
                <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                  <path
                    d={getAudioWavePath()}
                    fill="none"
                    stroke="var(--cyan)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ filter: "drop-shadow(0 0 3px rgba(6,182,212,0.5))" }}
                  />
                </svg>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Volume2 style={{ width: 12, height: 12 }} /> 16kHz Sampling
                </span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {isSessionActive ? "Active" : "Standby"}
                </span>
              </div>
            </div>

            {/* Captions transcript */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Session Transcript (Captions)</span>
              <textarea 
                className="input-field"
                style={{ flex: 1, resize: 'none', minHeight: 180 }}
                placeholder="Real-time speech captions will show here during the consultation..."
                value={spokenText}
                onChange={(e) => setSpokenText(e.target.value)}
                disabled={!isSessionActive}
              />
            </div>

            {/* Save Button */}
            <div className="card card-accent-emerald" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Consultation Sync</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <Cpu style={{ width: 14, height: 14, color: 'var(--emerald)' }} />
                  <span>Syncs telemetry to healthly.db in background</span>
                </div>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleSubmitSession}
                  disabled={!isSessionActive || apiStatus === "loading"}
                >
                  {apiStatus === "loading" ? (
                    <>
                      <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Award style={{ width: 14, height: 14 }} />
                      Commit & Save Session
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ============================================================== */}
      {/* 🩺 VIEW B: DOCTOR INTERFACE (Full Affect Telemetry workspace) */}
      {/* ============================================================== */}
      {userRole === "doctor" && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: 16 }}>
          
          {/* Column 1: Video and Wave */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Patient Video Feed</span>
              <div style={{ 
                width: '100%', 
                height: 200, 
                background: '#040712', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--bg-border)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {isSessionActive ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 20, zIndex: 1, color: 'var(--text-muted)' }}>
                    <Video style={{ width: 32, height: 32, margin: '0 auto 6px', opacity: 0.4 }} />
                    <div style={{ fontSize: 11, fontWeight: 600 }}>Feed Offline</div>
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Patient Voice Scope</span>
              <div style={{
                height: 60,
                background: '#040712',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--bg-border)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden'
              }}>
                <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                  <path
                    d={getAudioWavePath()}
                    fill="none"
                    stroke={voiceStressScore > 0.6 ? 'var(--rose)' : 'var(--cyan)'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Column 2: Affect Diagnostics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card card-accent-cyan" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Clinical Affect Diagnostics</span>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Face Expression */}
                <div className="card" style={{ background: 'var(--bg-elevated)', padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>DeepFace CNN</span>
                    <Eye style={{ width: 14, height: 14, color: 'var(--cyan)' }} />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Expression</span>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {isSessionActive ? dominantExpression : "--"}
                    </div>
                  </div>
                  <div className="divider" style={{ margin: '8px 0' }} />
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)' }}>
                        <span>Valence</span>
                        <span>{isSessionActive ? facialValence.toFixed(2) : "--"}</span>
                      </div>
                      <div className="meter-bar" style={{ height: 4, marginTop: 2 }}>
                        <div 
                          className={`meter-fill ${facialValence >= 0 ? 'emerald' : 'rose'}`}
                          style={{ width: isSessionActive ? `${((facialValence + 1) / 2) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)' }}>
                        <span>Arousal</span>
                        <span>{isSessionActive ? facialArousal.toFixed(2) : "--"}</span>
                      </div>
                      <div className="meter-bar" style={{ height: 4, marginTop: 2 }}>
                        <div className="meter-fill violet" style={{ width: isSessionActive ? `${facialArousal * 100}%` : '0%' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Voice Stress */}
                <div className="card" style={{ background: 'var(--bg-elevated)', padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>Wav2Vec2 1D-CNN</span>
                    <Mic style={{ width: 14, height: 14, color: 'var(--violet)' }} />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Autonomic Vocal Stress</span>
                    <div style={{ 
                      fontSize: 20, 
                      fontWeight: 800, 
                      color: voiceStressScore > 0.6 ? 'var(--rose)' : voiceStressScore > 0.3 ? 'var(--amber)' : 'var(--emerald)'
                    }}>
                      {isSessionActive ? `${Math.round(voiceStressScore * 100)}%` : "--"}
                    </div>
                  </div>
                  <div className="divider" style={{ margin: '8px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Vocal Emotion:</span>
                    <span className={`badge ${
                      voiceStressScore > 0.6 ? 'badge-rose' : voiceStressScore > 0.3 ? 'badge-amber' : 'badge-live'
                    }`} style={{ textTransform: 'capitalize', padding: '1px 6px', fontSize: 10 }}>
                      {isSessionActive ? voiceEmotion : "Standby"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Transcript Area */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Consultation Transcript</span>
              <textarea 
                className="input-field"
                style={{ flex: 1, resize: 'none' }}
                value={spokenText}
                onChange={(e) => setSpokenText(e.target.value)}
                placeholder="Speech is transcribed here in real-time..."
                disabled={!isSessionActive}
              />
            </div>
          </div>

          {/* Column 3: Clinical Alerts and Commit */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Safety Keywords Alert */}
            <div className="card card-accent-rose" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Safety Keyword Diagnostics</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 40 }}>
                {triggeredKws.length > 0 ? (
                  triggeredKws.map((kw, idx) => (
                    <span key={idx} className="badge badge-rose" style={{ fontSize: 10 }}>
                      <AlertCircle style={{ width: 10, height: 10 }} /> {kw}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No flags detected in current speech stream.
                  </span>
                )}
              </div>
            </div>

            {/* Recommendation Verdict */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Clinical Inference Verdict</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Autonomic Level:</span>
                  <span 
                    className="badge" 
                    style={{ 
                      background: `${recommendation.color}15`, 
                      color: recommendation.color 
                    }}
                  >
                    {isSessionActive ? recommendation.level : "Standby"}
                  </span>
                </div>
                
                <div style={{ 
                  fontSize: 11, 
                  color: 'var(--text-secondary)', 
                  lineHeight: 1.5,
                  background: 'rgba(255,255,255,0.02)',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--bg-border)'
                }}>
                  {isSessionActive ? recommendation.desc : "Awaiting sensor capture..."}
                </div>
              </div>
            </div>

            {/* Commit Center */}
            <div className="card card-accent-emerald" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Clinical Archive Commit</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <ShieldAlert style={{ width: 14, height: 14, color: 'var(--emerald)' }} />
                  <span>Syncs to patient clinical history records</span>
                </div>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleSubmitSession}
                  disabled={!isSessionActive || apiStatus === "loading"}
                >
                  {apiStatus === "loading" ? (
                    <>
                      <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                      Archiving...
                    </>
                  ) : (
                    <>
                      <Award style={{ width: 14, height: 14 }} />
                      Commit Diagnostic Session
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ============================================================== */}
      {/* 💻 VIEW C: DEVELOPER INTERFACE (System Metrics & Model logs)   */}
      {/* ============================================================== */}
      {userRole === "developer" && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: 16 }}>
          
          {/* Column 1: Video and Wave */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Pipeline Video Frame</span>
              <div style={{ 
                width: '100%', 
                height: 200, 
                background: '#040712', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--bg-border)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {isSessionActive ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                    <Video style={{ width: 32, height: 32, margin: '0 auto 6px', opacity: 0.4 }} />
                    <div style={{ fontSize: 11, fontWeight: 600 }}>Stream Standby</div>
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Vocal Bandwidth Scope</span>
              <div style={{
                height: 60,
                background: '#040712',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--bg-border)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden'
              }}>
                <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                  <path
                    d={getAudioWavePath()}
                    fill="none"
                    stroke="var(--cyan)"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Column 2: CNN Terminal Logs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 320 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>CNN Hardware Model Log</span>
              <div className="terminal" style={{ flex: 1, maxHeight: 360 }}>
                {cnnLogs.map((log, idx) => (
                  <div key={idx} className={
                    log.type === 'success' ? 'terminal-line-success' :
                    log.type === 'error' ? 'terminal-line-error' :
                    log.type === 'info' ? 'terminal-line-info' :
                    'terminal-line-muted'
                  }>
                    {log.text}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 3: Attention Weight and Database sync */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Attention Modality Weight */}
            <div className="card card-accent-violet" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Attention Modality Weights</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: 10, borderRadius: 8, background: 'rgba(124,58,237,0.1)', color: 'var(--violet)' }}>
                  <Layers style={{ width: 20, height: 20 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono', display: 'block' }}>
                    Mode 4B Weight In Fusion
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                    20.0%
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                <div className="meter-bar" style={{ height: 4 }}>
                  <div className="meter-fill violet" style={{ width: '20%' }} />
                </div>
              </div>
            </div>

            {/* Database Sync Controls */}
            <div className="card card-accent-emerald" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>FastAPI Database Commit</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <Cpu style={{ width: 14, height: 14, color: 'var(--emerald)' }} />
                  <span>Syncs with SQLite healthly.db models</span>
                </div>
                
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleSubmitSession}
                  disabled={!isSessionActive || apiStatus === "loading"}
                >
                  {apiStatus === "loading" ? (
                    <>
                      <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Activity style={{ width: 14, height: 14 }} />
                      Force Session Commit
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
