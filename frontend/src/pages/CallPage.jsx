import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import VideoCallRoom from "../components/VideoCallRoom";

export default function CallPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [call, setCall] = useState(null);
  const [error, setError] = useState(null);
  const selfRole = localStorage.getItem("role") || "patient";

  useEffect(() => {
    let mounted = true;
    api
      .getCallRoom(roomId)
      .then((data) => mounted && setCall(data))
      .catch((e) => mounted && setError(e.message || "Could not load this call"));
    return () => {
      mounted = false;
    };
  }, [roomId]);

  if (error) {
    return (
      <div className="card" style={{ maxWidth: 420, margin: "60px auto", textAlign: "center", padding: 28 }}>
        <AlertTriangle style={{ width: 28, height: 28, color: "var(--rose)", margin: "0 auto 10px" }} />
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{error}</div>
        <button className="btn btn-primary" onClick={() => navigate(-1)} style={{ marginTop: 10 }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Go back
        </button>
      </div>
    );
  }

  if (!call) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading call...</div>;
  }

  const peerLabel = selfRole === "consultant" ? call.patient_name || "Patient" : call.doctor_name || "Doctor";

  return (
    <div style={{ height: "calc(100vh - 140px)", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="page-title" style={{ marginBottom: 0 }}>Video Consultation</div>
        <button className="topbar-icon-btn" onClick={() => navigate(-1)}>
          <ArrowLeft style={{ width: 14, height: 14 }} />
        </button>
      </div>
      <VideoCallRoom
        roomId={roomId}
        selfRole={selfRole === "consultant" ? "doctor" : "patient"}
        peerLabel={peerLabel}
        callId={call.id}
        onExit={() => navigate(selfRole === "consultant" ? "/dashboard" : "/video")}
      />
    </div>
  );
}
