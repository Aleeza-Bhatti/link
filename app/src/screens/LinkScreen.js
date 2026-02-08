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
  Switch,
  Image,
  Modal,
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

const uniqueById = (list) => {
  const map = new Map();
  (list || []).forEach((item) => {
    if (item?.id && !map.has(item.id)) map.set(item.id, item);
  });
  return Array.from(map.values());
};

const getInitials = (person) => {
  const source = (person?.full_name || person?.username || '').trim();
  if (!source) return 'U';
  const parts = source.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

function PersonCard({ person, onAddFriend, onUndo, relation, pendingIds }) {
  const [avatarFailed, setAvatarFailed] = React.useState(false);
  const initials = getInitials(person);
  const avatarUrl = (person?.avatar_url || '').trim();
  const igHandle = person.ig_handle || (person.username ? `@${person.username}` : '');
  const isRequested = relation === 'pending_out' || (pendingIds || []).includes(person.id);
  const isFriend = relation === 'accepted';
  const isDisabled = isFriend;
  const buttonLabel = isFriend ? 'Friends' : isRequested ? 'Request sent' : 'Add friend';

  return (
    <GlassCard style={styles.personCard}>
      <View style={styles.personMain}>
        {avatarUrl && !avatarFailed ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
            resizeMode="cover"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <View style={styles.personInfo}>
          <Text style={styles.personName} numberOfLines={1} ellipsizeMode="tail">
            {person.full_name || person.username || 'Student'}
          </Text>
          <Text style={styles.personMeta} numberOfLines={1} ellipsizeMode="tail">
            {person.major || 'Major'} | {person.year || 'Year'}
          </Text>
          <Text style={styles.personMeta} numberOfLines={1} ellipsizeMode="tail">
            {person.campus || 'Campus'}
          </Text>
          <View style={styles.hobbiesRow}>
            {(person.hobbies || []).slice(0, 3).map((hobby) => (
              <View key={hobby} style={styles.hobbyPill}>
                <Text style={styles.hobbyText} numberOfLines={1} ellipsizeMode="tail">
                  {hobby}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.personActionRow}>
            <TouchableOpacity
              style={[styles.personAddBtnInline, isDisabled && styles.personAddBtnDisabled]}
              onPress={() => onAddFriend(person.id)}
              disabled={isDisabled || isRequested}
            >
              <Text style={[styles.personAddText, isDisabled && styles.personAddTextDisabled]}>{buttonLabel}</Text>
            </TouchableOpacity>
            {isRequested ? (
              <TouchableOpacity style={styles.personUndoBtn} onPress={() => onUndo(person.id)}>
                <Text style={styles.personUndoText}>Undo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.igBadge, !igHandle && styles.igBadgeDisabled]}
        onPress={() => openInstagram(igHandle)}
        disabled={!igHandle}
      >
        <View style={styles.igLogo}>
          <Image source={require('../../assets/ig-logo.png')} style={styles.igLogoImage} />
        </View>
      </TouchableOpacity>
    </GlassCard>
  );
}

function LinkScreen({ current, onNavigate, onBack, user }) {
  const [campus, setCampus] = React.useState('All');
  const [lastReload, setLastReload] = React.useState(null);
  const [isReloading, setIsReloading] = React.useState(false);
  const [people, setPeople] = React.useState([]);
  const [freeNowOnly, setFreeNowOnly] = React.useState(false);
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
  const [friendSheetOpen, setFriendSheetOpen] = React.useState(false);
  const [friendDetail, setFriendDetail] = React.useState(null);
  const [friendDetailLoading, setFriendDetailLoading] = React.useState(false);
  const [friendAvatarFailed, setFriendAvatarFailed] = React.useState(false);

  const toDayIndex = (date) => (date.getDay() + 6) % 7;
  const toTimeString = (date) => {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const fetchFreeNowIds = React.useCallback(async () => {
    if (!user?.id) return null;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const { data, error } = await supabase.rpc('list_free_now_ids_tz', {
      tz_name: timeZone,
    });

    if (error) return null;
    const ids = new Set();
    (data || []).forEach((row) => {
      if (row?.user_id) ids.add(row.user_id);
    });
    return ids;
  }, [user?.id]);

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

    // TODO: Per-friend hide is disabled for now; we'll reintroduce later.
    setHiddenIds([]);
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
      setPendingRequestIds((prev) => prev.filter((id) => id !== target.id));
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
      setPendingRequestIds((prev) => prev.filter((id) => id !== friendId));
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

  const handleUndoRequest = async (friendId) => {
    setFriendStatus('');
    await supabase
      .from('friendships')
      .delete()
      .match({ requester_id: user.id, addressee_id: friendId, status: 'pending' });
    setPendingRequestIds((prev) => prev.filter((id) => id !== friendId));
    setRelationshipMap((prev) => {
      const next = { ...prev };
      if (next[friendId] === 'pending_out') delete next[friendId];
      return next;
    });
    setFriendStatus('Request undone.');
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

  const closeFriendSheet = () => {
    setFriendSheetOpen(false);
    setFriendDetail(null);
    setFriendDetailLoading(false);
    setFriendAvatarFailed(false);
  };

  const openFriendSheet = async (friend) => {
    if (!friend?.id) return;
    setFriendSheetOpen(true);
    setFriendDetail(friend);
    setFriendDetailLoading(true);
    setFriendAvatarFailed(false);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, major, year, campus, ig_handle, avatar_url, avatar_path, hobbies')
        .eq('id', friend.id)
        .single();
      if (data) {
        let signedAvatarUrl = (data.avatar_url || '').trim();
        if (data.avatar_path) {
          const { data: signed } = await supabase
            .storage
            .from('avatars')
            .createSignedUrl(data.avatar_path, 60 * 60 * 24 * 30);
          signedAvatarUrl = (signed?.signedUrl || signedAvatarUrl || '').trim();
        }
        setFriendDetail({ ...data, avatar_url: signedAvatarUrl });
      }
    } catch (err) {
      setFriendDetail(friend);
    } finally {
      setFriendDetailLoading(false);
    }
  };

  const fetchPeople = React.useCallback(async () => {
    setIsReloading(true);
    const { data, error } = await supabase.rpc('list_discoverable_profiles', {
      campus_filter: campus === 'All' ? null : campus,
      gender_filter: null,
    });

    if (!error) {
      let next = data || [];
      if (freeNowOnly) {
        const freeNowIds = await fetchFreeNowIds();
        if (freeNowIds) {
          next = next.filter((person) => freeNowIds.has(person.id));
        }
      }
      next = next.filter((person) => person.id !== user?.id);
      next = next.filter((person) => relationshipMap[person.id] !== 'accepted');

      const seen = new Set();
      next = next.filter((person) => {
        if (!person?.id) return false;
        if (seen.has(person.id)) return false;
        seen.add(person.id);
        return true;
      });

      const signed = await Promise.all(
        next.map(async (person) => {
          if (person?.avatar_path) {
            const { data: signedData } = await supabase
              .storage
              .from('avatars')
              .createSignedUrl(person.avatar_path, 60 * 60 * 24 * 30);
            return {
              ...person,
              avatar_url: signedData?.signedUrl || person.avatar_url || '',
            };
          }
          if (person?.avatar_url && !/^https?:\/\//i.test(person.avatar_url)) {
            const { data: signedData } = await supabase
              .storage
              .from('avatars')
              .createSignedUrl(person.avatar_url, 60 * 60 * 24 * 30);
            return {
              ...person,
              avatar_url: signedData?.signedUrl || person.avatar_url || '',
            };
          }
          return person;
        })
      );

      setPeople(uniqueById(signed));
    }
    setLastReload(new Date());
    setIsReloading(false);
  }, [campus, fetchFreeNowIds, freeNowOnly, relationshipMap, user?.id]);

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
          <Text style={styles.kicker}>link with other students</Text>
          <Text style={styles.title}>Link</Text>
          <Text style={styles.subtitle}>{timeLabel}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
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
        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>Friends</Text>

          <View style={styles.sectionGroup}>
            <Text style={styles.sectionSubtitle}>Add friend</Text>
            <View style={styles.addRow}>
              <TextInput
                style={styles.input}
                placeholder="Search by username or name"
                placeholderTextColor={colors.textPrimary}
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
                <Text style={styles.searchText}>Searching…</Text>
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
          </View>

          <View style={styles.sectionGroup}>
            <View style={styles.sectionBox}>
              <TouchableOpacity style={styles.friendsHeader} onPress={() => setRequestsOpen((prev) => !prev)}>
                <Text style={styles.sectionSubtitle}>Friend requests</Text>
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
                    <Text style={styles.emptyText}>No friend requests for now.</Text>
                  )}
                </ScrollView>
              )}
            </View>
          </View>

          <View style={styles.sectionGroup}>
            <View style={styles.sectionBox}>
              <TouchableOpacity style={styles.friendsHeader} onPress={() => setFriendsOpen((prev) => !prev)}>
                <View style={styles.friendStack}>
                  <View style={styles.friendAvatar} />
                  <View style={[styles.friendAvatar, styles.friendAvatarOverlap]} />
                </View>
                <Text style={styles.sectionSubtitle}>Friends</Text>
                <Text style={styles.dropdownIcon}>{friendsOpen ? '-' : '+'}</Text>
              </TouchableOpacity>
              {friendsOpen && (
                <ScrollView style={styles.friendsList} contentContainerStyle={styles.friendsListContent}>
                  {friends.map((friend) => (
                    <View key={`friend-${friend.id}`} style={styles.friendRow}>
                      <TouchableOpacity
                        style={styles.friendInfo}
                        onPress={() => openFriendSheet(friend)}
                      >
                        <Text style={styles.friendName} numberOfLines={1} ellipsizeMode="tail">
                          {friend.full_name || friend.username}
                        </Text>
                        {friend.username ? (
                          <Text style={styles.friendMeta} numberOfLines={1} ellipsizeMode="tail">
                            @{friend.username}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                      <View style={styles.friendActions}>
                        <TouchableOpacity style={styles.friendActionBtn} onPress={() => handleRemove(friend.id)}>
                          <Text style={styles.friendActionText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>Discover</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.sectionSubtitle}>Free now only</Text>
              <Text style={styles.rowMeta}>Show people free at this moment.</Text>
            </View>
            <Switch
              value={freeNowOnly}
              onValueChange={setFreeNowOnly}
              thumbColor={freeNowOnly ? colors.accentFree : colors.textSecondary}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: 'rgba(124,246,231,0.35)' }}
            />
          </View>

          <Text style={styles.sectionSubtitle}>Campus</Text>
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

          <ScrollView style={styles.peopleScroll} contentContainerStyle={styles.peopleList}>
            {people.length ? (
              people.map((person) => (
                <PersonCard
                  key={`person-${person.id}`}
                  person={person}
                  onAddFriend={handleQuickAdd}
                  onUndo={handleUndoRequest}
                  relation={relationshipMap[person.id]}
                  pendingIds={pendingRequestIds}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>No discoverable users yet.</Text>
            )}
          </ScrollView>
        </GlassCard>
      </ScrollView>

      <NavBar current={current} onNavigate={onNavigate} onBack={onBack} />

      <Modal transparent visible={friendSheetOpen} animationType="slide">
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeFriendSheet} />
          <View style={styles.sheetCard}>
            {friendDetailLoading ? (
              <View style={styles.sheetLoading}>
                <ActivityIndicator color={colors.textPrimary} size="small" />
                <Text style={styles.sheetLoadingText}>Loading friend…</Text>
              </View>
            ) : (
              <View style={styles.sheetContent}>
                <View style={styles.sheetHeader}>
                  {friendDetail?.avatar_url && friendDetail.avatar_url.trim() && !friendAvatarFailed ? (
                    <Image
                      source={{ uri: friendDetail.avatar_url.trim() }}
                      style={styles.sheetAvatar}
                      resizeMode="cover"
                      onError={() => setFriendAvatarFailed(true)}
                    />
                  ) : (
                    <View style={styles.sheetAvatarFallback}>
                      <Text style={styles.sheetAvatarText}>{getInitials(friendDetail)}</Text>
                    </View>
                  )}
                  <View style={styles.sheetTitle}>
                    <Text style={styles.sheetName} numberOfLines={1} ellipsizeMode="tail">
                      {friendDetail?.full_name || friendDetail?.username || 'Friend'}
                    </Text>
                    {friendDetail?.username ? (
                      <Text style={styles.sheetHandle} numberOfLines={1} ellipsizeMode="tail">
                        @{friendDetail.username}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={[styles.sheetIgBtn, !friendDetail?.ig_handle && styles.sheetIgBtnDisabled]}
                    onPress={() => openInstagram(friendDetail?.ig_handle || '')}
                    disabled={!friendDetail?.ig_handle}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Image source={require('../../assets/ig-logo.png')} style={styles.sheetIgIcon} />
                  </TouchableOpacity>
                </View>

                <View style={styles.sheetMeta}>
                  <Text style={styles.sheetMetaText} numberOfLines={2} ellipsizeMode="tail">
                    {(friendDetail?.major || 'Major')} | {(friendDetail?.year || 'Year')}
                  </Text>
                  <Text style={styles.sheetMetaText} numberOfLines={1} ellipsizeMode="tail">
                    {friendDetail?.campus || 'Campus'}
                  </Text>
                </View>

                {friendDetail?.hobbies?.length ? (
                  <View style={styles.sheetHobbies}>
                    {friendDetail.hobbies.slice(0, 6).map((hobby) => (
                      <View key={`friend-hobby-${hobby}`} style={styles.hobbyPill}>
                        <Text style={styles.hobbyText} numberOfLines={1} ellipsizeMode="tail">
                          {hobby}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.sheetRemoveBtn} onPress={() => handleRemove(friendDetail?.id)}>
                    <Text style={styles.sheetRemoveText}>Remove friend</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeFriendSheet}>
                    <Text style={styles.sheetCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    color: colors.textPrimary,
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
    color: colors.textPrimary,
    marginTop: spacing.xs,
    fontFamily: typography.body,
  },
  content: {
    paddingBottom: 180,
    gap: spacing.sm,
  },
  card: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: typography.bodySemi,
  },
  sectionSubtitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: typography.bodyMedium,
  },
  rowMeta: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: typography.body,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  toggleText: {
    flex: 1,
    paddingRight: spacing.md,
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
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: typography.body,
  },
  filterTextActive: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemi,
  },
  sectionGroup: {
    marginTop: spacing.xs,
    gap: spacing.xs,
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
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  searchText: {
    color: colors.textPrimary,
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
    color: colors.textPrimary,
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
  sectionBox: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  friendInfo: {
    flex: 1,
    minWidth: 0,
  },
  friendName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: typography.bodyMedium,
  },
  friendMeta: {
    color: colors.textPrimary,
    fontSize: 11,
    fontFamily: typography.body,
    marginTop: 2,
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
    color: colors.textPrimary,
    fontSize: 11,
    fontFamily: typography.bodyMedium,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  peopleScroll: {
    maxHeight: 420,
  },
  peopleList: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  personCard: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingRight: 72,
    position: 'relative',
  },
  personMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: -4,
    marginLeft: -4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginTop: -8,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: typography.bodySemi,
  },
  personInfo: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: typography.bodySemi,
  },
  personMeta: {
    color: colors.textPrimary,
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
    maxWidth: 120,
  },
  hobbyText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontFamily: typography.bodyMedium,
  },
  igBadge: {
    position: 'absolute',
    right: spacing.md,
    top: 38,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  igBadgeDisabled: {
    opacity: 0.6,
  },
  igLogo: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  igLogoImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  personActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
    marginLeft: -10,
  },
  personAddBtnInline: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentFree,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  personAddText: {
    color: '#1B1530',
    fontFamily: typography.bodySemi,
    fontSize: 11,
  },
  personAddBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  personAddTextDisabled: {
    color: colors.textPrimary,
  },
  personUndoBtn: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  personUndoText: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemi,
    fontSize: 11,
  },
  emptyText: {
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(12,8,24,0.6)',
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetCard: {
    backgroundColor: 'rgba(30,20,52,0.98)',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
  },
  sheetLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sheetLoadingText: {
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  sheetContent: {
    gap: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sheetAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  sheetAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetAvatarText: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemi,
    fontSize: 16,
  },
  sheetTitle: {
    flex: 1,
    minWidth: 0,
  },
  sheetName: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemi,
    fontSize: 16,
  },
  sheetHandle: {
    color: colors.textPrimary,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7,
  },
  sheetIgBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetIgBtnDisabled: {
    opacity: 0.6,
  },
  sheetIgIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  sheetMeta: {
    gap: spacing.xs,
  },
  sheetMetaText: {
    color: colors.textPrimary,
    fontFamily: typography.body,
    fontSize: 12,
  },
  sheetHobbies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sheetRemoveBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  sheetRemoveText: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemi,
  },
  sheetCloseBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  sheetCloseText: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemi,
    opacity: 0.7,
  },
});

module.exports = LinkScreen;
