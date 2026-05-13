import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { DashboardScreen } from './src/screens/DashboardScreen';

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  return (
    <>
      <DashboardScreen />
      <StatusBar style="dark" />
    </>
  );
}
