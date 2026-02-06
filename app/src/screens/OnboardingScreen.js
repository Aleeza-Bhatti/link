const React = require('react');
const { View, Text, StyleSheet, Switch, TextInput, ScrollView, TouchableOpacity } = require('react-native');
const { LinearGradient } = require('expo-linear-gradient');
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
  const [year, setYear] = React.useState('');
  const [igHandle, setIgHandle] = React.useState('');
  const [hobbies, setHobbies] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);

  const requiredReady = username && fullName && campus && major && year && email;

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

  const handleSave = async () => {
    if (!requiredReady) {
      setStatus('Please fill all required fields.');
      return;
    }
    setSaving(true);
    setStatus('');
    const payload = {
      id: user.id,
      username: username.trim().toLowerCase(),
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      campus,
      major,
      year,
      ig_handle: igHandle.trim() || null,
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
    if (onComplete) onComplete();
  };

  
  const handleSyncSchedule = async () => {
    if (!icsFileUri && !icsLink.trim()) {
      setStatus('Upload your myUW iCal file (.ics) first.');
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
      setStatus(`Parsed ${classes.length} classes. Saving?`);

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
    } catch (err) {
      setStatus(`Sync failed. ${err?.message || 'Check your iCal file.'}`);
    } finally {
      setSyncing(false);
    }
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
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            placeholder="Sarah Lee"
            placeholderTextColor={colors.textSecondary}
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={styles.label}>UW Email</Text>
          <TextInput
            style={styles.input}
            placeholder="yourname@uw.edu"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Campus</Text>
          {renderChoiceRow(campuses, campus, setCampus)}

          <Text style={styles.label}>Major</Text>
          <TextInput
            style={styles.input}
            placeholder="Computer Science"
            placeholderTextColor={colors.textSecondary}
            value={major}
            onChangeText={setMajor}
          />

          <Text style={styles.label}>Year</Text>
          {renderChoiceRow(years, year, setYear)}
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Optional</Text>
          <Text style={styles.label}>Instagram handle</Text>
          <TextInput
            style={styles.input}
            placeholder="@yours"
            placeholderTextColor={colors.textSecondary}
            value={igHandle}
            onChangeText={setIgHandle}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Hobbies (comma separated)</Text>
          <TextInput
            style={styles.input}
            placeholder="coffee, hiking"
            placeholderTextColor={colors.textSecondary}
            value={hobbies}
            onChangeText={setHobbies}
          />

          <Text style={styles.label}>myUW iCal file (.ics)</Text>
          <TouchableOpacity style={styles.fileBtn} onPress={handlePickIcs}>
            <Text style={styles.fileBtnText}>{icsFileName ? `Selected: ${icsFileName}` : 'Choose .ics file'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.syncBtn} onPress={handleSyncSchedule}>
            <Text style={styles.syncBtnText}>{syncing ? 'Syncing?' : 'Sync schedule now'}</Text>
          </TouchableOpacity>

          <View style={styles.rowBetween}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Discoverable on campus</Text>
              <Text style={styles.helper}>Off by default for privacy.</Text>
            </View>
            <Switch
              value={discoverable}
              onValueChange={setDiscoverable}
              thumbColor={discoverable ? colors.accentFree : colors.textSecondary}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: 'rgba(124,246,231,0.35)' }}
            />
          </View>

          <PrimaryButton label={saving ? 'Saving?' : 'Save profile'} onPress={handleSave} />
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </GlassCard>
      </ScrollView>

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
