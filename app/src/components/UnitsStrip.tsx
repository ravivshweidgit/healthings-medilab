/**
 * PROFILE & SETTINGS — units & measurements preferences.
 * Strip title is one word (UNITS / יחידות / …); no header subtitle or section title.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';
import type { UnitsPrefs } from '../services/UnitsPreferenceService';
import type { UserLanguage } from '../services/TargetService';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import { UnitsPreferenceSection } from './UnitsPreferenceSection';

type Props = {
  expanded: boolean;
  onToggleExpand: () => void;
  prefs: UnitsPrefs;
  onChange: (next: UnitsPrefs) => void;
  lang?: UserLanguage | null;
};

export function UnitsStrip({ expanded, onToggleExpand, prefs, onChange, lang }: Props) {
  const t = getProfileSettingsStripCopy(lang?.code);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';

  return (
    <View style={styles.wrap}>
      <DashboardCollapseHeader
        title={t.units}
        expanded={expanded}
        onToggle={onToggleExpand}
        titleRtl={rtl}
        collapseLabel={`Collapse ${t.units}`}
        expandLabel={`Expand ${t.units}`}
      />

      {expanded ? (
        <View style={styles.body}>
          <UnitsPreferenceSection
            prefs={prefs}
            langCode={lang?.code}
            hideHeader
            onChange={onChange}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  body: {
    marginTop: 8,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
});
