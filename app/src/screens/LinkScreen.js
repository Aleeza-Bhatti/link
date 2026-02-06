const React = require('react');
const {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Linking,
  TextInput,
  ActivityIndicator,
} = require('react-native');
const { LinearGradient } = require('expo-linear-gradient');
const GlassCard = require('../components/GlassCard');
const NavBar = require('../components/NavBar');
const BackgroundOrbs = require('../components/BackgroundOrbs');
const LogoBadge = require('../components/LogoBadge');
const { colors, gradients, spacing, radii, typography } = require('../theme');
const { supabase } = require('../lib/supabase');

const campusFilters = ['All', 'Seattle', 'Bothell', 'Tacoma'];

function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const openInstagram = async (handle) => {
  const cleaned = (handle || '').replace(/^@/, '').trim();
  if (!cleaned) return;
  const url = `https://www.instagram.com/${cleaned}/`;
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  }
};

function PersonCard({ person }) {
  return (
    <GlassCard style={styles.personCard}>
      <View style={styles.personMain}>
        <View style={styles.avatar} />
        <View style={styles.personInfo}>
          <Text style={styles.personName}>{person.full_name || person.username}</Text>
          <Text style={styles.personMeta}>{person.major} ï¿½ {person.year}</Text>
          <View style={styles.hobbiesRow}>
            {(person.hobbies || []).map((hobby) => (
              <View key={hobby} style={styles.hobbyPill}>
                <Text style={styles.hobbyText}>{hobby}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.igBadge} onPress={() => openInstagram(person.ig_handle || person.username)}>
        <View style={styles.igLogo}>
          <Text style={styles.igLogoText}>IG</Text>
        </View>
        <Text style={styles.igHandle}>{person.ig_handle || `@${person.username}`}</Text>
      </TouchableOpacity>
    </GlassCard>
  );
}

function LinkScreen({ current, onNavigate, onBack, user }) {
  const [campus, setCampus] = React.useState('All');
  const [lastReload, setLastReload] = React.useState(null);
  const [isReloading, setIsReloading] = React.useState(false);
  const [people, setPeople] = React.useState([]);
  const [friendsOpen, setFriendsOpen] = React.useState(false);
  const [requestsOpen, setRequestsOpen] = React.useState(false);
  const [friends, setFriends] = React.useState([]);
  const [pendingIn, setPendingIn] = React.useState([]);
  const [pendingOut, setPendingOut] = React.useState([]);
  const [hiddenIds, setHiddenIds] = React.useState([]);
  const [usernameInput, setUsernameInput] = React.useState('');
  const [friendStatus, setFriendStatus] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);
  const [searching, setSearching] = React.useState(false);
  const [relationshipMap, setRelationshipMap] = React.useState({});
  const [pendingRequestIds, setPendingRequestIds] = React.useState([]);

  const uniqueById = (list) => {
    const map = new Map();
    (list || []).forEach((item) => {
      if (item?.id && !map.has(item.id)) map.set(item.id, item);
    });
    return Array.from(map.values());
  };

  const loadFriends = React.useCallback(async () => {
    if (!user?.id) return;
    setFriendStatus('');

    const { data: friendships } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const relationMap = {};
    (friendships || []).forEach((row) => {
      const otherId = row.requester_id === user.id ? row.addressee_id : row.requester_id;
      if (!otherId) return;
      if (row.status === 'accepted') {
        relationMap[otherId] = 'accepted';
      } else if (row.status === 'pending' && row.requester_id === user.id) {
        relationMap[otherId] = 'pending_out';
      } else if (row.status === 'pending') {
        relationMap[otherId] = 'pending_in';
      }
    });
    setRelationshipMap(relationMap);

    const incoming = (friendships || []).filter(
      (row) => row.status === 'pending' && row.addressee_id === user.id
    );
    const outgoing = (friendships || []).filter(
      (row) => row.status === 'pending' && row.requester_id === user.id
    );

    const { data: friendProfiles } = await supabase.rpc('list_friend_profiles', {
      user_id: user.id,
    });

    setFriends(uniqueById(friendProfiles || []));

    const incomingIds = incoming.map((row) => row.requester_id);
    const outgoingIds = outgoing.map((row) => row.addressee_id);

    const { data: incomingProfiles } = incomingIds.length
      ? await supabase.from('profiles').select('id, username, full_name').in('id', incomingIds)
      : { data: [] };

    const { data: outgoingProfiles } = outgoingIds.length
      ? await supabase.from('profiles').select('id, username, full_name').in('id', outgoingIds)
      : { data: [] };

    setPendingIn(uniqueById(incomingProfiles || []));
    setPendingOut(uniqueById(outgoingProfiles || []));

    const { data: privacyRows } = await supabase
      .from('privacy_rules')
      .select('friend_id, hide_all')
      .eq('user_id', user.id)
      .eq('hide_all', true);

    setHiddenIds((privacyRows || []).map((row) => row.friend_id));
  }, [user?.id]);


  const handleAddFriend = async () => {
    const term = usernameInput.trim();
    if (!term) return;
    setFriendStatus('');

    const { data, error } = await supabase.rpc('search_public_profiles', {
      search_term: term.toLowerCase(),
    });

    if (error || !data?.length) {
      setFriendStatus('User not found.');
      return;
    }

    const target = data[0];
    if (!target?.id) {
      setFriendStatus('User not found.');
      return;
    }

    if (target.id === user.id) {
      setFriendStatus('You cannot add yourself.');
      return;
    }

    if (pendingRequestIds.includes(target.id)) {
      setFriendStatus('Request already sent.');
      return;
    }

    const existing = relationshipMap[target.id];
    if (existing === 'accepted') {
      setFriendStatus('You are already friends.');
      return;
    }
    if (existing === 'pending_out') {
      setFriendStatus('Request already sent.');
      return;
    }
    if (existing === 'pending_in') {
      setFriendStatus('They already requested you.');
      return;
    }

    setPendingRequestIds((prev) => [...new Set([...prev, target.id])]);
    setRelationshipMap((prev) => ({ ...prev, [target.id]: 'pending_out' }));

    const { error: insertError } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: target.id,
      status: 'pending',
    });

    if (insertError) {
      setPendingRequestIds((prev) => prev.filter((id) => id != target.id));
      setRelationshipMap((prev) => {
        const next = { ...prev };
        delete next[target.id];
        return next;
      });
      setFriendStatus(insertError.message);
      return;
    }

    setUsernameInput('');
    setFriendStatus('Request sent.');
    loadFriends();
  };

