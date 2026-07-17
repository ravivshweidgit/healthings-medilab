/**
 * On-screen error + stack for phone screenshots (JS render errors only).
 * Native iOS SIGABRT / TextInput crashes still kill the process — those never reach here.
 */
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WellnessColors } from '../theme/wellness';

type Props = {
  label?: string;
  children: ReactNode;
};

type State = {
  error: Error | null;
  componentStack: string | null;
};

export class DebugErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[DebugErrorBoundary] ${this.props.label ?? 'UI'}`, error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private reset = (): void => {
    this.setState({ error: null, componentStack: null });
  };

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    const label = this.props.label ?? 'UI';
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{label} — JS error</Text>
        <Text style={styles.hint}>
          Screenshot this. Native crashes (hard quit, no red box) will not appear here.
        </Text>
        <ScrollView style={styles.scroll} nestedScrollEnabled>
          <Text style={styles.msg} selectable>
            {error.name}: {error.message}
          </Text>
          {error.stack ? (
            <Text style={styles.stack} selectable>
              {error.stack}
            </Text>
          ) : null}
          {componentStack ? (
            <>
              <Text style={styles.sub}>Component stack</Text>
              <Text style={styles.stack} selectable>
                {componentStack}
              </Text>
            </>
          ) : null}
        </ScrollView>
        <Pressable style={styles.btn} onPress={this.reset} accessibilityRole="button">
          <Text style={styles.btnText}>Dismiss / retry</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C62828',
    backgroundColor: '#FFEBEE',
    maxHeight: 420,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#C62828',
    marginBottom: 4,
  },
  hint: {
    fontSize: 11,
    color: WellnessColors.textSecondary,
    marginBottom: 8,
    lineHeight: 15,
  },
  scroll: { flexGrow: 0 },
  msg: {
    fontSize: 13,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
    marginBottom: 8,
  },
  sub: {
    fontSize: 12,
    fontWeight: '700',
    color: WellnessColors.textSecondary,
    marginTop: 10,
    marginBottom: 4,
  },
  stack: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#4A148C',
    lineHeight: 15,
  },
  btn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#C62828',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
