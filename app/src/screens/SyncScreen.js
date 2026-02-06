const React = require('react');
const { View, Text, StyleSheet, ScrollView, TouchableOpacity } = require('react-native');
const { LinearGradient } = require('expo-linear-gradient');
const GlassCard = require('../components/GlassCard');
const NavBar = require('../components/NavBar');
const BackgroundOrbs = require('../components/BackgroundOrbs');
const LogoBadge = require('../components/LogoBadge');
const { colors, gradients, spacing, radii, typography } = require('../theme');
const { supabase } = require('../lib/supabase');

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const scheduleStartHour = 8;
const scheduleEndHour = 20;
const hourStep = 2;
const hourHeight = 26;

const timeToMinutes = (value) => {
  if (!value) return null;
  const parts = value.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1] || '0');
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const formatTime = (minutes) => {
  if (minutes === null || minutes === undefined) return '';
  const totalHours = Math.floor(minutes / 60);
  const mm = String(minutes % 60).padStart(2, '0');
  const period = totalHours >= 12 ? 'PM' : 'AM';
  const displayHour = totalHours % 12 || 12;
  return `${displayHour}:${mm} ${period}`;
};

const hours = Array.from(
  { length: Math.floor((scheduleEndHour - scheduleStartHour) / hourStep) },
  (_, idx) => scheduleStartHour + idx * hourStep
);
const palette = ['#7CF6E7', '#FFD66B', '#8DE1FF', '#FFB7E3', '#B6FFB0', '#F5A3FF'];

const toMinutes = (hour, minute = 0) => hour * 60 + minute;

const buildMockSchedules = (people) => {
  const seedBlocks = [
    [8, 45, 10, 45],
    [11, 0, 13, 0],
    [14, 0, 15, 20],
    [16, 0, 17, 30],
  ];

  return people.flatMap((person, idx) => {
    const blocks = [];
    const offset = idx % seedBlocks.length;
    const daysPattern = [[0, 2], [1, 3], [0, 2, 4], [1, 3, 4]][idx % 4];

    for (let i = 0; i < 2; i += 1) {
      const [sh, sm, eh, em] = seedBlocks[(offset + i) % seedBlocks.length];
      daysPattern.forEach((day) => {
        blocks.push({
          id: `mock-${person.id}-${day}-${i}`,
          owner: person.id,
          day,
          startMinutes: toMinutes(sh, sm),
          endMinutes: toMinutes(eh, em),
          title: 'Mock',
          timeLabel: `${formatTime(toMinutes(sh, sm))}-${formatTime(toMinutes(eh, em))}`,
        });
      });
    }

    return blocks;
  });
};

const USE_MOCK_SCHEDULES = true;