const handleQuickAdd = async (friendId) => {
    setFriendStatus('');
    if (pendingRequestIds.includes(friendId)) {
      setFriendStatus('Request already sent.');
      return;
    }
    const existing = relationshipMap[friendId];
    if (existing === 'accepted') {
      setFriendStatus('You are already friends.');
      return;
    }
    if (existing === 'pending_out') {
      setFriendStatus('Request already sent.');
      return;
    }
    if (existing === 'pending_in') {
      setFriendStatus('They already requested you.');
      return;
    }

    setPendingRequestIds((prev) => [...new Set([...prev, friendId])]);
    setRelationshipMap((prev) => ({ ...prev, [friendId]: 'pending_out' }));

    const { error: insertError } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: friendId,
      status: 'pending',
    });

    if (insertError) {
      setPendingRequestIds((prev) => prev.filter((id) => id != friendId));
      setRelationshipMap((prev) => {
        const next = { ...prev };
        delete next[friendId];
        return next;
      });
      setFriendStatus(insertError.message);
      return;
    }

    setFriendStatus('Request sent.');
    setUsernameInput('');
    setSearchResults([]);
    loadFriends();
  };

  const handleAccept = async (friendId) => {
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .match({ requester_id: friendId, addressee_id: user.id, status: 'pending' });
    loadFriends();
  };

  const handleDecline = async (friendId) => {
    await supabase
      .from('friendships')
      .delete()
      .match({ requester_id: friendId, addressee_id: user.id, status: 'pending' });
    loadFriends();
  };

  const handleRemove = async (friendId) => {
    await supabase
      .from('friendships')
      .delete()
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`
      );
    loadFriends();
  };

  const toggleHide = async (friendId) => {
    const isHidden = hiddenIds.includes(friendId);
    if (isHidden) {
      await supabase
        .from('privacy_rules')
        .delete()
        .match({ user_id: user.id, friend_id: friendId });
      setHiddenIds((prev) => prev.filter((id) => id !== friendId));
      return;
    }

    await supabase.from('privacy_rules').upsert({
      user_id: user.id,
      friend_id: friendId,
      hide_all: true,
    });
    setHiddenIds((prev) => [...prev, friendId]);
  };

  const fetchPeople = React.useCallback(async () => {
    setIsReloading(true);
    const { data, error } = await supabase.rpc('list_free_now', {
      campus_filter: campus === 'All' ? null : campus,
    });

    if (!error) {
      let next = data || [];
      next = next.filter((person) => person.id !== user?.id);
      next = next.filter((person) => !relationshipMap[person.id]);

      const seen = new Set();
      next = next.filter((person) => {
        if (!person?.id) return false;
        if (seen.has(person.id)) return false;
        seen.add(person.id);
        return true;
      });

      setPeople(next);
    }
    setLastReload(new Date());
    setIsReloading(false);
  }, [campus, relationshipMap, user?.id]);

  React.useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  React.useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  React.useEffect(() => {
    if (current === 'Link') {
      loadFriends();
    }
  }, [current, loadFriends]);

  React.useEffect(() => {
    const term = usernameInput.trim();
    if (!term) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_public_profiles', {
        search_term: term,
      });

      if (!active) return;
      if (error) {
        setSearchResults([]);
      } else {
        setSearchResults(uniqueById((data || []).filter((row) => row.id !== user.id)));
      }
      setSearching(false);
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [usernameInput, user?.id]);

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

      <ScrollView contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={isReloading}
            onRefresh={() => {
              fetchPeople();
              loadFriends();
            }}
            tintColor={colors.textPrimary}
          />
        )}
      >
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
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>Add friend</Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder="Search by username or name"
              placeholderTextColor={colors.textSecondary}
              value={usernameInput}
              onChangeText={setUsernameInput}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleAddFriend}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {searching ? (
            <View style={styles.searchRow}>
              <ActivityIndicator color={colors.textPrimary} size="small" />
              <Text style={styles.searchText}>Searching?</Text>
            </View>
          ) : null}

          {searchResults.length ? (
            <View style={styles.searchResults}>
              {searchResults.map((result) => {
                const relation = relationshipMap[result.id];
                return (
                  <View key={`search-${result.id}`} style={styles.searchItem}>
                    <View>
                      <Text style={styles.friendName}>{result.full_name || result.username}</Text>
                      <Text style={styles.searchMeta}>@{result.username}</Text>
                    </View>
                    {relation === 'accepted' ? (
                      <TouchableOpacity style={styles.friendActionBtn} onPress={() => handleRemove(result.id)}>
                        <Text style={styles.friendActionText}>Remove</Text>
                      </TouchableOpacity>
                    ) : relation === 'pending_out' ? (
                      <TouchableOpacity style={[styles.friendActionBtn, styles.friendActionBtnDisabled]} disabled>
                        <Text style={styles.friendActionText}>Requested</Text>
                      </TouchableOpacity>
                    ) : relation === 'pending_in' ? (
                      <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.friendActionBtn} onPress={() => handleAccept(result.id)}>
                          <Text style={styles.friendActionText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.friendSecondaryBtn} onPress={() => handleDecline(result.id)}>
                          <Text style={styles.friendSecondaryText}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.friendActionBtn} onPress={() => handleQuickAdd(result.id)}>
                        <Text style={styles.friendActionText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}

          {friendStatus ? <Text style={styles.status}>{friendStatus}</Text> : null}
        </GlassCard>

        <GlassCard style={styles.card}>
          <TouchableOpacity style={styles.friendsHeader} onPress={() => setRequestsOpen((prev) => !prev)}>
            <Text style={styles.sectionTitle}>{pendingIn.length ? 'Friend requests' : 'Friend requests'}</Text>
            <Text style={styles.dropdownIcon}>{requestsOpen ? '-' : '+'}</Text>
          </TouchableOpacity>
          {requestsOpen && (
            <ScrollView style={styles.friendsList} contentContainerStyle={styles.friendsListContent}>
              {pendingIn.length ? (
                pendingIn.map((friend) => (
                  <View key={`pending-in-${friend.id}`} style={styles.friendRow}>
                    <Text style={styles.friendName}>{friend.full_name || friend.username}</Text>
                    <View style={styles.friendActions}>
                      <TouchableOpacity style={styles.friendActionBtn} onPress={() => handleAccept(friend.id)}>
                        <Text style={styles.friendActionText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.friendActionBtn} onPress={() => handleDecline(friend.id)}>
                        <Text style={styles.friendActionText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No friend requests for now. Link with people.</Text>
              )}
            </ScrollView>
          )}
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
              {friends.map((friend) => (
                <View key={`friend-${friend.id}`} style={styles.friendRow}>
                  <Text style={styles.friendName}>{friend.full_name || friend.username}</Text>
                  <View style={styles.friendActions}>
                    <TouchableOpacity
                      style={styles.friendActionBtn}
                      onPress={() => toggleHide(friend.id)}
                    >
                      <Text style={styles.friendActionText}>
                        {hiddenIds.includes(friend.id) ? 'Unhide' : 'Hide'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.friendActionBtn} onPress={() => handleRemove(friend.id)}>
                      <Text style={styles.friendActionText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </GlassCard>

        <View style={styles.peopleList}>
          {people.length ? (
            people.map((person) => <PersonCard key={`person-${person.id}`} person={person} />)
          ) : (
            <Text style={styles.emptyText}>No discoverable users yet.</Text>
          )}
        </View>
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
    marginBottom: spacing.sm,
  },
  card: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: typography.bodySemi,
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
  content: {
    paddingBottom: 180,
    gap: spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  addBtn: {
    backgroundColor: colors.accentFree,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    shadowColor: '#0D0A1A',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  addBtnText: {
    color: '#1B1530',
    fontFamily: typography.bodySemi,
  },
  status: {
    color: colors.textSecondary,
    fontFamily: typography.body,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  searchText: {
    color: colors.textSecondary,
    fontFamily: typography.body,
  },
  searchResults: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  searchMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: typography.body,
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
    color: colors.textPrimary,
    fontSize: 18,
    marginLeft: 'auto',
    opacity: 0.7,
  },
  friendsList: {
    maxHeight: 220,
  },
  friendsListContent: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
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
  friendActionBtnDisabled: {
    opacity: 0.5,
  },
  friendSecondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  friendSecondaryText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: typography.bodyMedium,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  peopleList: {
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

