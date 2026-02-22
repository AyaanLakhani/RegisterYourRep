import { useState, useCallback } from 'react';
import { workoutAPI } from '../services/api';

/**
 * Custom hook to manage workout plan generation and retrieval
 */
export function useWorkoutPlan() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Generate a new workout plan based on user preferences
   */
  const generatePlan = useCallback(async (userPreferences) => {
    setLoading(true);
    setError('');
    try {
      const response = await workoutAPI.generatePlan(userPreferences);
      setPlan(response.plan);
      return response.plan;
    } catch (err) {
      setError(err.message || 'Failed to generate workout plan');
      console.error('Error generating plan:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch the latest saved workout plan
   */
  const fetchLatestPlan = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await workoutAPI.getLatestPlan();
      if (response.plan) {
        setPlan(response.plan);
      }
      return response.plan;
    } catch (err) {
      setError(err.message || 'Failed to fetch workout plan');
      console.error('Error fetching plan:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Clear the current plan from state
   */
  const clearPlan = useCallback(() => {
    setPlan(null);
    setError('');
  }, []);

  return {
    plan,
    loading,
    error,
    generatePlan,
    fetchLatestPlan,
    clearPlan,
  };
}
