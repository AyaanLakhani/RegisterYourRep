/**
 * Centralized API service for all HTTP requests
 */

const API_BASE = '/api';

/**
 * Generic fetch wrapper with error handling
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultOptions = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error(`API Error: ${endpoint}`, error);
    throw error;
  }
}

/**
 * User API endpoints
 */
export const userAPI = {
  getProfile: () => request('/user/profile'),
  updateProfile: (profileData) =>
    request('/user/profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    }),
};

/**
 * Workout API endpoints
 */
export const workoutAPI = {
  generatePlan: (userPreferences) =>
    request('/workouts/generate', {
      method: 'POST',
      body: JSON.stringify({ userPreferences }),
    }),

  getLatestPlan: () => request('/workouts/latest'),

  savePlan: (plan) =>
    request('/workouts', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),

  getAllPlans: () => request('/workouts'),
};

export default {
  userAPI,
  workoutAPI,
  request,
};
