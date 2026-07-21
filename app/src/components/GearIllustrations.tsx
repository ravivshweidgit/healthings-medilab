/**
 * Original gear illustrations for Quick Start (not Withings product photos).
 * Palette: glass white / silver chrome / graphite — matches premium device photos.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

const Soft = {
  glass: '#F4F2F0',
  stripe: '#DDD6D1',
  stripeAlt: '#E8E2DE',
  blush: '#EDE6E8',
  handle: '#FFFFFF',
  chrome: '#B8BEC6',
  chromeDark: '#7A828C',
  dial: '#1A1C1E',
  dialMark: '#E8EAED',
  strap: '#2A2D31',
  /** Quiet ScanWatch-style palette (light grey band + white face). */
  strapQuiet: '#C5CAD0',
  dialQuiet: '#FAFBFC',
  tickQuiet: '#A8B0B8',
  handQuiet: '#8B939C',
  glow: '#D4D8DC',
  card: '#FFFFFF',
  caption: '#5C6B7A',
  led: '#2A2D31',
  navy: '#1A2B4A',
  sky: '#3D9DD6',
  heart: '#C62828',
};

/**
 * Healthings mark — logo candidate (heart + ECG on glass tile).
 * Same visual language as device minis; readable at 44px.
 */
export function HealthingsMark({ size = 44 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      accessibilityLabel="Healthings"
    >
      <Defs>
        <LinearGradient id="hmTile" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#F3F5F7" />
        </LinearGradient>
        <LinearGradient id="hmHeart" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0%" stopColor="#E53935" />
          <Stop offset="100%" stopColor="#B71C1C" />
        </LinearGradient>
      </Defs>
      {/* App-tile frame — peers with Withings device chrome */}
      <Rect
        x="4"
        y="4"
        width="72"
        height="72"
        rx="18"
        fill="url(#hmTile)"
        stroke={Soft.chrome}
        strokeWidth="1.6"
      />
      <Rect
        x="8"
        y="8"
        width="64"
        height="64"
        rx="15"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.2"
        opacity={0.85}
      />
      {/* Geometric heart */}
      <Path
        d="M40 62 C40 62 16 46 16 32 C16 24.5 21.5 19 28.5 19 C33.2 19 37.2 21.6 40 25.5 C42.8 21.6 46.8 19 51.5 19 C58.5 19 64 24.5 64 32 C64 46 40 62 40 62 Z"
        fill="url(#hmHeart)"
      />
      {/* ECG pulse — brand teal (matches wordmark) */}
      <Path
        d="M14 40 H26 L30 28 L35 52 L40 34 L44 40 H66"
        stroke="#00A8C0"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M14 40 H26 L30 28 L35 52 L40 34 L44 40 H66"
        stroke="#FFFFFF"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.45}
      />
    </Svg>
  );
}

/**
 * Full HEALTHINGS.AI wordmark — brand lockup artwork
 * (navy HEALTHINGS.AI, teal ECG only, red heart, tagline).
 */
const healthingsWordmarkArt = require('../../assets/branding/healthings_wordmark.png');

export function HealthingsWordmarkIllustration({ width = 280 }: { width?: number }) {
  const height = width * (297 / 1032);
  return (
    <Image
      source={healthingsWordmarkArt}
      style={{ width, height, maxWidth: '100%' }}
      resizeMode="contain"
      accessibilityLabel="HEALTHINGS.AI — Personalized metabolic OS with your licensed nutritionist"
      accessibilityIgnoresInvertColors
    />
  );
}

/** Official Health Connect product icon (Android Developers asset pack). */
const healthConnectLogo = require('../../assets/branding/health_connect_logo.png');

