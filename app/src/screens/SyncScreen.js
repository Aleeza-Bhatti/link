const React = require('react');
const { View, Text, StyleSheet, ScrollView, TouchableOpacity } = require('react-native');
const { LinearGradient } = require('expo-linear-gradient');
const GlassCard = require('../components/GlassCard');
const NavBar = require('../components/NavBar');
const BackgroundOrbs = require('../components/BackgroundOrbs');
const LogoBadge = require('../components/LogoBadge');
const { colors, gradients, spacing, radii, typography } = require('../theme');

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const hours = [8, 10, 12, 14, 16, 18];

const sampleFriends = [
  { id: 'you', name: 'You', color: colors.accentFree },
  { id: 'maya', name: 'Maya', color: '#FFD66B' },
  { id: 'noah', name: 'Noah', color: '#8DE1FF' },
  { id: 'june', name: 'June', color: '#FFB7E3' },
  { id: 'liam', name: 'Liam', color: '#B6FFB0' },
];

const sampleBlocks = [
  { id: 'c1', day: 0, start: 9, end: 10.5, owner: 'you' },
  { id: 'c2', day: 0, start: 13, end: 14.5, owner: 'maya' },
  { id: 'c3', day: 1, start: 11, end: 12.5, owner: 'noah' },
  { id: 'c4', day: 2, start: 10, end: 11, owner: 'you' },
  { id: 'c5', day: 3, start: 14, end: 16, owner: 'june' },
  { id: 'c6', day: 4, start: 9.5, end: 11, owner: 'maya' },
  { id: 'c7', day: 4, start: 12, end: 13, owner: 'you' },
  { id: 'c8', day: 2, start: 12, end: 13.5, owner: 'liam' },
  { id: 'c9', day: 1, start: 9, end: 10, owner: 'june' },
];

function buildOverlapBlocks(blocks, selectedIds) {
  const selected = blocks.filter((block) => selectedIds.includes(block.owner));
  const overlaps = [];

  for (let i = 0; i < selected.length; i += 1) {
    for (let j = i + 1; j < selected.length; j += 1) {
      const a = selected[i];
      const b = selected[j];
      if (a.day !== b.day) continue;
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);
      if (end > start) {
        overlaps.push({
          id: `${a.id}-${b.id}`,
          day: a.day,
          start,
          end,
        });
      }
    }
  }

  return overlaps;
}

function SyncScreen({ current, onNavigate, onBack }) {
  const allIds = sampleFriends.map((friend) => friend.id);
  const [selected, setSelected] = React.useState(allIds);

  const allSelected = selected.length === allIds.length;

  const toggleFriend = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((item) => item !== id);
        return next.length ? next : ['you'];
      }
      return [...prev, id];
    });
  };

  const setAll = () => {
    setSelected(allSelected ? ['you'] : allIds);
  };

  const isSelected = (id) => selected.includes(id);
  const overlapBlocks = buildOverlapBlocks(sampleBlocks, selected);

  return (
    <LinearGradient colors={gradients.background} style={styles.container}>
      <BackgroundOrbs />
      <LogoBadge />
      <View style={styles.header}>
        <Text style={styles.kicker}>Overlap view</Text>
        <Text style={styles.title}>Sync</Text>
        <Text style={styles.subtitle}>Tap friends to highlight overlaps.</Text>
      </View>

      <GlassCard style={styles.card}>
        <View style={styles.chipsRow}>
          <TouchableOpacity onPress={setAll} style={[styles.chip, styles.chipAll, allSelected && styles.chipActive]}>
            <Text style={[styles.chipText, allSelected && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {sampleFriends.map((friend) => (
            <TouchableOpacity
              key={friend.id}
              onPress={() => toggleFriend(friend.id)}
              style={[styles.chip, { borderColor: friend.color }, isSelected(friend.id) && styles.chipActive]}
            >
              <View style={[styles.chipDot, { backgroundColor: friend.color }]} />
              <Text style={[styles.chipText, isSelected(friend.id) && styles.chipTextActive]}>{friend.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.gridWrap}>
            <View style={styles.gridHeader}>
              <View style={styles.timeSpacer} />
              {days.map((day) => (
                <Text key={day} style={styles.gridDay}>{day}</Text>
              ))}
            </View>

            <View style={styles.gridBody}>
              <View style={styles.timeColumn}>
                {hours.map((hour) => (
                  <Text key={hour} style={styles.timeLabel}>{hour}:00</Text>
                ))}
              </View>

              {days.map((_, dayIndex) => (
                <View key={`col-${dayIndex}`} style={styles.dayColumn}>
                  <View style={styles.dayColumnInner}>
                    {overlapBlocks
                      .filter((block) => block.day === dayIndex)
                      .map((block) => {
                        const height = (block.end - block.start) * 26;
                        const top = (block.start - 8) * 26;
                        return (
                          <View
                            key={block.id}
                            style={[
                              styles.overlapBlock,
                              {
                                top,
                                height,
                              },
                            ]}
                          />
                        );
                      })}
                    {sampleBlocks
                      .filter((block) => block.day === dayIndex)
                      .map((block) => {
                        const height = (block.end - block.start) * 26;
                        const top = (block.start - 8) * 26;
                        const owner = sampleFriends.find((friend) => friend.id === block.owner);
                        const highlight = isSelected(block.owner);
                        return (
                          <View
                            key={block.id}
                            style={[
                              styles.block,
                              {
                                top,
                                height,
                                backgroundColor: owner ? owner.color : colors.accentBusy,
                                opacity: highlight ? 0.98 : 0.2,
                                shadowOpacity: highlight ? 0.55 : 0,
                              },
                            ]}
                          />
                        );
                      })}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </GlassCard>

      <NavBar current={current} onNavigate={onNavigate} onBack={onBack} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 72,
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
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
  card: {
    padding: spacing.lg,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipAll: {
    borderColor: colors.glassBorder,
  },
  chipActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: typography.bodyMedium,
  },
  chipTextActive: {
    color: colors.textPrimary,
  },
  gridWrap: {
    minWidth: 580,
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  timeSpacer: {
    width: 54,
  },
  gridDay: {
    color: colors.textSecondary,
    width: 96,
    textAlign: 'center',
    fontFamily: typography.bodyMedium,
  },
  gridBody: {
    flexDirection: 'row',
  },
  timeColumn: {
    width: 54,
    alignItems: 'center',
    paddingTop: 6,
  },
  timeLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: typography.body,
    height: 52,
    textAlign: 'center',
  },
  dayColumn: {
    width: 96,
    height: 320,
    paddingHorizontal: spacing.xs,
  },
  dayColumnInner: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  overlapBlock: {
    position: 'absolute',
    left: 6,
    right: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  block: {
    position: 'absolute',
    left: 10,
    right: 10,
    borderRadius: 10,
    shadowColor: '#FFFFFF',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});

module.exports = SyncScreen;
