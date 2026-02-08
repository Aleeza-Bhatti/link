const React = require('react');
const {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  Modal,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} = require('react-native');
const { LinearGradient } = require('expo-linear-gradient');
const GlassCard = require('../components/GlassCard');
const NavBar = require('../components/NavBar');
const BackgroundOrbs = require('../components/BackgroundOrbs');
const LogoBadge = require('../components/LogoBadge');
const { colors, gradients, spacing, radii, typography } = require('../theme');
const { supabase } = require('../lib/supabase');
const Linking = require('expo-linking');

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const scheduleStartHour = 8;
const scheduleEndHour = 20;
const visualHeight = 320;
const visualHourHeight = visualHeight / (scheduleEndHour - scheduleStartHour);
const hourStep = 2;

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

const normalizeTime = (value) => {
  if (!value) return null;
  const cleaned = value.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
  const ampmMatch = cleaned.match(/(am|pm)$/);
  const suffix = ampmMatch ? ampmMatch[1] : null;
  const core = suffix ? cleaned.replace(/(am|pm)$/, '') : cleaned;

  // Accept: 530, 0530, 5:30, 05:30, 5, 5:30pm, 530pm, 5pm
  let h = '';
  let m = '';
  let s = '';

  if (/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(core)) {
    const parts = core.split(':');
    h = parts[0];
    m = parts[1] || '0';
    s = parts[2] || '0';
  } else if (/^\d{3,4}$/.test(core)) {
    h = core.slice(0, core.length - 2);
    m = core.slice(-2);
  } else if (/^\d{1,2}$/.test(core)) {
    h = core;
    m = '0';
  } else {
    return null;
  }

  let hours = Number(h);
  const minutes = Number(m);
  const seconds = Number(s || '0');
  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
  if (minutes > 59 || seconds > 59) return null;

  if (suffix) {
    if (hours < 1 || hours > 12) return null;
    if (suffix === 'pm' && hours < 12) hours += 12;
    if (suffix === 'am' && hours === 12) hours = 0;
  }

  if (hours > 23) return null;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const isManualSource = (value) => (value || '').startsWith('manual:');

const minutesToTime = (minutes) => {
  if (minutes === null || minutes === undefined) return '';
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};




const normalizeTitle = (title) => {
  const cleaned = (title || '').trim().replace(/\s+/g, ' ');
  const withoutSuffix = cleaned.split(':')[0].trim();
  const match = withoutSuffix.match(/[A-Z]{1,4}(?:\s+[A-Z]{1,4})?\s+\d{3}[A-Z]?/i);
  if (match) {
    return match[0].toUpperCase().replace(/\s+/g, ' ');
  }
  return withoutSuffix || cleaned;
};

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
    if (item?.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
};


function ProfileScreen({ current, onNavigate, onBack, user, onEditProfile }) {
  const [discoverable, setDiscoverable] = React.useState(false);
  const [hideAll, setHideAll] = React.useState(false);
  const [friendsOpen, setFriendsOpen] = React.useState(false);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [friends, setFriends] = React.useState([]);
  const [pendingIn, setPendingIn] = React.useState([]);
  const [pendingOut, setPendingOut] = React.useState([]);
  const [hiddenIds, setHiddenIds] = React.useState([]);
  const [usernameInput, setUsernameInput] = React.useState('');
  const [friendStatus, setFriendStatus] = React.useState('');
  const [pendingRequestIds, setPendingRequestIds] = React.useState([]);
  const [relationshipMap, setRelationshipMap] = React.useState({});
  const [showLogout, setShowLogout] = React.useState(false);
  const [profile, setProfile] = React.useState(null);
  const [avatarFailed, setAvatarFailed] = React.useState(false);

  const [searchResults, setSearchResults] = React.useState([]);
  const [searching, setSearching] = React.useState(false);
  const [scheduleBlocks, setScheduleBlocks] = React.useState([]);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [manualTitle, setManualTitle] = React.useState('');
  const [manualDays, setManualDays] = React.useState([0]);
  const [manualStart, setManualStart] = React.useState('');
  const [manualEnd, setManualEnd] = React.useState('');
  const [manualStatus, setManualStatus] = React.useState('');
  const [manualSaving, setManualSaving] = React.useState(false);
  const [manualEditingSource, setManualEditingSource] = React.useState('');
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(280, width - spacing.lg * 2);
  
  const groupedSchedule = React.useMemo(() => {
    const map = new Map();
    scheduleBlocks.forEach((block) => {
      const normalizedTitle = normalizeTitle(block.title);
      const key = `${normalizedTitle}|${block.startMinutes}|${block.endMinutes}|${block.source || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          title: normalizedTitle || block.title,
          startMinutes: block.startMinutes,
          endMinutes: block.endMinutes,
          source: block.source || '',
          days: [],
        });
      }
      map.get(key).days.push(block.day);
    });

    return Array.from(map.values()).map((item) => {
      const dayList = Array.from(new Set(item.days)).sort((a, b) => a - b);
      const dayLabels = dayList
        .slice()
        .map((idx) => days[idx])
        .filter(Boolean)
        .join('/');
      return {
        title: item.title,
        timeLabel: `${formatTime(item.startMinutes)}-${formatTime(item.endMinutes)}`,
        dayLabel: dayLabels || 'Day',
        days: dayList,
        source: item.source,
      };
    });
  }, [scheduleBlocks]);

  const manualGroupsBySource = React.useMemo(() => {
    const map = {};
    groupedSchedule.forEach((item) => {
      if (isManualSource(item.source)) {
        map[item.source] = item;
      }
    });
    return map;
  }, [groupedSchedule]);

  const pagerTouchStart = React.useRef({ x: 0, y: 0 });
  const handlePagerStart = (event) => {
    const { pageX, pageY } = event.nativeEvent;
    pagerTouchStart.current = { x: pageX, y: pageY };
    return false;
  };
  const handlePagerMove = (event) => {
    const { pageX, pageY } = event.nativeEvent;
    const dx = Math.abs(pageX - pagerTouchStart.current.x);
    const dy = Math.abs(pageY - pagerTouchStart.current.y);
    return dx > dy && dx > 6;
  };

  const handlePage = (event) => {
    const x = event.nativeEvent.contentOffset.x;
    const next = Math.round(x / pageWidth);
    setPageIndex(next);
  };

  const loadProfile = React.useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (data) {
      let signedAvatarUrl = (data.avatar_url || '').trim();
      if (data.avatar_path) {
        try {
          const { data: signed } = await supabase
            .storage
            .from('avatars')
            .createSignedUrl(data.avatar_path, 60 * 60 * 24 * 30);
          signedAvatarUrl = (signed?.signedUrl || signedAvatarUrl || '').trim();
        } catch (err) {
          signedAvatarUrl = signedAvatarUrl || '';
        }
      }
      setProfile({ ...data, avatar_url: signedAvatarUrl });
      setAvatarFailed(false);
      setDiscoverable(Boolean(data.discoverable));
      setHideAll(Boolean(data.hide_schedule));
    }
  }, [user?.id]);

  const loadSchedules = React.useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('classes')
      .select('id, title, day, start_time, end_time, source')
      .eq('user_id', user.id);

    const mapped = (data || [])
      .map((row) => {
        const startMinutes = timeToMinutes(row.start_time);
        const endMinutes = timeToMinutes(row.end_time);
        if (startMinutes === null || endMinutes === null) return null;
        return {
          id: row.id,
          title: row.title,
          day: row.day,
          dayLabel: days[row.day] || 'Day',
          startMinutes,
          endMinutes,
          timeLabel: `${formatTime(startMinutes)}-${formatTime(endMinutes)}`,
          source: row.source || '',
        };
      })
      .filter(Boolean)
      .filter((block) => block.day >= 0 && block.day <= 4);

    const seen = new Set();
    const unique = [];
    mapped.forEach((block) => {
      const key = `${block.title}|${block.day}|${block.startMinutes}|${block.endMinutes}|${block.source || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(block);
      }
    });

    setScheduleBlocks(unique);
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

  React.useEffect(() => {
    loadProfile();
    loadSchedules();
  }, [loadProfile, loadSchedules]);

  React.useEffect(() => {
    if (current === 'Profile') {
      loadProfile();
    }
  }, [current, loadProfile]);



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
  // TODO: Per-friend hide is disabled for now; we'll reintroduce later.

  const resetManualForm = () => {
    setManualTitle('');
    setManualDays([0]);
    setManualStart('');
    setManualEnd('');
    setManualStatus('');
    setManualSaving(false);
    setManualEditingSource('');
  };

  const closeManualSheet = () => {
    setManualOpen(false);
    resetManualForm();
  };

  const openManualSheet = (seed) => {
    if (seed) {
      setManualTitle(seed.title || '');
      setManualDays(seed.days?.length ? seed.days.slice() : [0]);
      setManualStart(seed.start || '');
      setManualEnd(seed.end || '');
      setManualEditingSource(seed.source || '');
    } else {
      resetManualForm();
    }
    setManualOpen(true);
  };

  const handleSaveManual = async () => {
    if (!user?.id) return;
    const title = manualTitle.trim();
    const start = normalizeTime(manualStart);
    const end = normalizeTime(manualEnd);
    if (!manualDays.length) {
      setManualStatus('Select at least one day.');
      return;
    }
    if (!title) {
      setManualStatus('Add a title.');
      return;
    }
    if (!start || !end) {
      setManualStatus('Enter a time like 530pm, 5:30pm, or 17:30.');
      return;
    }
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    if (startMin === null || endMin === null || endMin <= startMin) {
      setManualStatus('End time must be after start time.');
      return;
    }
    setManualSaving(true);
    setManualStatus('');
    const source = manualEditingSource || `manual:${Date.now()}`;
    const daysToSave = Array.from(new Set(manualDays)).sort((a, b) => a - b);

    if (manualEditingSource) {
      const { error: deleteError } = await supabase
        .from('classes')
        .delete()
        .match({ user_id: user.id, source: manualEditingSource });
      if (deleteError) {
        setManualStatus(deleteError.message);
        setManualSaving(false);
        return;
      }
    }

    const { error } = await supabase.from('classes').insert(
      daysToSave.map((day) => ({
        user_id: user.id,
        title,
        day,
        start_time: start,
        end_time: end,
        source,
      }))
    );
    if (error) {
      setManualStatus(error.message);
      setManualSaving(false);
      return;
    }
    await loadSchedules();
    closeManualSheet();
  };

  const handleRemoveManual = async () => {
    if (!user?.id || !manualEditingSource) return;
    setManualSaving(true);
    const { error } = await supabase
      .from('classes')
      .delete()
      .match({ user_id: user.id, source: manualEditingSource });
    if (error) {
      setManualStatus(error.message);
      setManualSaving(false);
      return;
    }
    await loadSchedules();
    closeManualSheet();
  };

  const updateHideAll = async (nextValue) => {
    setHideAll(nextValue);
    if (!user?.id) return;
    await supabase.from('profiles').update({ hide_schedule: nextValue }).eq('id', user.id);
  };

  const updateDiscoverable = async (nextValue) => {
    setDiscoverable(nextValue);
    if (!user?.id) return;
    await supabase.from('profiles').update({ discoverable: nextValue }).eq('id', user.id);
  };

  const handleLogout = async () => {
    setShowLogout(false);
    await supabase.auth.signOut();
  };

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'LS';
  const igHandle = profile?.ig_handle || (profile?.username ? `@${profile.username}` : '');

  return (
    <LinearGradient colors={gradients.background} style={styles.container}>
      <BackgroundOrbs />
      <LogoBadge />
      <View style={styles.header}>
        <Text style={styles.kicker}>Your space</Text>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Personal schedule + privacy in one place.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard style={[styles.card, styles.aboutCard]}>
          <Text style={styles.sectionTitle}>About you</Text>
          <View style={styles.aboutRow}>
            {profile?.avatar_url && profile.avatar_url.trim() && !avatarFailed ? (
              <Image
                source={{ uri: profile.avatar_url.trim() }}
                style={styles.avatar}
                resizeMode="cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.aboutText}>
              <Text style={styles.aboutName} numberOfLines={1} ellipsizeMode="tail">
                {profile?.full_name || 'Your name'}
              </Text>
              <Text style={styles.aboutMeta} numberOfLines={1} ellipsizeMode="tail">
                @{profile?.username || 'username'}
              </Text>
              <Text style={styles.aboutMeta} numberOfLines={1} ellipsizeMode="tail">
                {profile?.major || 'Major'} | {profile?.year || 'Year'}
              </Text>
              <Text style={styles.aboutMeta} numberOfLines={1} ellipsizeMode="tail">
                {profile?.campus || 'Campus'}
              </Text>
              <Text style={styles.aboutMeta} numberOfLines={1} ellipsizeMode="tail">
                {profile?.email || 'email@uw.edu'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.igBadge, !igHandle && styles.igBadgeDisabled]}
              onPress={() => openInstagram(igHandle)}
              disabled={!igHandle}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.igLogo}>
                <Image source={require('../../assets/ig-logo.png')} style={styles.igLogoImage} />
              </View>
            </TouchableOpacity>
          </View>
          {profile?.hobbies?.length ? (
            <View style={styles.hobbiesRow}>
              {profile.hobbies.map((hobby) => (
                <View key={hobby} style={styles.hobbyPill}>
                  <Text style={styles.hobbyText} numberOfLines={1} ellipsizeMode="tail">
                    {hobby}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </GlassCard>

        <GlassCard style={styles.card}>
          <View style={styles.scheduleHeader}>
            <Text style={styles.sectionTitle}>My schedule</Text>
            <TouchableOpacity style={styles.addScheduleBtn} onPress={() => openManualSheet()}>
              <Text style={styles.addScheduleText}>+ Add schedule item</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.pagerWrap}>
            <ScrollView
              horizontal
              onStartShouldSetResponderCapture={handlePagerStart}
              onMoveShouldSetResponderCapture={handlePagerMove}
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handlePage}
              snapToInterval={pageWidth}
              decelerationRate="fast"
              directionalLockEnabled
            >
              <View style={[styles.scheduleCard, { width: pageWidth }]}>
                <ScrollView
                  style={styles.scheduleList}
                  contentContainerStyle={styles.scheduleListContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  onStartShouldSetResponderCapture={() => true}
                  onMoveShouldSetResponderCapture={() => true}
                >
                  {groupedSchedule.length ? (
                    groupedSchedule.map((block) => {
                      const isManual = isManualSource(block.source);
                      return (
                        <TouchableOpacity
                          key={`${block.title}-${block.timeLabel}-${block.dayLabel}`}
                          style={[styles.courseCard, isManual && styles.courseCardManual]}
                          onPress={() => {
                            if (isManual) {
                              openManualSheet({
                                title: block.title,
                                start: minutesToTime(block.startMinutes),
                                end: minutesToTime(block.endMinutes),
                                days: block.days,
                                source: block.source,
                              });
                            }
                          }}
                          disabled={!isManual}
                        >
                          <View style={styles.courseHeader}>
                            <Text style={styles.rowTitle}>{block.title}</Text>
                            {isManual ? <Text style={styles.manualBadge}>Manual</Text> : null}
                          </View>
                          <Text style={styles.rowMeta}>{block.dayLabel} - {block.timeLabel}</Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyText}>No classes imported yet.</Text>
                  )}
                </ScrollView>
              </View>

              <View style={[styles.scheduleCard, { width: pageWidth }]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.visualGrid}
                  nestedScrollEnabled
                >
                  <View style={styles.timeColumn}>
                    {Array.from(
                      { length: Math.floor((scheduleEndHour - scheduleStartHour) / hourStep) + 1 },
                      (_, idx) => scheduleStartHour + idx * hourStep
                    ).map((hour) => (
                      <Text key={hour} style={[styles.timeLabel, { height: visualHourHeight * hourStep }]}>
                        {formatTime(hour * 60)}
                      </Text>
                    ))}
                  </View>
                  {days.map((day, idx) => (
                    <View key={day} style={styles.visualDay}>
                      <Text style={styles.visualDayLabel}>{day}</Text>
                      <View style={[styles.visualDayColumn, { height: visualHeight }]}>
                        {scheduleBlocks
                          .filter((block) => block.day === idx)
                          .map((block) => {
                            const minStart = scheduleStartHour * 60;
                            const minEnd = scheduleEndHour * 60;
                            const clampedStart = Math.max(minStart, block.startMinutes);
                            const clampedEnd = Math.min(minEnd, block.endMinutes);
                            if (clampedEnd <= clampedStart) return null;
                            const top = ((clampedStart - minStart) / 60) * visualHourHeight;
                            const height = ((clampedEnd - clampedStart) / 60) * visualHourHeight;
                            const isManual = isManualSource(block.source);
                            return (
                              <TouchableOpacity
                                key={block.id}
                                style={[
                                  styles.visualBlock,
                                  { top, height },
                                  isManual && styles.visualBlockManual,
                                ]}
                                activeOpacity={isManual ? 0.8 : 1}
                                onPress={() => {
                                  if (!isManual) return;
                                  const group = manualGroupsBySource[block.source];
                                  openManualSheet({
                                    title: block.title,
                                    start: minutesToTime(block.startMinutes),
                                    end: minutesToTime(block.endMinutes),
                                    days: group?.days || [block.day],
                                    source: block.source,
                                  });
                                }}
                              >
                                <Text style={styles.visualTitle}>{normalizeTitle(block.title)}</Text>
                              </TouchableOpacity>
                            );
                          })}
                      </View>
                    </View>
                  ))}
                </ScrollView>
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
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.rowTitle}>Discoverable on campus</Text>
              <Text style={styles.rowMeta}>Let other users find me.</Text>
            </View>
            <Switch
              value={discoverable}
              onValueChange={updateDiscoverable}
              thumbColor={discoverable ? colors.accentFree : colors.textSecondary}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: 'rgba(124,246,231,0.35)' }}
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.rowTitle}>Hide entire schedule</Text>
              <Text style={styles.rowMeta}>Friends won't see your schedule.</Text>
            </View>
            <Switch
              value={hideAll}
              onValueChange={updateHideAll}
              thumbColor={hideAll ? colors.accentFree : colors.textSecondary}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: 'rgba(124,246,231,0.35)' }}
            />
          </View>
        </GlassCard>

        <View style={styles.footerActions}>
          <TouchableOpacity style={styles.footerBtn} onPress={onEditProfile}>
            <Text style={styles.footerBtnText}>Update profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerBtn} onPress={() => setShowLogout(true)}>
            <Text style={styles.footerBtnText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <NavBar current={current} onNavigate={onNavigate} onBack={onBack} />

      <Modal transparent visible={manualOpen} animationType="slide">
        <View style={styles.sheetOverlay} pointerEvents="box-none">
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeManualSheet} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
          >
            <ScrollView
              style={styles.sheetCard}
              contentContainerStyle={styles.sheetCardContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sheetTitle}>
                {manualEditingSource ? 'Edit schedule item' : 'Add schedule item'}
              </Text>
              <Text style={styles.sheetSubtitle}>Create a custom block for work, clubs, or anything else.</Text>

              <Text style={styles.sheetLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Club meeting"
                placeholderTextColor={colors.textSecondary}
                value={manualTitle}
                onChangeText={setManualTitle}
                autoFocus
                returnKeyType="next"
                blurOnSubmit={false}
              />

              <Text style={styles.sheetLabel}>Day</Text>
              <View style={styles.sheetDayRow}>
                {days.map((day, idx) => (
                  <TouchableOpacity
                    key={`manual-day-${day}`}
                    style={[styles.sheetDayChip, manualDays.includes(idx) && styles.sheetDayChipActive]}
                    onPress={() => {
                      setManualDays((prev) => (
                        prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
                      ));
                    }}
                  >
                    <Text style={[styles.sheetDayText, manualDays.includes(idx) && styles.sheetDayTextActive]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.sheetTimeRow}>
                <View style={styles.sheetTimeField}>
                  <Text style={styles.sheetLabel}>Start</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="09:00"
                    placeholderTextColor={colors.textSecondary}
                    value={manualStart}
                    onChangeText={setManualStart}
                    keyboardType="numbers-and-punctuation"
                    returnKeyType="next"
                    blurOnSubmit={false}
                  />
                </View>
                <View style={styles.sheetTimeField}>
                  <Text style={styles.sheetLabel}>End</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="10:30"
                    placeholderTextColor={colors.textSecondary}
                    value={manualEnd}
                    onChangeText={setManualEnd}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              {manualStatus ? <Text style={styles.statusError}>{manualStatus}</Text> : null}

              <View style={styles.sheetActions}>
                <TouchableOpacity style={styles.sheetBtn} onPress={closeManualSheet} disabled={manualSaving}>
                  <Text style={styles.sheetBtnText}>Cancel</Text>
                </TouchableOpacity>
                {manualEditingSource ? (
                  <TouchableOpacity
                    style={[styles.sheetBtnDanger, manualSaving && styles.sheetBtnDisabled]}
                    onPress={handleRemoveManual}
                    disabled={manualSaving}
                  >
                    <Text style={styles.sheetBtnDangerText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.sheetBtnPrimary, manualSaving && styles.sheetBtnDisabled]}
                  onPress={handleSaveManual}
                  disabled={manualSaving}
                >
                  <Text style={styles.sheetBtnPrimaryText}>{manualSaving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal transparent visible={showLogout} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log out?</Text>
            <Text style={styles.modalText}>You can sign back in anytime.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setShowLogout(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleLogout}>
                <Text style={styles.modalBtnPrimaryText}>Log out</Text>
              </TouchableOpacity>
            </View>
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
    paddingBottom: 200,
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  addScheduleBtn: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  addScheduleText: {
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium,
    fontSize: 11,
  },
  aboutCard: {
    position: 'relative',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: typography.bodySemi,
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: typography.body,
    marginTop: spacing.sm,
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
  statusError: {
    color: '#FFB7E3',
    fontFamily: typography.body,
    fontSize: 12,
  },
  pagerWrap: {
    overflow: 'hidden',
  },
  scheduleCard: {
    gap: spacing.sm,
  },
  scheduleList: {
    maxHeight: visualHeight,
  },
  scheduleListContent: {
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
  courseCardManual: {
    borderColor: colors.accentFree,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  manualBadge: {
    color: colors.accentFree,
    fontSize: 10,
    fontFamily: typography.bodySemi,
  },
  visualGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingRight: spacing.lg,
  },
  timeColumn: {
    width: 56,
    alignItems: 'flex-end',
    paddingTop: 16,
    paddingRight: 6,
  },
  timeLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: typography.body,
    textAlign: 'right',
    width: 50,
  },
  visualDay: {
    flex: 1,
    minWidth: 70,
  },
  visualDayLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: typography.bodyMedium,
    textAlign: 'center',
    marginBottom: 4,
  },
  visualDayColumn: {
    height: 320,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  visualBlock: {
    position: 'absolute',
    left: 4,
    right: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(124,246,231,0.2)',
    borderWidth: 1,
    borderColor: colors.accentFree,
    padding: 4,
  },
  visualBlockManual: {
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  visualTitle: {
    color: colors.textPrimary,
    fontSize: 9,
    fontFamily: typography.bodySemi,
    lineHeight: 12,
  },
  visualTime: {
    color: colors.textSecondary,
    fontSize: 8,
    fontFamily: typography.body,
    marginTop: 2,
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
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  addBtn: {
    backgroundColor: colors.accentFree,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  addBtnText: {
    color: '#1B1530',
    fontFamily: typography.bodySemi,
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
  status: {
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
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
  sectionBlock: {
    marginTop: spacing.sm,
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
    maxHeight: 200,
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
  pendingLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: typography.body,
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
  footerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  footerBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  footerBtnText: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemi,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontFamily: typography.heading,
  },
  igBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
    width: 48,
    height: 48,
    borderRadius: 24,
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
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  igLogoImage: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  aboutText: {
    flex: 1,
    minWidth: 0,
  },
  aboutName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: typography.bodySemi,
  },
  aboutMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: typography.body,
    marginTop: 2,
  },
  hobbiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  hobbyPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 140,
  },
  hobbyText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontFamily: typography.bodyMedium,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: typography.body,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12,8,24,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(12,8,24,0.6)',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheetCard: {
    backgroundColor: 'rgba(30,20,52,0.98)',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    maxHeight: 520,
  },
  sheetCardContent: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 18,
  },
  sheetSubtitle: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 12,
  },
  sheetLabel: {
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  sheetDayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sheetDayChip: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  sheetDayChipActive: {
    backgroundColor: 'rgba(124,246,231,0.2)',
    borderColor: colors.accentFree,
  },
  sheetDayText: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 11,
  },
  sheetDayTextActive: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemi,
  },
  sheetTimeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sheetTimeField: {
    flex: 1,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sheetBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  sheetBtnText: {
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium,
  },
  sheetBtnPrimary: {
    flex: 1,
    backgroundColor: colors.accentFree,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  sheetBtnPrimaryText: {
    color: '#1B1530',
    fontFamily: typography.bodySemi,
  },
  sheetBtnDanger: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  sheetBtnDangerText: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemi,
  },
  sheetBtnDisabled: {
    opacity: 0.7,
  },
  modalCard: {
    width: '100%',
    backgroundColor: 'rgba(30,20,52,0.95)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: typography.heading,
  },
  modalText: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontFamily: typography.body,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalBtn: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  modalBtnText: {
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium,
  },
  modalBtnPrimary: {
    backgroundColor: colors.accentFree,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  modalBtnPrimaryText: {
    color: '#1B1530',
    fontFamily: typography.bodySemi,
  },
});

module.exports = ProfileScreen;
















