const React = require('react');
const { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, useWindowDimensions } = require('react-native');
const { LinearGradient } = require('expo-linear-gradient');
const GlassCard = require('../components/GlassCard');
const NavBar = require('../components/NavBar');
const BackgroundOrbs = require('../components/BackgroundOrbs');
const LogoBadge = require('../components/LogoBadge');
const { colors, gradients, spacing, radii, typography } = require('../theme');

const scheduleBlocks = [
  { id: 'p1', day: 0, dayLabel: 'Mon', start: 9, end: 10.5, title: 'CSE 142' },
  { id: 'p2', day: 1, dayLabel: 'Tue', start: 11, end: 12.25, title: 'MATH 124' },
  { id: 'p3', day: 2, dayLabel: 'Wed', start: 14, end: 15.25, title: 'INFO 200' },
  { id: 'p4', day: 4, dayLabel: 'Fri', start: 10, end: 11, title: 'STAT 311' },
];

const sampleFriends = [
  { id: 'f1', name: 'Maya' },
  { id: 'f2', name: 'Noah' },
  { id: 'f3', name: 'June' },
  { id: 'f4', name: 'Liam' },
  { id: 'f5', name: 'Ariana' },
  { id: 'f6', name: 'Dev' },
];

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function ProfileScreen({ current, onNavigate, onBack }) {
  const [discoverable, setDiscoverable] = React.useState(false);
  const [hideAll, setHideAll] = React.useState(false);
  const [friendsOpen, setFriendsOpen] = React.useState(false);
  const [pageIndex, setPageIndex] = React.useState(0);
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(280, width - spacing.lg * 2);

  const handlePage = (event) => {
    const x = event.nativeEvent.contentOffset.x;
    const next = Math.round(x / pageWidth);
    setPageIndex(next);
  };

  return (
    <LinearGradient colors={gradients.background} style={styles.container}>
      <BackgroundOrbs />
      <LogoBadge />
      <View style={styles.header}>
        <Text style={styles.kicker}>Your space</Text>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Schedule + privacy in one place.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>My schedule</Text>
          <View style={styles.pagerWrap}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handlePage}
              snapToInterval={pageWidth}
              decelerationRate="fast"
            >
              <View style={[styles.scheduleCard, { width: pageWidth }]}>
                {scheduleBlocks.map((block) => (
                  <View key={block.id} style={styles.courseCard}>
                    <Text style={styles.rowTitle}>{block.title}</Text>
                    <Text style={styles.rowMeta}>{block.dayLabel} · {block.start}:00-{block.end}:00</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.scheduleCard, { width: pageWidth }]}>
                <View style={styles.visualGrid}>
                  {days.map((day, idx) => (
                    <View key={day} style={styles.visualDay}>
                      <Text style={styles.visualDayLabel}>{day}</Text>
                      <View style={styles.visualDayColumn}>
                        {scheduleBlocks
                          .filter((block) => block.day === idx)
                          .map((block) => {
                            const height = (block.end - block.start) * 20;
                            const top = (block.start - 8) * 20;
                            return (
                              <View
                                key={block.id}
                                style={[styles.visualBlock, { top, height }]}
                              >
                                <Text style={styles.visualTitle}>{block.title}</Text>
                              </View>
                            );
                          })}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
          <View style={styles.dotsRow}>
            {[0, 1].map((dot) => (
              <View
                key={dot}
                style={[styles.dot, pageIndex === dot && styles.dotActive]}
              />
            ))}
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <TouchableOpacity style={styles.friendsHeader} onPress={() => setFriendsOpen((prev) => !prev)}>
            <View style={styles.friendStack}>
              <View style={styles.friendAvatar} />
              <View style={[styles.friendAvatar, styles.friendAvatarOverlap]} />
            </View>
            <Text style={styles.sectionTitle}>Friends</Text>
            <Text style={styles.dropdownIcon}>{friendsOpen ? '-' : '+'}</Text>
          </TouchableOpacity>
          {friendsOpen && (
            <ScrollView style={styles.friendsList} contentContainerStyle={styles.friendsListContent}>
              {sampleFriends.map((friend) => (
                <View key={friend.id} style={styles.friendRow}>
                  <Text style={styles.friendName}>{friend.name}</Text>
                  <View style={styles.friendActions}>
                    <TouchableOpacity style={styles.friendActionBtn}>
                      <Text style={styles.friendActionText}>Hide</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.friendActionBtn}>
                      <Text style={styles.friendActionText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.rowTitle}>Discoverable on campus</Text>
              <Text style={styles.rowMeta}>Show me on the Link screen.</Text>
            </View>
            <Switch
              value={discoverable}
              onValueChange={setDiscoverable}
              thumbColor={discoverable ? colors.accentFree : colors.textSecondary}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: 'rgba(124,246,231,0.35)' }}
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.rowTitle}>Hide entire schedule</Text>
              <Text style={styles.rowMeta}>Friends won’t see any blocks.</Text>
            </View>
            <Switch
              value={hideAll}
              onValueChange={setHideAll}
              thumbColor={hideAll ? colors.accentFree : colors.textSecondary}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: 'rgba(124,246,231,0.35)' }}
            />
          </View>
        </GlassCard>
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
  content: {
    paddingBottom: 120,
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: typography.bodySemi,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: typography.bodySemi,
  },
  rowMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: typography.body,
  },
  pagerWrap: {
    overflow: 'hidden',
  },
  scheduleCard: {
    gap: spacing.sm,
  },
  courseCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: spacing.sm,
    maxWidth: 220,
  },
  visualGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  visualDay: {
    flex: 1,
  },
  visualDayLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: typography.bodyMedium,
    textAlign: 'center',
    marginBottom: 4,
  },
  visualDayColumn: {
    height: 240,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  visualBlock: {
    position: 'absolute',
    left: 6,
    right: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(124,246,231,0.2)',
    borderWidth: 1,
    borderColor: colors.accentFree,
    padding: 4,
  },
  visualTitle: {
    color: colors.textPrimary,
    fontSize: 9,
    fontFamily: typography.bodySemi,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: colors.accentFree,
  },
  friendsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  friendStack: {
    width: 36,
    height: 24,
  },
  friendAvatar: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  friendAvatarOverlap: {
    left: 12,
  },
  dropdownIcon: {
    color: colors.textSecondary,
    fontSize: 18,
    marginLeft: 'auto',
  },
  friendsList: {
    maxHeight: 180,
  },
  friendsListContent: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: typography.bodyMedium,
  },
  friendActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  friendActionBtn: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  friendActionText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontFamily: typography.bodyMedium,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleText: {
    flex: 1,
    paddingRight: spacing.md,
  },
});

module.exports = ProfileScreen;
