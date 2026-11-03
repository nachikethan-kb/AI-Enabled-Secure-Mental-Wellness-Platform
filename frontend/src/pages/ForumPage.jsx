import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Calendar, ChevronRight, MessageSquarePlus, Users, X } from "lucide-react";
import { api } from "../lib/api";

export default function ForumPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", content: "" });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.listForumPosts()
      .then(d => setPosts(d.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) { setError("Title and content required"); return; }
    setCreating(true); setError("");
    try {
      const post = await api.createForumPost(form);
      setPosts(prev => [post, ...prev]);
      setForm({ title: "", content: "" });
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Clinical Community</div>
          <div className="page-subtitle">Peer-to-peer wellness intelligence exchange · Private & encrypted</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          <MessageSquarePlus style={{ width: 13, height: 13 }} />
          New Thread
        </button>
      </div>

      {error && <div className="alert alert-error"><AlertTriangle style={{ width: 13, height: 13 }} /><span>{error}</span></div>}

      {/* Create Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Create Discussion Thread</div>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Subject</label>
              <input className="input-field" placeholder="Thread subject..." value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} maxLength={150} required />
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', fontFamily: 'IBM Plex Mono' }}>{form.title.length}/150</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Content</label>
              <textarea className="input-field" placeholder="Share your experience, insight, or question..." value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} maxLength={3000} rows={5} required />
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', fontFamily: 'IBM Plex Mono' }}>{form.content.length}/3000</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" type="submit" disabled={creating}>{creating ? 'Posting...' : 'Post Thread'}</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Posts Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--bg-border)' }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Active threads ({posts.length})</div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 10 }} />)}
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Users style={{ width: 32, height: 32 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No threads yet</div>
            <div style={{ fontSize: 12 }}>Be the first to start a discussion in this community.</div>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="card card-sm" style={{ borderLeft: '3px solid var(--violet)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{post.title}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span className="badge badge-muted">👤 {post.author_name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar style={{ width: 10, height: 10 }} />
                  {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {post.content}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bg-border)' }}>
                <button className="btn btn-ghost btn-xs">Reply</button>
                <button className="btn btn-ghost btn-xs">Support ❤️</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
