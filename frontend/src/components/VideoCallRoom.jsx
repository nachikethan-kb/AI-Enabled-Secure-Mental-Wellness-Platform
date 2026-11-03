import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, MonitorX,
  MessageCircle, Send, Smile, X, Loader2, Wifi, WifiOff
} from "lucide-react";
import { api } from "../lib/api";

// Public STUN server so peers on different networks can discover each other.
// NOTE: a STUN-only setup can fail across strict corporate NATs/firewalls -
// for production, add a TURN server here too.
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

const REACTIONS = ["👍", "❤️", "😂", "👏", "😮", "🙏"];

/**
 * Shared 1:1 video call room used by BOTH the patient and the doctor side.
 * Handles: WebRTC peer connection (via a WebSocket signaling channel),
 * mute/camera toggles, screen sharing, floating emoji reactions, and a
 * private text chat panel - all scoped to this call's room only.
 *
 * Props:
 *  - roomId: string           the call's room id
 *  - selfRole: "patient"|"doctor"
 *  - peerLabel: string        display name of the other participant
 *  - callId: number           CallRequest.id, used to mark the call "ended"
 *  - onExit: () => void       called when the user leaves/ends the call
 */
export default function VideoCallRoom({ roomId, selfRole, peerLabel, callId, onExit }) {
  const [connectionState, setConnectionState] = useState("connecting"); // connecting | waiting | live | ended
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [peerSharingScreen, setPeerSharingScreen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [error, setError] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const makingOfferRef = useRef(false);
  const politeRef = useRef(selfRole === "patient"); // patient yields on glare (perfect negotiation)

  const addSystemMessage = (text) => {
    setMessages((prev) => [...prev, { from: "system", text, at: Date.now() }]);
  };

  const sendSignal = (payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: "ice-candidate", candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setConnectionState("live");
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setError("Connection interrupted. The other participant may have dropped.");
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({ type: "offer", sdp: pc.localDescription });
      } catch (e) {
        console.error("Negotiation error", e);
      } finally {
        makingOfferRef.current = false;
      }
    };

    return pc;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        cameraTrackRef.current = stream.getVideoTracks()[0] || null;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = createPeerConnection();
        pcRef.current = pc;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const ws = new WebSocket(api.getCallSocketUrl(roomId));
        wsRef.current = ws;

        ws.onopen = () => {
          setConnectionState("waiting");
          addSystemMessage("Connected. Waiting for the other participant...");
        };

        ws.onclose = () => {
          if (!cancelled) setConnectionState((s) => (s === "ended" ? s : "ended"));
        };

        ws.onerror = () => setError("Signaling connection error.");

        ws.onmessage = async (evt) => {
          const data = JSON.parse(evt.data);
          const pcNow = pcRef.current;

          switch (data.type) {
            case "peer-joined":
            case "peer-ready": {
              addSystemMessage(`${peerLabel} joined the call.`);
              break;
            }
            case "offer": {
              if (!pcNow) return;
              const offerCollision =
                makingOfferRef.current || pcNow.signalingState !== "stable";
              if (offerCollision && !politeRef.current) return; // impolite peer ignores
              if (offerCollision && politeRef.current) {
                await pcNow.setLocalDescription({ type: "rollback" }).catch(() => {});
              }
              await pcNow.setRemoteDescription(data.sdp);
              const answer = await pcNow.createAnswer();
              await pcNow.setLocalDescription(answer);
              sendSignal({ type: "answer", sdp: pcNow.localDescription });
              break;
            }
            case "answer": {
              if (pcNow && pcNow.signalingState !== "stable") {
                await pcNow.setRemoteDescription(data.sdp);
              }
              break;
            }
            case "ice-candidate": {
              if (pcNow && data.candidate) {
                try {
                  await pcNow.addIceCandidate(data.candidate);
                } catch (e) {
                  console.warn("ICE add error", e);
                }
              }
              break;
            }
            case "chat": {
              setMessages((prev) => [...prev, { from: "peer", text: data.text, at: Date.now() }]);
              break;
            }
            case "reaction": {
              const id = Math.random().toString(36).slice(2);
              setFloatingReactions((prev) => [...prev, { id, emoji: data.emoji }]);
              setTimeout(() => {
                setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
              }, 1800);
              break;
            }
            case "screen-share": {
              setPeerSharingScreen(!!data.active);
              break;
            }
            case "hangup": {
              addSystemMessage(`${peerLabel} ended the call.`);
              setConnectionState("ended");
              break;
            }
            case "peer-left": {
              addSystemMessage(`${peerLabel} left the call.`);
              break;
            }
            default:
              break;
          }
        };
      } catch (e) {
        console.error(e);
        setError("Could not access camera/microphone. Please check permissions.");
      }
    };

    start();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const handleToggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((v) => !v);
  };

  const handleToggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn((v) => !v);
  };

  const handleToggleScreenShare = async () => {
    const pc = pcRef.current;
    if (!pc) return;

    if (!sharingScreen) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) await sender.replaceTrack(screenTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;

        screenTrack.onended = () => stopScreenShare();

        setSharingScreen(true);
        sendSignal({ type: "screen-share", active: true });
      } catch (e) {
        console.warn("Screen share cancelled or failed", e);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = async () => {
    const pc = pcRef.current;
    const camTrack = cameraTrackRef.current;
    if (pc && camTrack) {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
      if (sender) await sender.replaceTrack(camTrack);
    }
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    setSharingScreen(false);
    sendSignal({ type: "screen-share", active: false });
  };

  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { from: "me", text, at: Date.now() }]);
    sendSignal({ type: "chat", text });
    setChatInput("");
  };

  const handleReaction = (emoji) => {
    const id = Math.random().toString(36).slice(2);
    setFloatingReactions((prev) => [...prev, { id, emoji, self: true }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 1800);
    sendSignal({ type: "reaction", emoji });
  };

  const handleEndCall = async () => {
    sendSignal({ type: "hangup" });
    setConnectionState("ended");
    cleanup();
    try {
      if (callId) await api.endCall(callId);
    } catch (e) {
      console.warn("Failed to mark call ended", e);
    }
    onExit && onExit();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      {error && (
        <div className="card" style={{ borderColor: "var(--rose)", color: "var(--rose)", fontSize: 12, padding: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 14, flex: 1, minHeight: 420 }}>
        {/* Video stage */}
        <div style={{ flex: 1, position: "relative", borderRadius: "var(--radius-md)", overflow: "hidden", background: "#040712", border: "1px solid var(--bg-border)" }}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }} />

          {connectionState !== "live" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-secondary)" }}>
              <Loader2 style={{ width: 30, height: 30, animation: "spin 1.2s linear infinite" }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {connectionState === "connecting" && "Setting up your camera & mic..."}
                {connectionState === "waiting" && `Waiting for ${peerLabel} to join...`}
                {connectionState === "ended" && "Call ended."}
              </div>
            </div>
          )}

          {/* Local PIP */}
          <div style={{ position: "absolute", bottom: 14, right: 14, width: 160, height: 110, borderRadius: 10, overflow: "hidden", border: "2px solid var(--bg-border-h)", background: "#000" }}>
            <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>

          {/* Peer / connection badge */}
          <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 8 }}>
            <span className="badge" style={{ background: "rgba(0,0,0,0.5)", color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
              {connectionState === "live" ? <Wifi style={{ width: 12, height: 12, color: "var(--emerald)" }} /> : <WifiOff style={{ width: 12, height: 12, color: "var(--amber)" }} />}
              {peerLabel}
            </span>
            {peerSharingScreen && (
              <span className="badge" style={{ background: "rgba(6,182,212,0.25)", color: "var(--cyan)" }}>Presenting screen</span>
            )}
          </div>

          {/* Floating reactions */}
          <div style={{ position: "absolute", bottom: 90, left: 0, right: 0, height: 0, pointerEvents: "none" }}>
            {floatingReactions.map((r) => (
              <span
                key={r.id}
                style={{
                  position: "absolute",
                  left: r.self ? "70%" : "20%",
                  fontSize: 32,
                  animation: "floatUp 1.8s ease-out forwards",
                }}
              >
                {r.emoji}
              </span>
            ))}
          </div>

          {/* Control bar */}
          <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 10, background: "rgba(10,14,25,0.85)", padding: "10px 14px", borderRadius: 999, border: "1px solid var(--bg-border-h)" }}>
            <CallIconBtn onClick={handleToggleMic} active={micOn} activeIcon={<Mic style={{ width: 16, height: 16 }} />} inactiveIcon={<MicOff style={{ width: 16, height: 16 }} />} />
            <CallIconBtn onClick={handleToggleCam} active={camOn} activeIcon={<Video style={{ width: 16, height: 16 }} />} inactiveIcon={<VideoOff style={{ width: 16, height: 16 }} />} />
            <CallIconBtn onClick={handleToggleScreenShare} active={!sharingScreen} activeIcon={<MonitorUp style={{ width: 16, height: 16 }} />} inactiveIcon={<MonitorX style={{ width: 16, height: 16 }} />} highlight={sharingScreen} />
            <div style={{ position: "relative" }}>
              <button className="topbar-icon-btn" onClick={() => setChatOpen((v) => !v)} title="Chat" style={{ width: 40, height: 40, borderRadius: "50%" }}>
                <MessageCircle style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <ReactionPopover onPick={handleReaction} />
            <button
              onClick={handleEndCall}
              title="End call"
              style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--rose)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <PhoneOff style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Private chat panel */}
        {chatOpen && (
          <div className="card" style={{ width: 280, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--bg-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Private chat</span>
              <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
              {messages.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Only you and {peerLabel} can see these messages.</div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.from === "me" ? "flex-end" : m.from === "system" ? "center" : "flex-start",
                    background: m.from === "me" ? "var(--cyan-dim)" : m.from === "system" ? "transparent" : "var(--bg-elevated)",
                    color: m.from === "system" ? "var(--text-muted)" : "var(--text-primary)",
                    padding: m.from === "system" ? "2px 0" : "6px 10px",
                    borderRadius: 10,
                    maxWidth: "85%",
                    fontStyle: m.from === "system" ? "italic" : "normal",
                    fontSize: m.from === "system" ? 10 : 12,
                  }}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, padding: 10, borderTop: "1px solid var(--bg-border)" }}>
              <input
                className="input-field"
                style={{ flex: 1 }}
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              />
              <button className="btn btn-primary" onClick={handleSendChat} style={{ padding: "8px 10px" }}>
                <Send style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes floatUp {
          0% { opacity: 0; transform: translateY(0) scale(0.6); }
          15% { opacity: 1; transform: translateY(-10px) scale(1); }
          100% { opacity: 0; transform: translateY(-140px) scale(1.1); }
        }
      `}</style>
    </div>
  );
}

function CallIconBtn({ onClick, active, activeIcon, inactiveIcon, highlight }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "1px solid var(--bg-border-h)",
        background: highlight ? "var(--cyan)" : active ? "var(--bg-elevated)" : "var(--rose)",
        color: active && !highlight ? "var(--text-primary)" : "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {active ? activeIcon : inactiveIcon}
    </button>
  );
}

function ReactionPopover({ onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Reactions"
        style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--bg-border-h)", background: "var(--bg-elevated)", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        <Smile style={{ width: 16, height: 16 }} />
      </button>
      {open && (
        <div style={{ position: "absolute", bottom: 48, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4, background: "var(--bg-elevated)", border: "1px solid var(--bg-border-h)", borderRadius: 999, padding: "6px 8px" }}>
          {REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => { onPick(e); setOpen(false); }}
              style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
