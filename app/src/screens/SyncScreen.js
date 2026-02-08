// SyncScreen: compare schedules with friends to find shared free time.
// Loads friends + their classes, filters by privacy, and visualizes overlaps/gaps.
const React = require('react');
const { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } = require('react-native');
const { LinearGradient } = require('expo-linear-gradient');
const GlassCard = require('../components/GlassCard');
const NavBar = require('../components/NavBar');
const BackgroundOrbs = require('../components/BackgroundOrbs');
const LogoBadge = require('../components/LogoBadge');
const { colors, gradients, spacing, radii, typography } = require('../theme');
const { supabase } = require('../lib/supabase');

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const scheduleStartHour = 7;
const scheduleEndHour = 23;
const hourStep = 1;
const hourHeight = 28;

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

const uniqueById = (list) => {
  const map = new Map();
  (list || []).forEach((item) => {
    if (item?.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
};


const fetchHiddenOwners = async (viewerId, ownerIds) => {
  if (!viewerId || !ownerIds.length) return new Set();

  const hiddenOwners = new Set();
  const { data: rules } = await supabase
    .from('privacy_rules')
    .select('user_id')
    .eq('friend_id', viewerId)
    .eq('hide_all', true)
    .in('user_id', ownerIds);

  (rules || []).forEach((row) => {
    if (row?.user_id) hiddenOwners.add(row.user_id);
  });

  const { data: hides } = await supabase
    .from('profiles')
    .select('id, hide_schedule')
    .in('id', ownerIds);

  (hides || []).forEach((row) => {
    if (row?.hide_schedule) hiddenOwners.add(row.id);
  });

  return hiddenOwners;
};


const toMinutes = (hour, minute = 0) => hour * 60 + minute;

const buildFreeBlocks = (blocks, selectedIds) => {
  if (!selectedIds.length) return [];
  const minStart = scheduleStartHour * 60;
  const minEnd = scheduleEndHour * 60;
  const dayBuckets = new Map();

  blocks
    .filter((block) => selectedIds.includes(block.owner))
    .forEach((block) => {
      const start = Math.max(minStart, block.startMinutes);
      const end = Math.min(minEnd, block.endMinutes);
      if (end <= start) return;
      const list = dayBuckets.get(block.day) || [];
      list.push({ start, end });
      dayBuckets.set(block.day, list);
    });

  const free = [];
  for (let day = 0; day <= 4; day += 1) {
    const busy = (dayBuckets.get(day) || []).sort((a, b) => a.start - b.start);
    const merged = [];
    busy.forEach((slot) => {
      const last = merged[merged.length - 1];
      if (!last || slot.start > last.end) {
        merged.push({ ...slot });
      } else {
        last.end = Math.max(last.end, slot.end);
      }
    });

    let cursor = minStart;
    merged.forEach((slot) => {
      if (slot.start > cursor) {
        free.push({
          id: `free-${day}-${cursor}-${slot.start}`,
          day,
          start: cursor,
          end: slot.start,
        });
      }
      cursor = Math.max(cursor, slot.end);
    });

    if (cursor < minEnd) {
      free.push({
        id: `free-${day}-${cursor}-${minEnd}`,
        day,
        start: cursor,
        end: minEnd,
      });
    }
  }

  return free;
};

const toDayIndex = (date) => {
  const js = date.getDay();
  return (js + 6) % 7;
};

const formatFriendList = (names) => {
  if (!names.length) return 'no friends';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

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

const USE_MOCK_SCHEDULES = false;

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
  const [showAllFriends, setShowAllFriends] = React.useState(false);
  const [gapIndex, setGapIndex] = React.useState(0);
  const gridHeight = (scheduleEndHour - scheduleStartHour) * hourHeight;


  
  const loadPeople = React.useCallback(async () => {
    if (!user?.id) return;
    const { data: friendProfiles } = await supabase.rpc('list_friend_profiles', {
      user_id: user.id,
    });

    const all = uniqueById([{ id: user.id, name: 'You' }, ...(friendProfiles || [])]);
    const ownerIds = all.map((profile) => profile.id).filter(Boolean);
    const hiddenOwners = await fetchHiddenOwners(user.id, ownerIds);

    const filtered = uniqueById(
      all.filter((profile) => !hiddenOwners.has(profile.id) || profile.id === user.id)
    );
    const withColors = filtered.map((profile, index) => ({
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

    const hiddenOwners = await fetchHiddenOwners(user.id, ids);

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
      .filter((block) => block.day >= 0 && block.day <= 4)
      .filter((block) => !hiddenOwners.has(block.owner));

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
  const freeBlocks = buildFreeBlocks(scheduleBlocks, selected);
  const hourMarks = Array.from(
    { length: scheduleEndHour - scheduleStartHour + 1 },
    (_, idx) => scheduleStartHour + idx
  );
  const visiblePeople = showAllFriends ? people : people.slice(0, 2);
  const selectedNames = people.filter((person) => selected.includes(person.id)).map((p) => p.name);
  const now = new Date();
  const todayIdx = toDayIndex(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - todayIdx);
  const upcomingGaps = freeBlocks
    .map((block) => {
      const gapDate = new Date(weekStart);
      gapDate.setDate(weekStart.getDate() + block.day);
      const isToday = isSameDay(gapDate, now);
      const effectiveStart = isToday ? Math.max(block.start, nowMinutes) : block.start;
      return { ...block, gapDate, effectiveStart, isToday };
    })
    .filter((block) => {
      if (block.day < 0 || block.day > 4) return false;
      if (block.day < todayIdx) return false;
      if (block.isToday && block.end <= nowMinutes) return false;
      return block.gapDate >= weekStart;
    })
    .sort((a, b) => {
      if (a.gapDate.getTime() !== b.gapDate.getTime()) return a.gapDate - b.gapDate;
      return a.effectiveStart - b.effectiveStart;
    });
  const safeGapIndex = upcomingGaps.length ? Math.max(0, Math.min(gapIndex, upcomingGaps.length - 1)) : 0;
  const currentGap = upcomingGaps[safeGapIndex];
  const gapDayLabel = currentGap
    ? isSameDay(currentGap.gapDate, now)
      ? 'today'
      : days[currentGap.day] || 'day'
    : null;
  const gapTimeLabel = currentGap ? formatTime(currentGap.effectiveStart) : null;
  const gapText = currentGap
    ? `Next synced gap with ${formatFriendList(selectedNames)} is ${gapDayLabel} at ${gapTimeLabel}.`
    : selectedNames.length
      ? 'No synced gaps available this week.'
      : 'Select friends to see synced gaps.';

  React.useEffect(() => {
    setGapIndex(0);
  }, [selected.join('|'), scheduleBlocks.length]);

  return (
    <LinearGradient colors={gradients.background} style={styles.container}>
      <BackgroundOrbs />
      <LogoBadge />
      <View style={styles.header}>
        <Text style={styles.kicker}>Sync your schedules with friends</Text>
        <Text style={styles.title}>Sync</Text>
        <Text style={styles.subtitle}>Teal segments show when selected friends are free.</Text>
      </View>

      <GlassCard style={styles.card}>
        <View style={styles.chipsHeader}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            <View style={styles.chipsRowInner}>
              <TouchableOpacity onPress={setAll} style={[styles.chip, styles.chipAll, allSelected && styles.chipActive]}>
                <Text
                  style={[styles.chipText, allSelected && styles.chipTextActive]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  All
                </Text>
              </TouchableOpacity>
              {visiblePeople.map((person) => {
                const isActive = selected.includes(person.id);
                return (
                  <TouchableOpacity
                    key={`person-${person.id}`}
                    onPress={() => toggleFriend(person.id)}
                    style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
                  >
                    <View style={[styles.chipDot, { backgroundColor: person.color }]} />
                    <Text
                      style={[styles.chipText, isActive && styles.chipTextActive]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {person.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <TouchableOpacity style={styles.seeAllBtn} onPress={() => setShowAllFriends(true)}>
            <Text style={styles.seeAllText}>See all +</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.gridScroll} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.gridWrap}>
              <View style={styles.gridHeader}>
                <View style={styles.timeSpacer} />
                {days.map((day) => (
                  <View key={day} style={styles.gridDayWrap}>
                    <Text style={styles.gridDay}>{day}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.gridBody}>
                <View style={styles.timeColumn}>
                  {hours.map((hour) => (
                    <View key={hour} style={[styles.timeLabelWrap, { height: hourHeight * hourStep }]}>
                      <Text style={styles.timeLabel}>
                        {(hour - scheduleStartHour) % 2 === 0 ? formatTime(hour * 60) : ''}
                      </Text>
                    </View>
                  ))}
                </View>

                {days.map((_, dayIndex) => (
                  <View key={`col-${dayIndex}`} style={[styles.dayColumn, { height: gridHeight }]}>
                    <View style={styles.dayColumnInner}>
                      {hourMarks.map((hour) => {
                        const top = (hour - scheduleStartHour) * hourHeight;
                        return <View key={`line-${dayIndex}-${hour}`} style={[styles.hourLine, { top }]} />;
                      })}
                      {freeBlocks
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
                                styles.freeBlock,
                                {
                                  top,
                                  height,
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
        </ScrollView>
        <View style={styles.gapRow}>
          <TouchableOpacity
            onPress={() => setGapIndex((prev) => Math.max(0, prev - 1))}
            disabled={!upcomingGaps.length || safeGapIndex === 0}
            style={[styles.gapArrow, (!upcomingGaps.length || safeGapIndex === 0) && styles.gapArrowDisabled]}
          >
            <Text style={styles.gapArrowText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.gapText} numberOfLines={2}>
            {gapText}
          </Text>
          <TouchableOpacity
            onPress={() => setGapIndex((prev) => Math.min(upcomingGaps.length - 1, prev + 1))}
            disabled={!upcomingGaps.length || safeGapIndex === upcomingGaps.length - 1}
            style={[styles.gapArrow, (!upcomingGaps.length || safeGapIndex === upcomingGaps.length - 1) && styles.gapArrowDisabled]}
          >
            <Text style={styles.gapArrowText}>{'>'}</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>

      <NavBar current={current} onNavigate={onNavigate} onBack={onBack} />
      <Modal transparent visible={showAllFriends} animationType="fade" onRequestClose={() => setShowAllFriends(false)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All friends</Text>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowAllFriends(false)}>
                <Text style={styles.modalCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity onPress={setAll} style={[styles.chip, styles.chipAll, allSelected && styles.chipActive]}>
                <Text style={[styles.chipText, allSelected && styles.chipTextActive]}>All</Text>
              </TouchableOpacity>
              {people.map((person) => {
                const isActive = selected.includes(person.id);
                return (
                  <TouchableOpacity
                    key={`modal-person-${person.id}`}
                    onPress={() => toggleFriend(person.id)}
                    style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
                  >
                    <View style={[styles.chipDot, { backgroundColor: person.color }]} />
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{person.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </GlassCard>
        </View>
      </Modal>
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
  chipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
    position: 'relative',
  },
  chipsRow: {
    flex: 1,
    paddingRight: 72,
  },
  chipsRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  seeAllBtn: {
    position: 'absolute',
    right: -20,
    top: -20,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  seeAllText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: typography.bodyMedium,
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
    backgroundColor: 'rgba(12, 24, 26, 0.85)',
    borderColor: 'rgba(60, 232, 217, 0.95)',
    shadowColor: 'rgba(60, 232, 217, 0.9)',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  chipInactive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
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
    maxWidth: 110,
  },
  chipTextActive: {
    color: colors.textPrimary,
  },
  gridWrap: {
    minWidth: 720,
  },
  gridScroll: {
    maxHeight: 520,
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
    textAlign: 'center',
    fontFamily: typography.bodyMedium,
  },
  gridDayWrap: {
    width: 120,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  gridBody: {
    flexDirection: 'row',
  },
  timeColumn: {
    width: 72,
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  timeLabelWrap: {
    width: 72,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  timeLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: typography.body,
    textAlign: 'right',
    width: 72,
  },
  dayColumn: {
    width: 120,
    minHeight: 420,
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
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  freeBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 0,
    backgroundColor: 'rgba(60, 232, 217, 0.55)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(145, 255, 244, 0.9)',
  },
  gapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  gapArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(60, 232, 217, 0.95)',
    backgroundColor: 'rgba(12, 24, 26, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gapArrowDisabled: {
    opacity: 0.4,
  },
  gapArrowText: {
    color: 'rgba(60, 232, 217, 0.95)',
    fontSize: 14,
    fontFamily: typography.bodyMedium,
    marginTop: -1,
  },
  gapText: {
    flex: 1,
    color: '#0B0B0B',
    fontSize: 13,
    fontFamily: typography.bodySemi,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 16, 0.72)',
    padding: spacing.lg,
    justifyContent: 'center',
  },
  modalCard: {
    padding: spacing.lg,
    width: '100%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: typography.bodySemi,
  },
  modalClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  modalCloseText: {
    color: colors.textPrimary,
    fontSize: 18,
    marginTop: -1,
  },
  modalList: {
    flexGrow: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});

module.exports = SyncScreen;
