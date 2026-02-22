import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import WorkoutPlanGenerator from '../components/WorkoutPlanGenerator';
import { userAPI } from '../services/api';

export default function WorkoutPlan() {
  const { user, logout } = usePrivy();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatedPlan, setGeneratedPlan] = useState(null);

  useEffect(() => {
    // Fetch user profile to use for plan generation
    fetch('/api/user/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await fetch('/logout', { credentials: 'include' });
    await logout();
  }

  function handlePlanGenerated(plan) {
    setGeneratedPlan(plan);
  }

  const email = user?.email?.address || user?.google?.email || 'there';
  const firstName = email.split('@')[0];

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>
        <span style={s.logo}>RegisterYourRep</span>
        <button style={s.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div style={s.content}>
        <div style={s.header}>
          <h1 style={s.title}>Workout Plan Generator</h1>
          <p style={s.subtitle}>
            Tap the button below to generate your personalized AI workout plan
          </p>
        </div>

        {loading ? (
          <div style={s.loadingBox}>
            <p style={s.loadingText}>Loading your preferences...</p>
          </div>
        ) : profile ? (
          <>
            {/* User Summary */}
            <div style={s.summaryGrid}>
              <div style={s.summaryCard}>
                <span style={s.cardLabel}>Level</span>
                <span style={s.cardValue}>{profile.fitnessLevel || '—'}</span>
              </div>
              <div style={s.summaryCard}>
                <span style={s.cardLabel}>Frequency</span>
                <span style={s.cardValue}>
                  {profile.frequency ? `${profile.frequency}x/week` : '—'}
                </span>
              </div>
              <div style={s.summaryCard}>
                <span style={s.cardLabel}>Duration</span>
                <span style={s.cardValue}>
                  {profile.sessionDuration ? `${profile.sessionDuration}m` : '—'}
                </span>
              </div>
            </div>

            {/* Workout Plan Generator */}
            <WorkoutPlanGenerator
              userPreferences={profile}
              onPlanGenerated={handlePlanGenerated}
            />

            {/* Info Box */}
            <div style={s.infoBox}>
              <h3 style={s.infoTitle}>ℹ️ How it works</h3>
              <ul style={s.infoList}>
                <li>Click "Generate Plan" to create a workout using AI</li>
                <li>Your plan includes exercises, sets, reps, and rest periods</li>
                <li>Plans are tailored to your fitness level and goals</li>
                <li>You can regenerate at any time to get new variations</li>
              </ul>
            </div>
          </>
        ) : (
          <div style={s.errorBox}>
            <p style={s.errorText}>
              Could not load your profile. Please try again.
            </p>
            <button
              style={s.retryBtn}
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#0f0f0f',
    fontFamily: 'Arial, sans-serif',
  },
  topBar: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#888',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  logo: {
    color: '#ff1e00',
    fontWeight: '700',
    fontSize: '18px',
  },
  logoutBtn: {
    background: '#ff1e00',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  content: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
  },
  title: {
    color: '#fff',
    fontSize: '32px',
    fontWeight: '700',
    margin: '0 0 8px',
  },
  subtitle: {
    color: '#888',
    fontSize: '16px',
    margin: '0',
  },
  loadingBox: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: '16px',
    margin: '0',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '40px',
  },
  summaryCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
  },
  cardLabel: {
    display: 'block',
    color: '#888',
    fontSize: '12px',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  cardValue: {
    display: 'block',
    color: '#ff1e00',
    fontSize: '18px',
    fontWeight: '600',
  },
  infoBox: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '20px',
    marginTop: '40px',
  },
  infoTitle: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    margin: '0 0 12px',
  },
  infoList: {
    color: '#888',
    fontSize: '13px',
    paddingLeft: '20px',
    margin: '0',
  },
  errorBox: {
    background: '#2a1010',
    border: '1px solid #ff6655',
    borderRadius: '12px',
    padding: '30px',
    textAlign: 'center',
  },
  errorText: {
    color: '#ff4444',
    fontSize: '16px',
    margin: '0 0 16px',
  },
  retryBtn: {
    background: '#ff1e00',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 20px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
