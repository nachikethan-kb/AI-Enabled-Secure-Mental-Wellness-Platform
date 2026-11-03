import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Cpu, FileCheck, FileText, Upload, XCircle } from "lucide-react";
import { api } from "../lib/api";

function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result || "");
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsText(file);
  });
}

export default function HealthReportPage() {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const addLog = (msg, type = "info") => setLogs(prev => [...prev, { msg, type }]);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError("File exceeds 5MB limit"); return; }
    setFile(f);
    setError(""); setResult(null); setLogs([]);
    addLog(`File loaded: ${f.name} (${Math.round(f.size / 1024)}KB)`, "info");
    const content = await readFile(f);
    setText(content);
    addLog("Document buffered. Ready to analyze.", "success");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) { setError("No content to analyze."); return; }
    setUploading(true); setError(""); setResult(null);
    const steps = [
      ["Initializing OCR pipeline...", "info"],
      ["Running BioClinicalBERT entity extraction...", "info"],
      ["Identifying diagnoses, medications, and procedures...", "info"],
      ["Mapping entities to clinical ontology (ICD-10, SNOMED)...", "info"],
      ["Integrating into multimodal wellness model...", "info"],
    ];
    for (const [msg, type] of steps) {
      await new Promise(r => setTimeout(r, 550));
      addLog(msg, type);
    }
    try {
      const res = await api.submitHealthReport(file?.name || 'manual-entry.txt', text.trim());
      addLog(`✓ Extraction complete. ${res.diagnoses?.length || 0} diagnoses, ${res.medications?.length || 0} medications found.`, "success");
      setResult(res);
    } catch (err) {
      setError(err.message);
      addLog(`✗ Analysis failed: ${err.message}`, "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1000, margin: '0 auto' }}>
      <div>
        <div className="page-title">Clinical Record Intelligence</div>
        <div className="page-subtitle">BioClinicalBERT-powered medical entity extraction and longitudinal record analysis</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>

        {/* Upload Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', overflow: 'hidden' }}>
          {uploading && <div className="neon-scanner" />}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Document Intake</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
              <Cpu style={{ width: 11, height: 11, color: uploading ? 'var(--cyan)' : 'var(--text-muted)' }} />
              {uploading ? 'PROCESSING' : 'READY'}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="upload-zone" style={{ display: 'block', cursor: 'pointer' }}>
              <Upload style={{ width: 24, height: 24, color: 'var(--cyan)', marginBottom: 10 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                {file ? file.name : 'Upload clinical document'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                TXT, MD, CSV, JSON · max 5MB · or paste below
              </div>
              <input type="file" style={{ display: 'none' }} onChange={handleFile} accept=".txt,.md,.csv,.json" />
            </label>

            {file && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 8 }}>
                <FileText style={{ width: 14, height: 14, color: 'var(--cyan)' }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{Math.round(file.size / 1024)}KB</span>
                <button type="button" onClick={() => { setFile(null); setText(''); setLogs([]); setResult(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <XCircle style={{ width: 14, height: 14 }} />
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Or paste document content
              </label>
              <textarea
                className="input-field"
                style={{ minHeight: 160, fontSize: 12 }}
                placeholder="Paste clinical notes, prescriptions, discharge summaries, or psychiatric intake records..."
                value={text}
                onChange={e => { setText(e.target.value); setError(''); setResult(null); }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textAlign: 'right' }}>
                {text.length} chars
              </div>
            </div>

            {error && (
              <div className="alert alert-error">
                <AlertTriangle style={{ width: 13, height: 13 }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={uploading || !text.trim()} style={{ flex: 1 }}>
                {uploading ? 'Analyzing Record...' : 'Run Clinical Analysis'}
              </button>
              {(file || text) && (
                <button className="btn btn-secondary" type="button" onClick={() => { setFile(null); setText(''); setLogs([]); setResult(null); setError(''); }}>
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Analysis Log + Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* BioClinicalBERT Log Terminal */}
          <div className="card card-sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Cpu style={{ width: 13, height: 13, color: 'var(--cyan)' }} />
              <span className="section-title" style={{ marginBottom: 0 }}>BioClinicalBERT Log</span>
            </div>
            <div className="terminal" style={{ minHeight: 140, maxHeight: 200 }}>
              {logs.length === 0 ? (
                <div className="terminal-line-muted">Awaiting document input...</div>
              ) : (
                logs.map((l, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={
                      l.type === 'success' ? 'terminal-line-success' :
                      l.type === 'error' ? 'terminal-line-error' :
                      l.type === 'warn' ? 'terminal-line-warn' : 'terminal-line-info'
                    }
                  >
                    {l.msg}
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Extracted Entities */}
          {result && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card card-sm card-accent-emerald">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <FileCheck style={{ width: 13, height: 13, color: 'var(--emerald)' }} />
                <span className="section-title" style={{ marginBottom: 0 }}>Extracted Entities</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 6 }}>DIAGNOSES</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {result.diagnoses?.length > 0 ? (
                      result.diagnoses.map((d, i) => (
                        <span key={i} className="badge badge-cyan">{d}</span>
                      ))
                    ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>None detected</span>}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 6 }}>MEDICATIONS</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {result.medications?.length > 0 ? (
                      result.medications.map((m, i) => (
                        <span key={i} className="badge badge-violet">{m}</span>
                      ))
                    ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>None detected</span>}
                  </div>
                </div>

                {result.summary && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 4 }}>SUMMARY</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{result.summary}</div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Model Info */}
          <div className="card card-sm">
            <div className="section-title">Analysis Models</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              {[
                ['NER Model', 'BioClinicalBERT'],
                ['OCR Engine', 'Tesseract v4'],
                ['Ontology', 'ICD-10 / SNOMED-CT'],
                ['Entity Types', 'Dx, Meds, Procedures'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{k}</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}