import { useState } from 'react';
import { useWorkoutPlan } from '../hooks/useWorkoutPlan';

/**
 * Component to trigger workout plan generation and display status
 */
export default function WorkoutPlanGenerator({ userPreferences, onPlanGenerated }) {
  const { plan, loading, error, generatePlan } = useWorkoutPlan();
  const [showDetails, setShowDetails] = useState(false);

  async function handleGeneratePlan() {
    if (!userPreferences) {
      alert('Please complete your onboarding first');
      return;
    }

    const generatedPlan = await generatePlan(userPreferences);
    if (generatedPlan && onPlanGenerated) {
      onPlanGenerated(generatedPlan);
    }
  }

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.header}>
          <h2 style={s.title}>Generate Your AI Workout Plan</h2>
          <p style={s.subtitle}>
            A personalized plan based on your fitness level, goals, and schedule
          </p>
        </div>

        {error && (
          <div style={s.errorBox}>
            <p style={s.errorText}>{error}</p>
          </div>
        )}

        <button
          style={{ ...s.generateBtn, ...(loading ? s.btnLoading : {}) }}
          onClick={handleGeneratePlan}
          disabled={loading}
        >
          {loading ? (
            <>
              <span style={s.spinner}>⏳</span> Generating Plan...
            </>
          ) : (
            <>
              <span style={s.icon}>✨</span> Generate Plan
            </>
          )}
        </button>

        {plan && (
          <>
            <button
              style={s.toggleBtn}
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide Details' : 'View Plan Details'}
            </button>

            {showDetails && (
              <div style={s.planDetails}>
                <h3 style={s.planSummary}>{plan.summary}</h3>

                {plan.weeklySchedule && plan.weeklySchedule.length > 0 && (
                  <div style={s.weeklySchedule}>
                    <h4 style={s.scheduleTitle}>Weekly Schedule</h4>
                    {plan.weeklySchedule.map((day, idx) => (
                      <div key={idx} style={s.dayCard}>
                        <h5 style={s.dayTitle}>{day.day}</h5>
                        <p style={s.focusAreas}>
                          Focus: {day.focusAreas.join(', ')}
                        </p>
                        <div style={s.exerciseList}>
                          {day.exercises && day.exercises.map((ex, exIdx) => (
                            <div key={exIdx} style={s.exerciseItem}>
                              <span style={s.exerciseName}>{ex.name}</span>
                              <span style={s.exerciseDetails}>
                                {ex.sets} x {ex.reps} • Rest: {ex.restSeconds}s
                              </span>
                              {ex.notes && (
                                <span style={s.exerciseNotes}>{ex.notes}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {plan.tipsAndNotes && plan.tipsAndNotes.length > 0 && (
                  <div style={s.tipsSection}>
                    <h4 style={s.tipsTitle}>Tips & Notes</h4>
                    {plan.tipsAndNotes.map((item, idx) => (
                      <div key={idx} style={s.tipItem}>
                        <span style={s.tipCategory}>{item.category}:</span>
                        <p style={s.tipText}>{item.tip}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  container: {
    padding: '20px',
  },
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '30px',
    maxWidth: '700px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    color: '#fff',
    fontSize: '24px',
    fontWeight: '700',
    margin: '0 0 8px',
  },
  subtitle: {
    color: '#888',
    fontSize: '14px',
    margin: '0',
  },
  errorBox: {
    background: '#2a1010',
    border: '1px solid #ff6655',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
  },
  errorText: {
    color: '#ff4444',
    fontSize: '13px',
    margin: '0',
  },
  generateBtn: {
    width: '100%',
    background: '#ff1e00',
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background 0.2s',
    marginBottom: '16px',
  },
  btnLoading: {
    background: '#cc1800',
    cursor: 'not-allowed',
    opacity: '0.8',
  },
  icon: {
    fontSize: '18px',
  },
  spinner: {
    fontSize: '18px',
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
  },
  toggleBtn: {
    width: '100%',
    background: '#222',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '12px',
    color: '#ccc',
    fontSize: '14px',
    cursor: 'pointer',
    marginBottom: '16px',
    transition: 'border-color 0.2s',
  },
  planDetails: {
    marginTop: '20px',
    padding: '16px',
    background: '#0f0f0f',
    borderRadius: '8px',
    border: '1px solid #222',
  },
  planSummary: {
    color: '#ccc',
    fontSize: '14px',
    margin: '0 0 16px',
    fontWeight: '500',
  },
  weeklySchedule: {
    marginBottom: '24px',
  },
  scheduleTitle: {
    color: '#ff1e00',
    fontSize: '14px',
    fontWeight: '700',
    margin: '0 0 12px',
    textTransform: 'uppercase',
  },
  dayCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '12px',
  },
  dayTitle: {
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    margin: '0 0 6px',
  },
  focusAreas: {
    color: '#888',
    fontSize: '12px',
    margin: '0 0 8px',
  },
  exerciseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  exerciseItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '8px',
    background: '#0f0f0f',
    borderRadius: '4px',
    borderLeft: '2px solid #ff1e00',
  },
  exerciseName: {
    color: '#ccc',
    fontSize: '13px',
    fontWeight: '500',
  },
  exerciseDetails: {
    color: '#777',
    fontSize: '12px',
  },
  exerciseNotes: {
    color: '#666',
    fontSize: '11px',
    fontStyle: 'italic',
  },
  tipsSection: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #222',
  },
  tipsTitle: {
    color: '#ff1e00',
    fontSize: '14px',
    fontWeight: '700',
    margin: '0 0 12px',
    textTransform: 'uppercase',
  },
  tipItem: {
    marginBottom: '12px',
  },
  tipCategory: {
    color: '#ff1e00',
    fontSize: '12px',
    fontWeight: '600',
  },
  tipText: {
    color: '#888',
    fontSize: '13px',
    margin: '4px 0 0',
  },
};
