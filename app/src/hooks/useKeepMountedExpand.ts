import { useEffect, useState } from 'react';
import { InteractionManager, StyleSheet, type ViewStyle } from 'react-native';

/**
 * First expand mounts the body; later collapses only hide it.
 * Also pre-warms in the background after idle delay so the first tap does not suffer
 * the initial native element instantiation penalty.
 */
export function useKeepMountedExpand(expanded: boolean, preWarmDelayMs = 1000): boolean {
  const [mounted, setMounted] = useState(expanded);

  useEffect(() => {
    if (expanded) {
      setMounted(true);
      return;
    }
    if (!mounted) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const handle = InteractionManager.runAfterInteractions(() => {
        timer = setTimeout(() => {
          setMounted(true);
        }, preWarmDelayMs);
      });
      return () => {
        handle.cancel();
        if (timer) clearTimeout(timer);
      };
    }
  }, [expanded, mounted, preWarmDelayMs]);

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
