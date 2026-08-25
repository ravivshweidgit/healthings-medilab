import { useEffect, useState } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';

/**
 * First expand mounts the body; later collapses only hide it.
 * Avoids remounting native controls (Slider, Switch, TextInput) on every toggle.
 */
export function useKeepMountedExpand(expanded: boolean): boolean {
  const [mounted, setMounted] = useState(expanded);
  useEffect(() => {
    if (expanded) setMounted(true);
  }, [expanded]);
  return mounted;
}

/** Hide without display:'none' — keeps native children alive on Android. */
export const keepMountedCollapsedStyle: ViewStyle = {
  height: 0,
  overflow: 'hidden',
  opacity: 0,
};

export const keepMountedCollapsedStyles = StyleSheet.create({
  bodyCollapsed: keepMountedCollapsedStyle,
});
