const React = require('react');
const { View, Text, StyleSheet, Switch, TextInput, ScrollView, TouchableOpacity, Image } = require('react-native');
const { LinearGradient } = require('expo-linear-gradient');
const ImagePicker = require('expo-image-picker');
const DocumentPicker = require('expo-document-picker');
const FileSystem = require('expo-file-system/legacy');
const GlassCard = require('../components/GlassCard');
const PrimaryButton = require('../components/PrimaryButton');
const NavBar = require('../components/NavBar');
const BackgroundOrbs = require('../components/BackgroundOrbs');
const LogoBadge = require('../components/LogoBadge');
const { colors, gradients, spacing, radii, typography } = require('../theme');
const { supabase } = require('../lib/supabase');
const { parseIcsToClasses, computeFreeBlocks } = require('../lib/ics');
const { majorsByCampus } = require('../data/majors');

const campuses = ['Seattle', 'Bothell', 'Tacoma'];
const years = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];

function OnboardingScreen({ current, onNavigate, onBack, user, onComplete }) {
  const [discoverable, setDiscoverable] = React.useState(false);
  const [email, setEmail] = React.useState(user?.email || '');
  const [icsLink, setIcsLink] = React.useState('');
  const [icsFileUri, setIcsFileUri] = React.useState('');
  const [icsFileName, setIcsFileName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [campus, setCampus] = React.useState('');
  const [major, setMajor] = React.useState('');
  const [showMajorList, setShowMajorList] = React.useState(false);
  const [year, setYear] = React.useState('');
  const [igHandle, setIgHandle] = React.useState('');
  const [avatarUrl, setAvatarUrl] = React.useState('');
  const [avatarPreviewUrl, setAvatarPreviewUrl] = React.useState('');
  const [avatarPath, setAvatarPath] = React.useState('');
  const [avatarUploading, setAvatarUploading] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [statusTone, setStatusTone] = React.useState('info');
  const [hobbies, setHobbies] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);

  const requiredReady = username && fullName && campus && major && year && email;
  const majorsForCampus = majorsByCampus[campus] || majorsByCampus.Seattle;
  const filteredMajors = majorsForCampus.filter((item) => item.toLowerCase().includes(major.toLowerCase()));


  React.useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setUsername(data.username || '');
        setFullName(data.full_name || '');
        setEmail(data.email || user.email || '');
        setCampus(data.campus || '');
        setMajor(data.major || '');
        setAvatarPath(data.avatar_path || '');
        setAvatarPreviewUrl('');
        if (data.avatar_path) {
          try {
            const { data: signed } = await supabase
              .storage
              .from('avatars')
              .createSignedUrl(data.avatar_path, 60 * 60 * 24 * 30);
            setAvatarUrl(signed?.signedUrl || data.avatar_url || '');
          } catch (err) {
            setAvatarUrl(data.avatar_url || '');
          }
        } else {
          setAvatarUrl(data.avatar_url || '');
        }
        setDirty(false);
        setYear(data.year || '');
        setIgHandle(data.ig_handle || '');
        setHobbies(Array.isArray(data.hobbies) ? data.hobbies.join(', ') : '');
        setDiscoverable(Boolean(data.discoverable));
      }

      const { data: importRow } = await supabase
        .from('schedule_imports')
        .select('ics_url')
        .eq('user_id', user.id)
        .single();

      if (importRow?.ics_url) {
        setIcsLink(importRow.ics_url);
      }
    };

    loadProfile();
  }, [user?.email, user?.id]);

  const handlePickIcs = async () => {
    setStatus('');
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/calendar', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;
    const file = result.assets && result.assets[0];
    if (!file?.uri) {
      setStatus('Could not load that file.');
      return;
    }

    setIcsFileUri(file.uri);
    setIcsFileName(file.name || 'Schedule.ics');
  };

  const handlePickAvatar = async () => {
    setStatus('Opening photo picker...');
    setStatusTone('info');
    const currentPerms = await ImagePicker.getMediaLibraryPermissionsAsync();
    let permissionStatus = currentPerms?.status || 'undetermined';
    if (permissionStatus === 'undetermined') {
      const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
      permissionStatus = requested?.status || permissionStatus;
    }
    if (permissionStatus !== 'granted' && permissionStatus !== 'limited') {
      setStatus('Photo access is required to select a profile photo.');
      setStatusTone('error');
      return;
    }
    let result;
    const pickerOptions = {
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };
    if (ImagePicker.MediaType?.Images) {
      pickerOptions.mediaTypes = [ImagePicker.MediaType.Images];
    }
    try {
      result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    } catch (err) {
      setStatus(`Photo picker failed to open. ${err?.message || ''}`.trim());
      setStatusTone('error');
      return;
    }

    if (result.canceled) return;
    const asset = result.assets && result.assets[0];
    if (!asset?.uri) {
      setStatus('Could not load that image.');
      setStatusTone('error');
      return;
    }

    if (!user?.id) return;
    setAvatarPreviewUrl(asset.uri);
    setAvatarUploading(true);
    try {
      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';
      let uploadBody = null;

      try {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        if (!base64) throw new Error('Empty image data');
        const binary = global.atob ? global.atob(base64) : atob(base64);
        const length = binary.length;
        const bytes = new Uint8Array(length);
        for (let i = 0; i < length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        uploadBody = bytes.buffer;
      } catch (readErr) {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        uploadBody = blob;
      }

      const { error: uploadError } = await supabase
        .storage
        .from('avatars')
        .upload(path, uploadBody, { contentType: mimeType, upsert: true });

      if (uploadError) throw uploadError;

    const { data, error: signedError } = await supabase
      .storage
      .from('avatars')
      .createSignedUrl(path, 60 * 60 * 24 * 30);
    if (signedError) {
      setStatus(`Photo saved, but preview failed: ${signedError.message}`);
      setStatusTone('error');
    }
    const signedUrl = data?.signedUrl || '';
    setAvatarPath(path);
    if (signedUrl) {
      setAvatarUrl(signedUrl);
    }
    setDirty(true);
    setStatus('Profile photo updated. Remember to save.');
    setStatusTone('info');
    } catch (err) {
      setStatus(`Photo upload failed. ${err?.message || ''}`.trim());
      setStatusTone('error');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    if (!requiredReady) {
      setStatus('Please fill all required fields.');
      setStatusTone('error');
      return;
    }
    const isRemoteUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);
    setSaving(true);
    setStatus('');
    let avatarUrlToSave = isRemoteUrl(avatarUrl) ? avatarUrl : null;
    if (avatarPath) {
      try {
        const { data: signed } = await supabase
          .storage
          .from('avatars')
          .createSignedUrl(avatarPath, 60 * 60 * 24 * 30);
        if (signed?.signedUrl) {
          avatarUrlToSave = signed.signedUrl;
          setAvatarUrl(signed.signedUrl);
        }
      } catch (err) {
        // keep avatarUrlToSave as-is
      }
    }
    const payload = {
      id: user.id,
      username: username.trim().toLowerCase(),
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      campus,
      major,
      year,
      ig_handle: igHandle.trim() || null,
      avatar_url: avatarUrlToSave,
      avatar_path: avatarPath || null,
      hobbies: hobbies
        ? hobbies.split(',').map((hobby) => hobby.trim()).filter(Boolean)
        : [],
      discoverable,
      verified_at: user.email_confirmed_at || null,
    };

    const { error } = await supabase.from('profiles').upsert(payload);
    if (error) {
      setStatus(error.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    setDirty(false);
    setStatusTone('info');
    if (onComplete) onComplete();
  };

  
  const handleSyncSchedule = async () => {
    if (!icsFileUri && !icsLink.trim()) {
      setStatus('Upload your myUW iCal file (.ics) first.');
      setStatusTone('error');
      return;
    }
    setStatus('');
    setSyncing(true);
    try {
      let icsText = '';
      if (icsFileUri) {
        icsText = await FileSystem.readAsStringAsync(icsFileUri, { encoding: 'utf8' });
      } else {
        const response = await fetch(icsLink.trim());
        icsText = await response.text();
      }

      const classes = parseIcsToClasses(icsText);
      const freeBlocks = computeFreeBlocks(classes);
    setStatus(`Parsed ${classes.length} classes. Saving...`);
    setStatusTone('info');

      await supabase.from('classes').delete().eq('user_id', user.id);
      await supabase.from('free_blocks').delete().eq('user_id', user.id);

      if (classes.length) {
        await supabase.from('classes').insert(
          classes.map((block) => ({
            ...block,
            user_id: user.id,
            source: 'ics',
          }))
        );
      }

      if (freeBlocks.length) {
        await supabase.from('free_blocks').insert(
          freeBlocks.map((block) => ({
            ...block,
            user_id: user.id,
          }))
        );
      }

      await supabase.from('schedule_imports').upsert({
        user_id: user.id,
        ics_url: icsLink.trim() || null,
        last_synced_at: new Date().toISOString(),
      });

      setStatus('Schedule synced.');
      setStatusTone('info');
    } catch (err) {
      setStatus(`Sync failed. ${err?.message || 'Check your iCal file.'}`);
      setStatusTone('error');
    } finally {
      setSyncing(false);
    }
  };


  const guardProfileChange = () => {
    if (!dirty) return true;
    setStatus('Please save profile before continuing.');
    setStatusTone('error');
    return false;
  };

  const handleGuardedNavigate = (next) => {
    if (!guardProfileChange()) return;
    onNavigate(next);
  };

  const handleGuardedBack = () => {
    if (!guardProfileChange()) return;
    onBack();
  };

  const renderChoiceRow = (values, selected, onPick) => (
    <View style={styles.choiceRow}>
      {values.map((item) => (
        <TouchableOpacity
          key={item}
          style={[styles.choiceChip, selected === item && styles.choiceChipActive]}
          onPress={() => onPick(item)}
        >
          <Text style={[styles.choiceText, selected === item && styles.choiceTextActive]}>{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <LinearGradient colors={gradients.background} style={styles.container}>
      <BackgroundOrbs />
      <LogoBadge />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Finish setup</Text>
          <Text style={styles.title}>Your profile</Text>
          <Text style={styles.subtitle}>Required fields help match schedules faster.</Text>
        </View>

                <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Required</Text>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="lynksarah"
            placeholderTextColor={colors.textSecondary}
            value={username}
            onChangeText={(value) => { setUsername(value); setDirty(true); }}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            placeholder="Sarah Lee"
            placeholderTextColor={colors.textSecondary}
            value={fullName}
            onChangeText={(value) => { setFullName(value); setDirty(true); }}
          />

          <Text style={styles.label}>UW Email</Text>
          <TextInput
            style={styles.input}
            placeholder="yourname@uw.edu"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={(value) => { setEmail(value); setDirty(true); }}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Campus</Text>
          {renderChoiceRow(campuses, campus, (value) => { setCampus(value); setDirty(true); })}

                    <Text style={styles.label}>Major</Text>
          <TextInput
            style={styles.input}
            placeholder="Computer Science"
            placeholderTextColor={colors.textSecondary}
            value={major}
            onChangeText={(value) => { setMajor(value); setDirty(true); }}
            onFocus={() => setShowMajorList(true)}
            onBlur={() => setShowMajorList(false)}
          />
          {showMajorList ? (
            <View style={styles.majorList}>
              <ScrollView style={styles.majorScroll}>
                {filteredMajors.length ? (
                  filteredMajors.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={styles.majorItem}
                      onPress={() => {
                        setMajor(item);
                        setDirty(true);
                        setShowMajorList(false);
                      }}
                    >
                      <Text style={styles.majorText}>{item}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.helper}>No matches. You can keep typing.</Text>
                )}
              </ScrollView>
            </View>
          ) : null}

          <Text style={styles.label}>Year</Text>
          {renderChoiceRow(years, year, (value) => { setYear(value); setDirty(true); })}
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Optional</Text>
          <Text style={styles.label}>Profile photo</Text>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={handlePickAvatar}
            onPressIn={() => {
              setStatus('Opening photo picker...');
              setStatusTone('info');
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            disabled={avatarUploading}
          >
            {avatarPreviewUrl || avatarUrl ? (
              <Image
                source={{ uri: avatarPreviewUrl || avatarUrl }}
                style={styles.avatarPreview}
                onError={() => {
                  if (!avatarPreviewUrl) setAvatarUrl('');
                }}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>{avatarUploading ? 'Uploading...' : 'Add photo'}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.label}>Instagram handle</Text>
          <TextInput
            style={styles.input}
            placeholder="@yours"
            placeholderTextColor={colors.textSecondary}
            value={igHandle}
            onChangeText={(value) => { setIgHandle(value); setDirty(true); }}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Hobbies (comma separated)</Text>
          <TextInput
            style={styles.input}
            placeholder="coffee, hiking"
            placeholderTextColor={colors.textSecondary}
            value={hobbies}
            onChangeText={(value) => { setHobbies(value); setDirty(true); }}
          />

          <Text style={styles.label}>myUW iCal file (.ics)</Text>
          <TouchableOpacity style={styles.fileBtn} onPress={handlePickIcs}>
            <Text style={styles.fileBtnText}>{icsFileName ? `Selected: ${icsFileName}` : 'Choose .ics file'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.syncBtn} onPress={handleSyncSchedule}>
            <Text style={styles.syncBtnText}>{syncing ? 'Syncing...' : 'Sync schedule now'}</Text>
          </TouchableOpacity>

          <View style={styles.rowBetween}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Discoverable on campus</Text>
              <Text style={styles.helper}>Off by default for privacy.</Text>
            </View>
            <Switch
              value={discoverable}
              onValueChange={(value) => { setDiscoverable(value); setDirty(true); }}
              thumbColor={discoverable ? colors.accentFree : colors.textSecondary}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: 'rgba(124,246,231,0.35)' }}
            />
          </View>

          <PrimaryButton label={saving ? 'Saving...' : 'Save profile'} onPress={handleSave} />
          {status ? <Text style={[styles.status, statusTone === 'error' && styles.statusError]}>{status}</Text> : null}
        </GlassCard>
      </ScrollView>

      <NavBar current={current} onNavigate={handleGuardedNavigate} onBack={handleGuardedBack} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 72,
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingBottom: 180,
  },
  header: {
    marginBottom: spacing.lg,
  },
  kicker: {
    color: colors.accentFree,
    fontSize: 12,
    fontFamily: typography.bodyMedium,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 36,
    fontFamily: typography.heading,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontSize: 14,
    fontFamily: typography.body,
  },
  card: {
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: typography.heading,
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: typography.bodyMedium,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  avatarButton: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  avatarPreview: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontFamily: typography.bodyMedium,
  },
  majorList: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  majorScroll: {
    maxHeight: 180,
  },
  majorItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  majorText: {
    color: colors.textPrimary,
    fontFamily: typography.body,
    fontSize: 12,
  },
  statusError: {
    color: '#FFB7E3',
  },
  input: {
    height: 46,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  fileBtn: {
    marginTop: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  fileBtnText: {
    color: colors.textPrimary,
    fontFamily: typography.body,
    fontSize: 13,
  },
  syncBtn: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.accentFree,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  syncBtnText: {
    color: '#1B1530',
    fontFamily: typography.bodySemi,
    fontSize: 14,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  choiceChip: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  choiceChipActive: {
    backgroundColor: 'rgba(124,246,231,0.2)',
    borderColor: colors.accentFree,
  },
  choiceText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: typography.body,
  },
  choiceTextActive: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemi,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  rowText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: typography.body,
  },
  status: {
    color: colors.textPrimary,
    marginTop: spacing.sm,
    fontFamily: typography.body,
  },
});

module.exports = OnboardingScreen;