/** Body-composition scale — top-down: glass deck, grip stripes, white handle bar. */
export function BodyScaleIllustration({ size = 160 }: { size?: number }) {
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] });

  return (
    <Animated.View style={{ transform: [{ scale }], width: size, height: size * 1.05, alignItems: 'center' }}>
      <Svg width={size} height={size * 1.05} viewBox="0 0 220 230">
          <Defs>
            <LinearGradient id="deckGlass" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#FAF8F6" />
              <Stop offset="40%" stopColor={Soft.glass} />
              <Stop offset="100%" stopColor={Soft.blush} />
            </LinearGradient>
            <LinearGradient id="handleBar" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#FFFFFF" />
              <Stop offset="100%" stopColor="#F0F0F2" />
            </LinearGradient>
            <LinearGradient id="metalEdge" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={Soft.chromeDark} />
              <Stop offset="50%" stopColor={Soft.chrome} />
              <Stop offset="100%" stopColor={Soft.chromeDark} />
            </LinearGradient>
          </Defs>

          {/* Soft product-photo ground shadow */}
          <Ellipse cx="110" cy="218" rx="70" ry="9" fill={Soft.glow} opacity={0.7} />

          {/* Platform (deck) — rounded rectangle like Body Scan */}
          <Rect
            x="42"
            y="58"
            width="136"
            height="148"
            rx="16"
            fill="url(#deckGlass)"
            stroke={Soft.chrome}
            strokeWidth="2"
          />
          {/* Inner bevel */}
          <Rect
            x="48"
            y="64"
            width="124"
            height="136"
            rx="12"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            opacity={0.7}
          />

          {/* Footprint grip stripes (left / right panels) */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <G key={`L${i}`}>
              <Rect
                x="54"
                y={74 + i * 13}
                width="48"
                height="8"
                rx="2"
                fill={i % 2 === 0 ? Soft.stripe : Soft.stripeAlt}
                opacity={0.95}
              />
              <Rect
                x="118"
                y={74 + i * 13}
                width="48"
                height="8"
                rx="2"
                fill={i % 2 === 0 ? Soft.stripe : Soft.stripeAlt}
                opacity={0.95}
              />
            </G>
          ))}

          {/* Center divider (electrode seam) */}
          <Rect x="107" y="72" width="6" height="120" rx="2" fill={Soft.chrome} opacity={0.35} />

          {/* Small weight display window near top of deck */}
          <Rect x="86" y="68" width="48" height="16" rx="4" fill={Soft.led} />
          <Rect x="92" y="73" width="22" height="6" rx="1.5" fill="#8B939C" opacity={0.9} />
          <Circle cx="122" cy="76" r="2.5" fill="#94A3B8" opacity={0.9} />

          {/* Stem connecting handle to deck */}
          <Rect x="102" y="48" width="16" height="14" rx="3" fill={Soft.chrome} opacity={0.55} />

          {/* White handle bar (Body Scan–style) */}
          <Rect
            x="48"
            y="22"
            width="124"
            height="28"
            rx="14"
            fill="url(#handleBar)"
            stroke={Soft.chrome}
            strokeWidth="1.5"
          />
          {/* Grip pads on handle */}
          <Rect x="62" y="30" width="28" height="12" rx="6" fill={Soft.chrome} opacity={0.4} />
          <Rect x="130" y="30" width="28" height="12" rx="6" fill={Soft.chrome} opacity={0.4} />
          {/* Tiny metal end caps */}
          <Ellipse cx="50" cy="36" rx="4" ry="10" fill="url(#metalEdge)" opacity={0.5} />
          <Ellipse cx="170" cy="36" rx="4" ry="10" fill="url(#metalEdge)" opacity={0.5} />
        </Svg>
    </Animated.View>
  );
}

