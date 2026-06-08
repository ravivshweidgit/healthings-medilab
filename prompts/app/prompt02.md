# Cursor Task 02: The Intelligence Layer & Metabolic Insights

## Context
Project: Healthings-Medilab
Current State: Base Expo app initialized with Samsung Health Service and basic UI cards.
Goal: Implement the logic that correlates activity with glucose drops and refine the Dashboard for actionable insights.

## Objective
Create the "Metabolic Efficiency" engine and implement a robust data-fetching hook to make the Dashboard reactive and intelligent.

## Phase 1: The Logic Engine
1. **Create File:** `app/src/logic/MetabolicLogic.ts`.
2. **Implementation:** - Write a function `calculateMetabolicEfficiency`. 
   - Logic: Identify periods of sustained activity (e.g., 20+ mins of walking). 
   - Calculate the rate of change ($Δ$) in Blood Glucose during and 30 mins after this activity.
   - Return an "Efficiency Score" (0-100) based on how effectively activity suppressed glucose spikes.

## Phase 2: Custom Hook Infrastructure
1. **Create File:** `app/src/hooks/useHealthData.ts`.
2. **Logic:**
   - Use `useState` and `useEffect` to manage the lifecycle of health data.
   - Handle the permission check automatically on mount.
   - Trigger `SamsungHealthService.fetchRecentMetrics()`.
   - Run the data through `calculateMetabolicEfficiency`.
   - Return `{ glucoseData, stepsData, efficiencyScore, isLoading, error, refetch }`.

## Phase 3: Dashboard Refinement (UI/UX)
1. **Update:** `app/src/screens/DashboardScreen.tsx`.
2. **New Components:**
   - **Efficiency Gauge:** A circular or linear progress bar showing the Efficiency Score.
   - **Insight Text:** A dynamic string like: "Your 7,200m walk reduced glucose by 15% more than your average."
3. **Chart Upgrades:**
   - Add a vertical `VictoryLine` or background shading to highlight "Activity Zones" on the Glucose chart.
   - Use distinct colors: Emerald-400 for Glucose, Sky-400 for Steps.

## Phase 4: Data Persistence (Local Cache)
1. **Implementation:** In the `useHealthData` hook, add a simple `AsyncStorage` layer to cache the last fetched data so the dashboard isn't empty while waiting for Health Connect.

## Execution Instructions
- Maintain the sleek Dark Mode theme.
- Ensure TypeScript types are strictly followed for Health Connect data points.
- The UI should feel like a "Command Center" - data-heavy but organized.