Cursor Task 03: Environment Management & Cloud Persistence Scaffold
Context
Project: Healthings-Medilab
Current State: Mobile app with Samsung Health integration and Metabolic Logic is functional.
Goal: Implement a professional environment switching mechanism and a persistence layer that supports both Local Storage and AWS.

Phase 1: Environment Configuration Setup
Create Environment Files:

Create .env.dev in the app/ root.

Create .env.prod in the app/ root.

Create an operational .env file (copy of .env.dev by default).

Contents for .env.dev:
NODE_ENV=development
STORAGE_STRATEGY=local
AWS_ENDPOINT=http://localhost:4566
AWS_REGION=us-east-1
DYNAMODB_TABLE=HealthMetricsDev

Contents for .env.prod:
NODE_ENV=production
STORAGE_STRATEGY=cloud
AWS_ENDPOINT=https://dynamodb.us-east-1.amazonaws.com
AWS_REGION=us-east-1
DYNAMODB_TABLE=HealthMetricsProd

Phase 2: Centralized Config System
Create File: app/src/config/env.ts.

Logic: Export a CONFIG object that reads from process.env.

Feature: Add a helper function isCloudEnabled() that returns true only if STORAGE_STRATEGY === 'cloud'.

Phase 3: AWS/Local Persistence Service
Update File: app/src/services/AwsDataService.ts.

Logic Implementation:

Create a function persistData(healthData).

Branching Logic:

If STORAGE_STRATEGY === 'local': Log a message "Dev Mode: Skipping AWS, saving to AsyncStorage" and use the existing local caching logic.

If STORAGE_STRATEGY === 'cloud': Use the AWS SDK to attempt a PutItem to DynamoDB using the AWS_ENDPOINT.

Resilience: Wrap the AWS call in a try-catch block to ensure the app doesn't crash if the endpoint is unreachable.

Phase 4: Withings API Infrastructure
Update File: app/src/services/WithingsApiService.ts.

Scaffold Requirements:

Create placeholders for OAuth2 authentication flows.

Define TypeScript types for BodyScanMetrics (Visceral Fat, Vascular Age, Muscle Mass).

Create a function fetchWithingsData() that returns mock data if NODE_ENV === 'development'.

Phase 5: Dashboard Status Update
Update Screen: app/src/screens/DashboardScreen.tsx.

UI Additions:

Add a small status badge at the bottom of the screen: "Mode: [NODE_ENV] | Storage: [STORAGE_STRATEGY]".

Ensure the "Sync" button now calls AwsDataService.persistData() instead of just logging.

Execution Instructions
Use react-native-dotenv for environment variable binding.

Strict Rule: Do not require real AWS Access Keys to run the app when STORAGE_STRATEGY is local.

Maintain the Dark Mode "Command Center" aesthetic.