/** Hybrid smartwatch — quiet light face (default) or black dial backup. No brand marks. */
export function HybridWatchIllustration({
  size = 160,
  variant = 'light',
}: {
  size?: number;
  /** `light` = dove-grey strap + white dial (quiet). `dark` = graphite backup. */
  variant?: 'light' | 'dark';
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const windowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });
  const light = variant === 'light';
  const strap = light ? Soft.strapQuiet : Soft.strap;
  const dial = light ? Soft.dialQuiet : Soft.dial;
  const ticks = light ? Soft.tickQuiet : Soft.dialMark;
  const hands = light ? Soft.handQuiet : Soft.dialMark;
  const subFill = light ? '#F4F5F6' : '#121416';
  const subStroke = light ? Soft.chrome : Soft.chromeDark;
  const hole = light ? '#9AA3AD' : '#1A1C1E';
  const uid = light ? 'L' : 'D';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <LinearGradient id={`caseMetal${uid}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#F5F6F8" />
            <Stop offset="45%" stopColor="#C8CDD4" />
            <Stop offset="100%" stopColor="#8E959E" />
          </LinearGradient>
        </Defs>
        <Ellipse cx="100" cy="188" rx="36" ry="6" fill={Soft.glow} opacity={0.5} />
        {/* Strap */}
        <Rect x="74" y="4" width="52" height="42" rx="12" fill={strap} />
        <Rect x="74" y="154" width="52" height="42" rx="12" fill={strap} />
        <Circle cx="100" cy="20" r="2.2" fill={hole} />
        <Circle cx="100" cy="28" r="2.2" fill={hole} />
        <Circle cx="100" cy="168" r="2.2" fill={hole} />
        <Circle cx="100" cy="176" r="2.2" fill={hole} />
        {/* Case + dial */}
        <Circle cx="100" cy="100" r="54" fill={`url(#caseMetal${uid})`} />
        <Circle cx="100" cy="100" r="46" fill={dial} />
        {/* Hour ticks — thin batons */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const inner = deg % 90 === 0 ? 37 : 39;
          const x1 = 100 + Math.cos(rad) * inner;
          const y1 = 100 + Math.sin(rad) * inner;
          const x2 = 100 + Math.cos(rad) * 42.5;
          const y2 = 100 + Math.sin(rad) * 42.5;
          return (
            <Path
              key={deg}
              d={`M ${x1} ${y1} L ${x2} ${y2}`}
              stroke={ticks}
              strokeWidth={deg % 90 === 0 ? 2.2 : 1.15}
              strokeLinecap="round"
              opacity={0.85}
            />
          );
        })}
        {/* Circular OLED at 12 */}
        <Circle cx="100" cy="72" r="13" fill="#0A0B0C" />
        <Circle cx="100" cy="72" r="13" stroke="#2A2E33" strokeWidth="1" fill="none" />
        {/* Activity subdial at 6 */}
        <Circle cx="100" cy="132" r="12" fill={subFill} stroke={subStroke} strokeWidth="1" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = ((deg - 90) * Math.PI) / 180;
          const x1 = 100 + Math.cos(rad) * 7;
          const y1 = 132 + Math.sin(rad) * 7;
          const x2 = 100 + Math.cos(rad) * 9.5;
          const y2 = 132 + Math.sin(rad) * 9.5;
          return (
            <Path
              key={`s${deg}`}
              d={`M ${x1} ${y1} L ${x2} ${y2}`}
              stroke={ticks}
              strokeWidth="0.8"
              strokeLinecap="round"
              opacity={0.55}
            />
          );
        })}
        <Path d="M100 132 L100 123" stroke={hands} strokeWidth="1.4" strokeLinecap="round" />
        {/* Hands */}
        <Path d="M100 100 L100 78" stroke={hands} strokeWidth="2.4" strokeLinecap="round" />
        <Path d="M100 100 L122 112" stroke={hands} strokeWidth="1.8" strokeLinecap="round" />
        <Circle cx="100" cy="100" r="3" fill={hands} />
        {/* Crown */}
        <Rect x="152" y="90" width="10" height="20" rx="3" fill={`url(#caseMetal${uid})`} />
        <Rect x="154" y="94" width="6" height="12" rx="2" fill={Soft.chromeDark} opacity={0.35} />
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.oledGlow,
          {
            opacity: windowOpacity,
            top: size * 0.3,
            left: size * 0.5 - size * 0.045,
            width: size * 0.09,
            height: size * 0.09,
            borderRadius: size * 0.045,
          },
        ]}
      />
    </View>
  );
}

