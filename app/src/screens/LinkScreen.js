const React = require('react');
const {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} = require('react-native');
const { LinearGradient } = require('expo-linear-gradient');
const GlassCard = require('../components/GlassCard');
const NavBar = require('../components/NavBar');
const BackgroundOrbs = require('../components/BackgroundOrbs');
const LogoBadge = require('../components/LogoBadge');
const { colors, gradients, spacing, radii, typography } = require('../theme');
const { supabase } = require('../lib/supabase');

const campusFilters = ['All', 'Seattle', 'Bothell', 'Tacoma'];
const genderFilters = ['All', 'Women', 'Men'];

function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PersonCard({ person }) {
  return (
    <GlassCard style={styles.personCard}>
      <View style={styles.personMain}>
        <View style={styles.avatar} />
        <View style={styles.personInfo}>
          <Text style={styles.personName}>{person.full_name || person.username}</Text>
          <Text style={styles.personMeta}>{person.major} � {person.year}</Text>
          <View style={styles.hobbiesRow}>
            {(person.hobbies || []).map((hobby) => (
              <View key={hobby} style={styles.hobbyPill}>
                <Text style={styles.hobbyText}>{hobby}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.igBadge}>
        <View style={styles.igLogo}>
          <Text style={styles.igLogoText}>IG</Text>
        </View>
        <Text style={styles.igHandle}>{person.ig_handle || `@${person.username}`}</Text>
      </View>
    </GlassCard>
  );
}

function LinkScreen({ current, onNavigate, onBack }) {
  const [campus, setCampus] = React.useState('All');
  const [gender, setGender] = React.useState('All');
  const [lastReload, setLastReload] = React.useState(null);
  const [isReloading, setIsReloading] = React.useState(false);
  const [people, setPeople] = React.useState([]);

  const fetchPeople = React.useCallback(async () => {
    setIsReloading(true);
    const { data, error } = await supabase.rpc('list_discoverable_profiles', {
      campus_filter: campus === 'All' ? null : campus,
      gender_filter: gender === 'All' ? null : gender,
    });

    if (!error) {
      setPeople(data || []);
    }
    setLastReload(new Date());
    setIsReloading(false);
  }, [campus, gender]);

  React.useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const timeLabel = lastReload
    ? `Updated ${lastReload.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : 'Free now';

  return (
    <LinearGradient colors={gradients.background} style={styles.container}>
      <BackgroundOrbs />
      <LogoBadge />
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Live link</Text>
          <Text style={styles.title}>Link</Text>
          <Text style={styles.subtitle}>{timeLabel}</Text>
        </View>
      </View>

      <GlassCard style={styles.filtersCard}>
        <Text style={styles.sectionTitle}>Campus</Text>
        <View style={styles.filtersRow}>
          {campusFilters.map((label) => (
            <FilterChip
              key={label}
              label={label}
              active={campus === label}
              onPress={() => setCampus(label)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Gender</Text>
        <View style={styles.filtersRow}>
          {genderFilters.map((label) => (
            <FilterChip
              key={label}
              label={label}
              active={gender === label}
              onPress={() => setGender(label)}
            />
          ))}
        </View>
      </GlassCard>

      <ScrollView
        contentContainerStyle={styles.peopleList}
        refreshControl={(
          <RefreshControl
            refreshing={isReloading}
            onRefresh={fetchPeople}
            tintColor={colors.textPrimary}
          />
        )}
      >
        {people.length ? (
          people.map((person) => <PersonCard key={person.id} person={person} />)
        ) : (
          <Text style={styles.emptyText}>No discoverable users yet.</Text>
        )}
      </ScrollView>

      <NavBar current={current} onNavigate={onNavigate} onBack={onBack} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 64,
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    color: colors.accentFree,
    fontSize: 12,
    fontFamily: typography.bodyMedium,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 34,
    fontFamily: typography.heading,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontFamily: typography.body,
  },
  filtersCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: typography.bodyMedium,
    marginBottom: spacing.xs,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  filterChipActive: {
    backgroundColor: 'rgba(124,246,231,0.2)',
    borderColor: colors.accentFree,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: typography.body,
  },
  filterTextActive: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemi,
  },
  peopleList: {
    paddingBottom: 120,
    gap: spacing.md,
  },
  personCard: {
    gap: spacing.sm,
  },
  personMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: typography.bodySemi,
  },
  personMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: typography.body,
  },
  hobbiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  hobbyPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hobbyText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontFamily: typography.bodyMedium,
  },
  igBadge: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginTop: -60,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    
  },
  igLogo: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  igLogoText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontFamily: typography.bodySemi,
  },
  igHandle: {
    color: colors.textPrimary,
    fontSize: 11,
    fontFamily: typography.bodySemi,
    marginTop: 4,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: typography.body,
  },
});

module.exports = LinkScreen;
