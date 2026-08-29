/**
 * Bindings between `dashExpandStore` and the dashboard JSX.
 *
 * Each of these subscribes to exactly one expand key, so a header tap re-renders the
 * wrapper and its own strip instead of the whole DashboardScreen tree.
 *
 * Which one to use:
 *  - `DashCollapseHeader` — a strip header whose open/closed state lives in the store.
 *  - `DashCollapseView`   — a card shell or body that only changes *style* when collapsed.
 *                           Children stay mounted, so pass them as elements: React bails
 *                           out of re-rendering a subtree whose element identity is unchanged.
 *  - `DashExpandGate`     — a body that should unmount when collapsed. Takes a render
 *                           function so the subtree is not built while closed.
 *  - `DashExpandEffect`   — run a side effect when a key flips, without the screen
 *                           subscribing to it.
 *  - `withDashExpand`     — wrap a leaf strip that takes `expanded` + `onToggleExpand`.
 */

import React, { memo, useEffect, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import {
  DashboardCollapseHeader,
  type DashboardCollapseHeaderProps,
} from './DashboardCollapseHeader';
import {
  dashToggler,
  useDashExpanded,
  type DashExpandKey,
} from '../hooks/dashExpandStore';
import {
  keepMountedCollapsedStyles,
  useKeepMountedExpand,
} from '../hooks/useKeepMountedExpand';

type BoundHeaderProps = Omit<DashboardCollapseHeaderProps, 'expanded' | 'onToggle'> & {
  k: DashExpandKey;
  /** Overrides the default toggle — for headers that must prep state before opening. */
  onToggle?: () => void;
};

export function DashCollapseHeader({ k, onToggle, ...rest }: BoundHeaderProps) {
  const expanded = useDashExpanded(k);
  return (
    <DashboardCollapseHeader
      {...rest}
      expanded={expanded}
      onToggle={onToggle ?? dashToggler(k)}
    />
  );
}

type CollapseViewProps = {
  k: DashExpandKey;
  style?: StyleProp<ViewStyle>;
  /** Merged on top of `style` while collapsed. */
  collapsedStyle?: StyleProp<ViewStyle>;
  /**
   * Block touches and hide from the screen reader while collapsed. Use on body
   * wrappers; leave off card shells, whose header must stay tappable.
   */
  hideContent?: boolean;
  children?: React.ReactNode;
};

export function DashCollapseView({
  k,
  style,
  collapsedStyle,
  hideContent,
  children,
}: CollapseViewProps) {
  const expanded = useDashExpanded(k);
  const mergedStyle = useMemo(
    () => (expanded || collapsedStyle == null ? style : [style, collapsedStyle]),
    [expanded, style, collapsedStyle],
  );

  if (!hideContent) {
    return <View style={mergedStyle}>{children}</View>;
  }

  return (
    <View
      style={mergedStyle}
      pointerEvents={expanded ? 'auto' : 'none'}
      accessibilityElementsHidden={!expanded}
      importantForAccessibility={expanded ? 'yes' : 'no-hide-descendants'}
    >
      {children}
    </View>
  );
}

export function DashExpandGate({
  k,
  children,
}: {
  k: DashExpandKey;
  children: () => React.ReactNode;
}) {
  const expanded = useDashExpanded(k);
  return <>{expanded ? children() : null}</>;
}

export function DashKeepMountedGate({
  k,
  children,
}: {
  k: DashExpandKey;
  children: () => React.ReactNode;
}) {
  const expanded = useDashExpanded(k);
  const mounted = useKeepMountedExpand(expanded);
  if (!mounted) return null;
  return (
    <View
      style={!expanded ? keepMountedCollapsedStyles.bodyCollapsed : undefined}
      pointerEvents={expanded ? 'auto' : 'none'}
      accessibilityElementsHidden={!expanded}
      importantForAccessibility={expanded ? 'yes' : 'no-hide-descendants'}
    >
      {children()}
    </View>
  );
}

export function DashExpandEffect({
  k,
  onChange,
}: {
  k: DashExpandKey;
  onChange: (expanded: boolean) => void;
}) {
  const expanded = useDashExpanded(k);
  useEffect(() => {
    onChange(expanded);
    // Re-running on a fresh `onChange` identity would fire the effect on every parent
    // render; the callback only ever needs the latest flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);
  return null;
}

type Expandable = { expanded: boolean; onToggleExpand: () => void };

export function withDashExpand<P extends Expandable>(
  Component: React.ComponentType<P>,
  k: DashExpandKey,
): React.ComponentType<Omit<P, keyof Expandable>> {
  // `expanded` comes from the store and `onToggleExpand` is the cached per-key toggle, so
  // this only re-renders the strip when one of the screen's own props actually changed.
  const Memoized = memo(Component) as React.ComponentType<P>;
  function Bound(props: Omit<P, keyof Expandable>) {
    const expanded = useDashExpanded(k);
    return <Memoized {...(props as P)} expanded={expanded} onToggleExpand={dashToggler(k)} />;
  }
  Bound.displayName = `DashExpand(${k})`;
  return Bound;
}