/** CGM — red blood drop + green trend + bold grey label (reads instantly). */
export function CgmIllustration({ size = 160 }: { size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const chartOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });

  return (
    <View style={{ width: size, height: size * 1.05, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
        <Svg width={size * 0.72} height={size * 0.72} viewBox="0 0 120 140">
          <Defs>
            <LinearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#E85A5A" />
              <Stop offset="55%" stopColor="#C62828" />
              <Stop offset="100%" stopColor="#8E1B1B" />
            </LinearGradient>
          </Defs>
          {/* Soft ground shadow */}
          <Ellipse cx="60" cy="132" rx="28" ry="6" fill={Soft.glow} opacity={0.55} />
          {/* Blood drop */}
          <Path
            d="M60 8 C60 8 22 58 22 82 C22 104 38 122 60 122 C82 122 98 104 98 82 C98 58 60 8 60 8 Z"
            fill="url(#dropGrad)"
          />
          {/* Highlight on drop */}
          <Path
            d="M42 55 C38 68 40 88 52 98"
            stroke="#FFFFFF"
            strokeWidth="5"
            strokeLinecap="round"
            opacity={0.28}
            fill="none"
          />
          {/* Mini chart card on drop */}
          <Rect x="34" y="58" width="52" height="40" rx="8" fill="#FFFFFF" opacity={0.95} />
          {/* Green glucose sparkline */}
          <Path
            d="M42 88 L50 78 L58 82 L68 68 L78 74"
            stroke="#2E7D5A"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Circle cx="78" cy="74" r="3.5" fill="#2E7D5A" />
          {/* Baseline ticks */}
          <Path d="M42 92 H78" stroke="#D4D8DC" strokeWidth="1.5" strokeLinecap="round" />
        </Svg>
        <Animated.Text style={[styles.cgmLabel, { opacity: chartOp }]}>CGM</Animated.Text>
      </Animated.View>
    </View>
  );
}

type GearKind = 'scale' | 'watch' | 'cgm' | 'link' | 'phone' | 'meals';

const CAPTIONS: Record<GearKind, string> = {
  scale: 'Example — any Withings scale on your account',
  watch: 'Example — any Withings watch or band on your account',
  cgm: 'Glucose from your phone health app',
  link: 'One link: Healthings ↔ your Withings account (scale & watch)',
  phone:
    Platform.OS === 'ios'
      ? 'Steps and heart rate from Apple Health'
      : 'Steps and heart rate via Health Connect',
  meals: 'Photo, text, or coach — then save in the food log',
};

/** Premium device card — neutral silver/graphite, not brand green. */
export function GearHeroCard({ kind, caption }: { kind: GearKind; caption?: string }) {
  const label = caption ?? CAPTIONS[kind];
  return (
    <View style={styles.card} accessibilityRole="image" accessibilityLabel={label}>
      <View style={[styles.stage, kind === 'meals' && styles.stageMeals]}>
        {kind === 'scale' ? <BodyScaleIllustration size={168} /> : null}
        {kind === 'watch' ? <HybridWatchIllustration size={168} /> : null}
        {kind === 'cgm' ? <CgmIllustration size={168} /> : null}
        {kind === 'meals' ? <MealsIllustration size={268} /> : null}
        {kind === 'link' ? <WithingsLinkIllustration size={168} /> : null}
        {kind === 'phone' ? <PhoneHealthBrandMark /> : null}
      </View>
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

/**
 * Link step — one OAuth link: Healthings ↔ Withings account.
 * Scale + watch nest inside the Withings frame (account owns the devices).
 */
export function WithingsLinkIllustration({ size = 160 }: { size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  /** Opacity only — scale pulse was clipping the hubs past the stage edge. */
  const linkOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });

  return (
    <View style={styles.linkStageInner}>
      <View style={styles.linkRow}>
        <View style={styles.healthingsHub} accessibilityLabel="Healthings">
          <Text style={styles.frameTitle} numberOfLines={1}>
            Healthings
          </Text>
          <View style={styles.peerContent}>
            <HealthingsMark size={44} />
          </View>
        </View>

        <Animated.View style={[styles.singleLinkWrap, { opacity: linkOp }]}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <G stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </G>
          </Svg>
        </Animated.View>

        <View style={styles.withingsFrame} accessibilityLabel="Withings account — scale and watch">
          <Text style={styles.frameTitle} numberOfLines={1}>
            Withings
          </Text>
          <View style={styles.peerContent}>
            <View style={styles.withingsDevices}>
              <Svg width={44} height={44} viewBox="0 0 80 80">
                <Defs>
                  <LinearGradient id="linkDeck" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#FAF8F6" />
                    <Stop offset="55%" stopColor="#F0EBE8" />
                    <Stop offset="100%" stopColor="#E5DDE0" />
                  </LinearGradient>
                </Defs>
                <Rect x="18" y="4" width="44" height="10" rx="5" fill="#FFFFFF" stroke={Soft.chrome} strokeWidth="1.4" />
                <Rect x="10" y="18" width="60" height="56" rx="10" fill="url(#linkDeck)" stroke={Soft.chrome} strokeWidth="1.6" />
                <Rect x="16" y="24" width="48" height="44" rx="7" fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity={0.75} />
                <Rect x="20" y="30" width="18" height="4" rx="1.5" fill={Soft.stripe} />
                <Rect x="42" y="30" width="18" height="4" rx="1.5" fill={Soft.stripe} />
                <Rect x="20" y="38" width="18" height="4" rx="1.5" fill={Soft.stripeAlt} />
                <Rect x="42" y="38" width="18" height="4" rx="1.5" fill={Soft.stripeAlt} />
                <Rect x="20" y="46" width="18" height="4" rx="1.5" fill={Soft.stripe} />
                <Rect x="42" y="46" width="18" height="4" rx="1.5" fill={Soft.stripe} />
                <Rect x="32" y="26" width="16" height="5" rx="2" fill={Soft.led} />
              </Svg>
              <Svg width={44} height={44} viewBox="0 0 80 80">
                <Defs>
                  <LinearGradient id="linkCase" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0%" stopColor="#F5F6F8" />
                    <Stop offset="100%" stopColor="#9AA1AA" />
                  </LinearGradient>
                </Defs>
                <Rect x="30" y="2" width="20" height="12" rx="4" fill={Soft.strapQuiet} />
                <Rect x="30" y="66" width="20" height="12" rx="4" fill={Soft.strapQuiet} />
                <Circle cx="40" cy="40" r="24" fill="url(#linkCase)" />
                <Circle cx="40" cy="40" r="18" fill={Soft.dialQuiet} />
                <Circle cx="40" cy="28" r="4.5" fill="#0A0B0C" />
                <Circle cx="40" cy="52" r="4" fill="#F4F5F6" stroke={Soft.chrome} strokeWidth="0.8" />
                <Path d="M40 40 L40 30" stroke={Soft.handQuiet} strokeWidth="1.8" strokeLinecap="round" />
                <Path d="M40 40 L48 45" stroke={Soft.handQuiet} strokeWidth="1.4" strokeLinecap="round" />
              </Svg>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Dashboard body-card mark — scale and/or watch from user setup (not the Withings logo JPEG).
 * Both → paired devices; one → that device only. Always labeled Withings.
 */
export function WithingsDevicesMark({
  showScale,
  showWatch,
}: {
  showScale: boolean;
  showWatch: boolean;
}) {
  const scale = showScale;
  const watch = showWatch;
  if (!scale && !watch) return null;

  const a11y =
    scale && watch
      ? 'Withings — scale and watch'
      : scale
        ? 'Withings — scale'
        : 'Withings — watch';

  return (
    <View style={[styles.devicesMark, styles.devicesMarkWithings]} accessibilityLabel={a11y}>
      <Text style={styles.devicesMarkTitle} numberOfLines={1}>
        Withings
      </Text>
      <View style={styles.devicesMarkBody}>
        <View style={styles.devicesMarkRow}>
          {scale ? (
            <Svg width={28} height={28} viewBox="0 0 80 80">
              <Defs>
                <LinearGradient id="dashDeck" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#FAF8F6" />
                  <Stop offset="100%" stopColor="#E5DDE0" />
                </LinearGradient>
              </Defs>
              <Rect x="18" y="4" width="44" height="10" rx="5" fill="#FFFFFF" stroke={Soft.chrome} strokeWidth="1.4" />
              <Rect x="10" y="18" width="60" height="56" rx="10" fill="url(#dashDeck)" stroke={Soft.chrome} strokeWidth="1.6" />
              <Rect x="20" y="30" width="18" height="4" rx="1.5" fill={Soft.stripe} />
              <Rect x="42" y="30" width="18" height="4" rx="1.5" fill={Soft.stripe} />
              <Rect x="20" y="38" width="18" height="4" rx="1.5" fill={Soft.stripeAlt} />
              <Rect x="42" y="38" width="18" height="4" rx="1.5" fill={Soft.stripeAlt} />
              <Rect x="32" y="26" width="16" height="5" rx="2" fill={Soft.led} />
            </Svg>
          ) : null}
          {watch ? (
            <Svg width={28} height={28} viewBox="0 0 80 80">
              <Defs>
                <LinearGradient id="dashCase" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#F5F6F8" />
                  <Stop offset="100%" stopColor="#9AA1AA" />
                </LinearGradient>
              </Defs>
              <Rect x="30" y="2" width="20" height="12" rx="4" fill={Soft.strapQuiet} />
              <Rect x="30" y="66" width="20" height="12" rx="4" fill={Soft.strapQuiet} />
              <Circle cx="40" cy="40" r="24" fill="url(#dashCase)" />
              <Circle cx="40" cy="40" r="18" fill={Soft.dialQuiet} />
              <Circle cx="40" cy="28" r="4.5" fill="#0A0B0C" />
              <Path d="M40 40 L40 30" stroke={Soft.handQuiet} strokeWidth="1.8" strokeLinecap="round" />
              <Path d="M40 40 L48 45" stroke={Soft.handQuiet} strokeWidth="1.4" strokeLinecap="round" />
            </Svg>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Dashboard body-card CGM mark — compact drop + label (only when CGM is on).
 * Static (no pulse) so the header stays calm next to Withings devices.
 */
export function CgmDevicesMark() {
  return (
    <View style={styles.devicesMark} accessibilityLabel="CGM — glucose from phone health">
      <Text style={styles.devicesMarkTitle} numberOfLines={1}>
        CGM
      </Text>
      <View style={styles.devicesMarkBody}>
        <View style={styles.devicesMarkRow}>
          <Svg width={28} height={28} viewBox="0 0 120 140">
            <Defs>
              <LinearGradient id="dashCgmDrop" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#E85A5A" />
                <Stop offset="55%" stopColor="#C62828" />
                <Stop offset="100%" stopColor="#8E1B1B" />
              </LinearGradient>
            </Defs>
            <Path
              d="M60 8 C60 8 22 58 22 82 C22 104 38 122 60 122 C82 122 98 104 98 82 C98 58 60 8 60 8 Z"
              fill="url(#dashCgmDrop)"
            />
            <Rect x="34" y="58" width="52" height="40" rx="8" fill="#FFFFFF" opacity={0.95} />
            <Path
              d="M42 88 L50 78 L58 82 L68 68 L78 74"
              stroke="#2E7D5A"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Circle cx="78" cy="74" r="3.5" fill="#2E7D5A" />
          </Svg>
        </View>
      </View>
    </View>
  );
}

/**
 * Meal logging hero — polished place-setting artwork.
 */
const mealsPlateArt = require('../../assets/meals-plate.png');

export function MealsIllustration({ size = 160 }: { size?: number }) {
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] });
  /** Artwork is landscape (~1024×737) — match aspect so contain doesn't letterbox. */
  const height = size * (737 / 1024);

  return (
    <Animated.View style={{ transform: [{ scale }], alignItems: 'center', width: '100%' }}>
      <Image
        source={mealsPlateArt}
        style={{ width: size, height, maxWidth: '100%' }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

/** Official HC mark on Android; neutral phone glyph on iOS (Apple Health has separate brand rules). */
function PhoneHealthBrandMark() {
  if (Platform.OS === 'android') {
    return (
      <View style={styles.hcBadge}>
        <Image
          source={healthConnectLogo}
          style={styles.hcLogo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }
  return <NeutralIconBadge kind="phone" />;
}

function NeutralIconBadge({ kind }: { kind: 'phone' }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  return (
    <Animated.View style={[styles.badge, { opacity }]}>
      <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
        {kind === 'phone' ? (
          <G stroke={Soft.chromeDark} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <Rect x="7" y="2" width="10" height="20" rx="2" />
            <Path d="M11 18h2" />
          </G>
        ) : null}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    marginBottom: 18,
    paddingTop: 8,
    paddingBottom: 4,
  },
  stage: {
    width: '100%',
    maxWidth: 280,
    minHeight: 188,
    borderRadius: 20,
    backgroundColor: Soft.card,
    borderWidth: 1,
    borderColor: Soft.glow,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: 'hidden',
    shadowColor: '#1A2B3C',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  stageMeals: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: 200,
  },
  linkStageInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: Soft.caption,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  cgmLabel: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: '#6B7280',
    textAlign: 'center',
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Soft.glass,
    borderWidth: 1,
    borderColor: Soft.chrome,
  },
  linkBadge: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(26, 43, 74, 0.22)',
    shadowColor: '#1A2B3C',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexShrink: 1,
  },
  singleLinkWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3D9DD6',
    borderWidth: 0,
    shadowColor: '#3D9DD6',
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  /** Shared title style — both hubs read as peer account cards. */
  frameTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#1A2B4A',
    marginBottom: 6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  healthingsHub: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.75,
    borderColor: 'rgba(26, 43, 74, 0.22)',
    shadowColor: '#1A2B3C',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minHeight: 86,
  },
  peerContent: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  withingsFrame: {
    flexShrink: 1,
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.75,
    borderColor: 'rgba(26, 43, 74, 0.22)',
    alignItems: 'center',
    shadowColor: '#1A2B3C',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minHeight: 86,
  },
  withingsDevices: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 44,
  },
  /**
   * Column width = max(title, icons). Withings keeps minWidth so a single
   * scale/watch never lets "WITHINGS" overflow into CGM.
   */
  devicesMark: {
    alignItems: 'center',
    overflow: 'visible',
  },
  devicesMarkWithings: {
    minWidth: 56,
  },
  devicesMarkTitle: {
    height: 12,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#1A2B4A',
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 10,
    includeFontPadding: false,
  },
  devicesMarkBody: {
    marginTop: 2,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  devicesMarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  /** Guidelines: HC product icon on white / very light gray. */
  hcBadge: {
    width: 112,
    height: 112,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Soft.glow,
  },
  hcLogo: {
    width: 72,
    height: 72,
  },
  oledGlow: {
    position: 'absolute',
    backgroundColor: '#1E3A5F',
  },
});
