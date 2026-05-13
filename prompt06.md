"I have my Withings API credentials in the .env file. Let's build WithingsApiService.ts.

Auth Flow: Implement an OAuth2 exchange. We need a function to generate the authorization URL and another to handle the callback and get the access_token and refresh_token.

Data Fetching: Create a function fetchWeightMetrics() that calls the Withings measure endpoint.

Mapping: Ensure it maps the following types: Weight (1), Fat Mass (8), Muscle Mass (76), and Visceral Fat (88).

Storage: Save the tokens securely (using SecureStore or similar) so I don't have to log in every time.

Let's start with the Auth logic first."