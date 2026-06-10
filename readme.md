# Healthings-Medilab

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Healthings-medilab is a comprehensive, open-source health platform designed to integrate high-end medical and fitness hardware into a single, actionable dashboard. By correlating metabolic data with physical activity, Medilab provides a complete, engineering-grade picture of your wellbeing.

## 🚀 The Vision
Most health apps show data in silos. Medilab bridges the gap by overlaying:
- **Metabolic Fuel:** Real-time glucose levels (CGM).
- **Physical Output:** Heart rate zones, steps, and elevation.
- **Structural Composition:** Advanced body metrics (Visceral fat, Vascular age).

## 🛠 Supported Hardware & Integrations
- **CareSens Air (CGM):** Live via xDrip+ → Health Connect; historical via CSV import.
- **Withings Body Scan:** Advanced body composition and segmental analysis.
- **Withings ScanWatch 2:** 24/7 heart rate, SpO2, and activity tracking.
- **Health Connect:** Android platform API for CGM glucose reads (xDrip+ writer).

## 🏗 Technical Architecture
- **Frontend:** React Native (Expo) for cross-platform mobile access.
- **Backend:** AWS DynamoDB for secure, private time-series data storage.
- **Cloud:** AWS S3 for raw data dumps and long-term analysis.
- **Data Pipeline:** `CGM (xDrip+ → HC)` + `Withings Cloud` -> `Medilab App` -> `AWS DynamoDB`

## 📂 Project Structure
- `/app`: React Native Expo source code.
- `/services`: Connectors for Health Connect, Withings API, and AWS.
- `/logic`: Correlation algorithms (e.g., Glucose Spike vs. Activity Intensity).
- `/docs`: Architecture diagrams and research.

## 🚦 Getting Started for Cursor AI
1. **Initial Setup:** Run `npx create-expo-app app` to initialize the mobile client.
2. **Environment:** Create a `.env` file for AWS credentials (`AWS_ACCESS_KEY`, `AWS_SECRET_KEY`) and Withings API keys.
3. **Connectivity:** CGM via `HealthConnectService` (xDrip+ → Health Connect); body metrics via Withings API.

## 📝 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Built for self-engineering and metabolic optimization.*