function buildOverlapBlocks(blocks, selectedIds) {
  const selected = blocks.filter((block) => selectedIds.includes(block.owner));
  const overlaps = [];

  for (let i = 0; i < selected.length; i += 1) {
    for (let j = i + 1; j < selected.length; j += 1) {
      const a = selected[i];
      const b = selected[j];
      if (a.day !== b.day) continue;
      const start = Math.max(a.startMinutes, b.startMinutes);
      const end = Math.min(a.endMinutes, b.endMinutes);
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

function SyncScreen({ current, onNavigate, onBack, user }) {
  const [people, setPeople] = React.useState([]);
  const [selected, setSelected] = React.useState([]);
  const [scheduleBlocks, setScheduleBlocks] = React.useState([]);
  const gridHeight = (scheduleEndHour - scheduleStartHour) * hourHeight;

  const loadPeople = React.useCallback(async () => {
    if (!user?.id) return;
    const { data: friendProfiles } = await supabase.rpc('list_friend_profiles', {
      user_id: user.id,
    });

    const all = [{ id: user.id, name: 'You' }, ...(friendProfiles || [])];
    const withColors = all.map((profile, index) => ({
      id: profile.id,
      name: profile.full_name || profile.username || profile.name,
      color: palette[index % palette.length],
    }));

    setPeople(withColors);
    setSelected(withColors.map((person) => person.id));
  }, [user?.id]);

  
  const loadSchedules = React.useCallback(async () => {
    if (!user?.id) return;
    const ids = [user.id, ...people.map((friend) => friend.id)];
    if (!ids.length) return;

    const { data } = await supabase
      .from('classes')
      .select('id, user_id, title, day, start_time, end_time')
      .in('user_id', ids);

    const mapped = (data || [])
      .map((row) => {
        const startMinutes = timeToMinutes(row.start_time);
        const endMinutes = timeToMinutes(row.end_time);
        if (startMinutes === null || endMinutes === null) return null;
        return {
          id: row.id,
          owner: row.user_id,
          day: row.day,
          startMinutes,
          endMinutes,
          title: row.title,
          timeLabel: `${formatTime(startMinutes)}-${formatTime(endMinutes)}`,
        };
      })
      .filter(Boolean)
      .filter((block) => block.day >= 0 && block.day <= 4);

    const seen = new Set();
    const unique = [];
    mapped.forEach((block) => {
      const key = `${block.owner}|${block.title}|${block.day}|${block.startMinutes}|${block.endMinutes}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(block);
      }
    });

    let finalBlocks = unique;

    if (USE_MOCK_SCHEDULES) {
      const ownersWithBlocks = new Set(unique.map((block) => block.owner));
      const missingPeople = people.filter((person) => !ownersWithBlocks.has(person.id));
      if (missingPeople.length) {
        finalBlocks = [...unique, ...buildMockSchedules(missingPeople)];
      }
    }

    setScheduleBlocks(finalBlocks);
  }, [people, user?.id]);


  React.useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  React.useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const allSelected = people.length && selected.length === people.length;

  const toggleFriend = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((item) => item !== id);
        return next.length ? next : prev;
      }
      return [...prev, id];
    });
  };

  const setAll = () => {
    setSelected(allSelected ? [] : people.map((person) => person.id));
  };

  const overlapBlocks = buildOverlapBlocks(scheduleBlocks, selected);

  return (
    <LinearGradient colors={gradients.background} style={styles.container}>
      <BackgroundOrbs />
      <LogoBadge />
      <View style={styles.header}>
        <Text style={styles.kicker}>Overlap view</Text>
        <Text style={styles.title}>Sync</Text>
        <Text style={styles.subtitle}>Import schedules to see overlaps.</Text>
      </View>

      <GlassCard style={styles.card}>
        <View style={styles.chipsRow}>
          <TouchableOpacity onPress={setAll} style={[styles.chip, styles.chipAll, allSelected && styles.chipActive]}>
            <Text style={[styles.chipText, allSelected && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {people.map((person) => (
            <TouchableOpacity
              key={person.id}
              onPress={() => toggleFriend(person.id)}
              style={[styles.chip, styles.chipActive]}
            >
              <View style={[styles.chipDot, { backgroundColor: person.color }]} />
              <Text style={[styles.chipText, styles.chipTextActive]}>{person.name}</Text>
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
                  <Text key={hour} style={[styles.timeLabel, { height: hourHeight * hourStep }]}>{formatTime(hour * 60)}</Text>
                ))}
              </View>

              {days.map((_, dayIndex) => (
                <View key={`col-${dayIndex}`} style={[styles.dayColumn, { height: gridHeight }]}>
                  <View style={styles.dayColumnInner}>
                    {overlapBlocks
                      .filter((block) => block.day === dayIndex)
                      .map((block) => {
                        const minStart = scheduleStartHour * 60;
                        const minEnd = scheduleEndHour * 60;
                        const clampedStart = Math.max(minStart, block.start);
                        const clampedEnd = Math.min(minEnd, block.end);
                        if (clampedEnd <= clampedStart) return null;
                        const top = ((clampedStart - minStart) / 60) * hourHeight;
                        const height = ((clampedEnd - clampedStart) / 60) * hourHeight;
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
                    {scheduleBlocks
                      .filter((block) => block.day === dayIndex)
                      .map((block) => {
                        const minStart = scheduleStartHour * 60;
                        const minEnd = scheduleEndHour * 60;
                        const clampedStart = Math.max(minStart, block.startMinutes);
                        const clampedEnd = Math.min(minEnd, block.endMinutes);
                        if (clampedEnd <= clampedStart) return null;
                        const top = ((clampedStart - minStart) / 60) * hourHeight;
                        const height = ((clampedEnd - clampedStart) / 60) * hourHeight;
                        const ownerColor = people.find((p) => p.id === block.owner)?.color || colors.accentFree;
                        const highlight = selected.includes(block.owner);
                        return (
                          <View
                            key={block.id}
                            style={[
                              styles.block,
                              {
                                top,
                                height,
                                backgroundColor: ownerColor,
                                opacity: highlight ? 0.9 : 0.2,
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
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    width: 64,
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
    width: 64,
    alignItems: 'flex-end',
    paddingTop: 6,
    paddingRight: 6,
  },
  timeLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: typography.body,
    textAlign: 'right',
    width: 64,
  },
  dayColumn: {
    width: 96,
    minHeight: 320,
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
  },
});

module.exports = SyncScreen;
