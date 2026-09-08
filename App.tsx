import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { completionLines, pickLine, screenLines } from './src/motivation';
import { addDays, AppData, dateKey, DayRecord, emptyRecord, Goal, GoalKind, initialData } from './src/model';
import { rescheduleNotifications } from './src/notifications';
import { loadData, saveData } from './src/storage';

type Tab = 'today' | 'progress' | 'diary' | 'settings';

const COLORS = {
  ink: '#18231D', muted: '#66716A', canvas: '#F5F7F2', card: '#FFFFFF',
  green: '#256B4A', greenSoft: '#DDEEE4', coral: '#C65742',
  coralSoft: '#F8E2DD', gold: '#E4A83B', line: '#DDE3DC',
};
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Button({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, pressed && { opacity: 0.8 }]}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder="08:00" keyboardType="numbers-and-punctuation" maxLength={5} style={styles.input} />
      <Text style={styles.hint}>24-hour format (HH:MM)</Text>
    </View>
  );
}

function Onboarding({ data, onFinish }: { data: AppData; onFinish: (data: AppData) => void }) {
  const [settings, setSettings] = useState(data.settings);
  const [startDay, setStartDay] = useState<'today' | 'tomorrow'>('tomorrow');

  async function finish() {
    try {
      const next = { ...data, settings: { ...settings, onboarded: true } };
      const granted = await rescheduleNotifications(settings.planningTime, settings.reviewTime, settings.diaryEnabled, settings.diaryTime);
      if (!granted) Alert.alert('Notifications are off', 'You can enable them later in your phone settings.');
      onFinish(next);
    } catch (error) {
      Alert.alert('Check the reminder times', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.onboarding} keyboardShouldPersistTaps="handled">
          <View style={styles.brandMark}><Ionicons name="sparkles" size={26} color={COLORS.green} /></View>
          <Text style={styles.eyebrow}>MOMENTUM</Text>
          <Text style={styles.heroTitle}>Make a promise to your day.</Text>
          <Text style={styles.heroCopy}>Choose when you want a gentle nudge to plan, reflect, and write a few honest lines.</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Start planning</Text>
            <Text style={styles.label}>When should your first plan begin?</Text>
            <View style={styles.segmented}>
              {(['today', 'tomorrow'] as const).map((value) => (
                <Pressable key={value} onPress={() => setStartDay(value)} style={[styles.segment, startDay === value && styles.segmentActive]}>
                  <Text style={[styles.segmentText, startDay === value && styles.segmentTextActive]}>{value === 'today' ? 'Today' : 'Tomorrow'}</Text>
                </Pressable>
              ))}
            </View>
            <TimeField label="Daily planning reminder" value={settings.planningTime} onChange={(planningTime) => setSettings({ ...settings, planningTime })} />
            <TimeField label="End-of-day review" value={settings.reviewTime} onChange={(reviewTime) => setSettings({ ...settings, reviewTime })} />
          </View>

          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.cardTitle}>Daily diary</Text>
                <Text style={styles.muted}>A private reminder to write—even two lines.</Text>
              </View>
              <Switch value={settings.diaryEnabled} onValueChange={(diaryEnabled) => setSettings({ ...settings, diaryEnabled })} trackColor={{ true: COLORS.greenSoft }} thumbColor={settings.diaryEnabled ? COLORS.green : '#AAA'} />
            </View>
            {settings.diaryEnabled && <TimeField label="Diary reminder" value={settings.diaryTime} onChange={(diaryTime) => setSettings({ ...settings, diaryTime })} />}
          </View>
          <Button label="Begin with intention" onPress={finish} />
          <Text style={styles.privacy}>No account. Your entries stay on this device.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GoalRow({ goal, onStatus, onReason }: { goal: Goal; onStatus: (status: Goal['status']) => void; onReason: (reason: string) => void }) {
  return (
    <View style={styles.goalRow}>
      <View style={[styles.kindIcon, goal.kind === 'do' ? styles.doIcon : styles.dontIcon]}>
        <Ionicons name={goal.kind === 'do' ? 'arrow-up' : 'shield-outline'} size={17} color={goal.kind === 'do' ? COLORS.green : COLORS.coral} />
      </View>
      <View style={styles.goalMain}>
        <Text style={[styles.goalTitle, goal.status === 'achieved' && styles.goalDone]}>{goal.title}</Text>
        <View style={styles.statusActions}>
          <Pressable onPress={() => onStatus('achieved')} style={[styles.statusButton, goal.status === 'achieved' && styles.statusAchieved]}>
            <Ionicons name="checkmark" size={16} color={goal.status === 'achieved' ? '#FFF' : COLORS.green} />
            <Text style={[styles.statusText, goal.status === 'achieved' && styles.statusTextActive]}>Achieved</Text>
          </Pressable>
          <Pressable onPress={() => onStatus('failed')} style={[styles.statusButton, goal.status === 'failed' && styles.statusFailed]}>
            <Ionicons name="close" size={16} color={goal.status === 'failed' ? '#FFF' : COLORS.coral} />
            <Text style={[styles.statusText, goal.status === 'failed' && styles.statusTextActive]}>Not today</Text>
          </Pressable>
        </View>
        {goal.status === 'failed' && (
          <TextInput value={goal.failureReason ?? ''} onChangeText={onReason} placeholder="What got in the way? (optional)" placeholderTextColor="#8B948E" style={styles.reasonInput} />
        )}
      </View>
    </View>
  );
}

function TodayScreen({ record, selectedDate, onDateChange, onChange }: { record: DayRecord; selectedDate: string; onDateChange: (key: string) => void; onChange: (record: DayRecord) => void }) {
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState<GoalKind>('do');
  const [encouragement, setEncouragement] = useState('');
  const achieved = record.goals.filter((goal) => goal.status === 'achieved').length;
  const failed = record.goals.filter((goal) => goal.status === 'failed').length;

  function addGoal() {
    if (!draft.trim()) return;
    const goal: Goal = { id: `${Date.now()}-${Math.random()}`, title: draft.trim(), kind, status: 'pending' };
    onChange({ ...record, goals: [...record.goals, goal] });
    setDraft('');
  }

  function updateGoal(id: string, patch: Partial<Goal>) {
    const previous = record.goals.find((goal) => goal.id === id);
    onChange({ ...record, goals: record.goals.map((goal) => goal.id === id ? { ...goal, ...patch } : goal) });
    if (patch.status === 'achieved' && previous?.status !== 'achieved') setEncouragement(pickLine(completionLines));
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <View><Text style={styles.eyebrow}>YOUR DAY</Text><Text style={styles.pageTitle}>Keep it honest.</Text></View>
        <View style={styles.datePill}><Ionicons name="calendar-outline" size={15} color={COLORS.green} /><Text style={styles.datePillText}>{selectedDate === dateKey() ? 'Today' : 'Tomorrow'}</Text></View>
      </View>
      <View style={styles.segmented}>
        <Pressable onPress={() => onDateChange(dateKey())} style={[styles.segment, selectedDate === dateKey() && styles.segmentActive]}><Text style={[styles.segmentText, selectedDate === dateKey() && styles.segmentTextActive]}>Today</Text></Pressable>
        <Pressable onPress={() => onDateChange(addDays(dateKey(), 1))} style={[styles.segment, selectedDate !== dateKey() && styles.segmentActive]}><Text style={[styles.segmentText, selectedDate !== dateKey() && styles.segmentTextActive]}>Tomorrow</Text></Pressable>
      </View>
      <View style={styles.quoteCard}><Ionicons name="sparkles" size={18} color={COLORS.gold} /><Text style={styles.quote}>{pickLine(screenLines, Number(selectedDate.replaceAll('-', '')))}</Text></View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Why does today matter?</Text>
        <TextInput value={record.motivation} onChangeText={(motivation) => onChange({ ...record, motivation })} placeholder="My motivation for today is…" placeholderTextColor="#8B948E" multiline style={[styles.input, styles.multiline]} />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add a promise</Text>
        <View style={styles.kindChooser}>
          <Pressable onPress={() => setKind('do')} style={[styles.kindChoice, kind === 'do' && styles.kindDoActive]}><Text style={[styles.kindChoiceText, kind === 'do' && { color: COLORS.green }]}>Do</Text></Pressable>
          <Pressable onPress={() => setKind('dont')} style={[styles.kindChoice, kind === 'dont' && styles.kindDontActive]}><Text style={[styles.kindChoiceText, kind === 'dont' && { color: COLORS.coral }]}>Don’t</Text></Pressable>
        </View>
        <View style={styles.addRow}>
          <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={addGoal} placeholder={kind === 'do' ? 'e.g. Walk for 20 minutes' : 'e.g. No scrolling after 10 PM'} placeholderTextColor="#8B948E" style={[styles.input, styles.addInput]} />
          <Pressable onPress={addGoal} style={styles.addButton} accessibilityLabel="Add goal"><Ionicons name="add" size={26} color="#FFF" /></Pressable>
        </View>
      </View>
      {record.goals.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.summaryRow}><Text style={styles.cardTitle}>Today’s promises</Text><Text style={styles.summaryText}>{achieved} achieved · {failed} missed</Text></View>
          {record.goals.map((goal) => <GoalRow key={goal.id} goal={goal} onStatus={(status) => updateGoal(goal.id, { status })} onReason={(failureReason) => updateGoal(goal.id, { failureReason })} />)}
        </View>
      ) : (
        <View style={styles.emptyCard}><Ionicons name="leaf-outline" size={30} color={COLORS.green} /><Text style={styles.emptyTitle}>A clear day starts small.</Text><Text style={styles.muted}>Add one Do and one Don’t to begin.</Text></View>
      )}
      <Modal transparent visible={!!encouragement} animationType="fade" onRequestClose={() => setEncouragement('')}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEncouragement('')}>
          <View style={styles.celebrationCard}><View style={styles.celebrationIcon}><Ionicons name="checkmark" size={32} color="#FFF" /></View><Text style={styles.celebrationTitle}>Beautiful work.</Text><Text style={styles.celebrationCopy}>{encouragement}</Text><Button label="Keep going" onPress={() => setEncouragement('')} /></View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function ProgressScreen({ records }: { records: Record<string, DayRecord> }) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const key = addDays(dateKey(), index - 6);
    const record = records[key] ?? emptyRecord(key);
    return { key, achieved: record.goals.filter((g) => g.status === 'achieved').length, failed: record.goals.filter((g) => g.status === 'failed').length };
  }), [records]);
  const achieved = days.reduce((sum, day) => sum + day.achieved, 0);
  const failed = days.reduce((sum, day) => sum + day.failed, 0);
  const successRate = achieved + failed ? Math.round((achieved / (achieved + failed)) * 100) : 0;
  const max = Math.max(1, ...days.map((day) => day.achieved + day.failed));

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.eyebrow}>LAST 7 DAYS</Text><Text style={styles.pageTitle}>Your progress, gently.</Text>
      <View style={styles.quoteCard}><Ionicons name="sparkles" size={18} color={COLORS.gold} /><Text style={styles.quote}>Look for patterns, not perfection.</Text></View>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statWide]}><Text style={styles.statValue}>{successRate}%</Text><Text style={styles.statLabel}>Weekly success</Text></View>
        <View style={styles.statCard}><Text style={[styles.statValue, { color: COLORS.green }]}>{achieved}</Text><Text style={styles.statLabel}>Achieved</Text></View>
        <View style={styles.statCard}><Text style={[styles.statValue, { color: COLORS.coral }]}>{failed}</Text><Text style={styles.statLabel}>Not achieved</Text></View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly rhythm</Text><Text style={styles.muted}>Achieved and missed goals by day</Text>
        <View style={styles.chart}>
          {days.map((day) => {
            const date = new Date(`${day.key}T12:00:00`);
            return <View key={day.key} style={styles.barColumn}><View style={styles.barArea}><View style={[styles.bar, styles.failedBar, { height: `${(day.failed / max) * 100}%` }]} /><View style={[styles.bar, styles.achievedBar, { height: `${(day.achieved / max) * 100}%` }]} /></View><Text style={styles.dayLabel}>{WEEKDAYS[date.getDay()]}</Text></View>;
          })}
        </View>
        <View style={styles.legend}><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.green }]} /><Text style={styles.legendText}>Achieved</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.coral }]} /><Text style={styles.legendText}>Not achieved</Text></View></View>
      </View>
    </ScrollView>
  );
}

function DiaryScreen({ record, onChange }: { record: DayRecord; onChange: (record: DayRecord) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>PRIVATE DIARY</Text><Text style={styles.pageTitle}>A few honest lines.</Text>
      <View style={styles.quoteCard}><Ionicons name="sparkles" size={18} color={COLORS.gold} /><Text style={styles.quote}>Two lines are enough. Your day is worth remembering.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>How did today feel?</Text><Text style={styles.muted}>There is no right way to write this.</Text><TextInput value={record.diary ?? ''} onChangeText={(diary) => onChange({ ...record, diary })} placeholder="Today I noticed…" placeholderTextColor="#8B948E" multiline textAlignVertical="top" style={[styles.input, styles.diaryInput]} /><Text style={styles.savedNote}>{record.diary?.trim() ? 'Saved automatically on this device' : 'Start with one sentence'}</Text></View>
    </ScrollView>
  );
}

function SettingsScreen({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
  const [settings, setSettings] = useState(data.settings);
  async function apply() {
    try {
      await rescheduleNotifications(settings.planningTime, settings.reviewTime, settings.diaryEnabled, settings.diaryTime);
      onChange({ ...data, settings });
      Alert.alert('Reminders updated', 'Your new routine is ready.');
    } catch (error) {
      Alert.alert('Check the reminder times', error instanceof Error ? error.message : 'Please try again.');
    }
  }
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>YOUR ROUTINE</Text><Text style={styles.pageTitle}>Make the app fit your day.</Text>
      <View style={styles.card}>
        <TimeField label="Plan your goals" value={settings.planningTime} onChange={(planningTime) => setSettings({ ...settings, planningTime })} />
        <TimeField label="Review your day" value={settings.reviewTime} onChange={(reviewTime) => setSettings({ ...settings, reviewTime })} />
        <View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.label}>Daily diary reminder</Text><Text style={styles.muted}>Only notify me when enabled</Text></View><Switch value={settings.diaryEnabled} onValueChange={(diaryEnabled) => setSettings({ ...settings, diaryEnabled })} trackColor={{ true: COLORS.greenSoft }} thumbColor={settings.diaryEnabled ? COLORS.green : '#AAA'} /></View>
        {settings.diaryEnabled && <TimeField label="Write in diary" value={settings.diaryTime} onChange={(diaryTime) => setSettings({ ...settings, diaryTime })} />}
        <Button label="Save reminder settings" onPress={apply} />
      </View>
      <View style={styles.privacyCard}><Ionicons name="lock-closed-outline" size={22} color={COLORS.green} /><View style={styles.flex}><Text style={styles.cardTitle}>Private by design</Text><Text style={styles.muted}>No account is required. Your goals and diary remain on this device.</Text></View></View>
    </ScrollView>
  );
}

export default function App() {
  const [data, setData] = useState<AppData>(initialData);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [selectedDate, setSelectedDate] = useState(dateKey());

  useEffect(() => { loadData().then((stored) => { setData(stored); setLoaded(true); }); }, []);
  function commit(next: AppData) { setData(next); saveData(next).catch(() => Alert.alert('Could not save', 'Please try again.')); }
  function updateRecord(record: DayRecord) { commit({ ...data, records: { ...data.records, [record.date]: record } }); }

  if (!loaded) return <SafeAreaView style={[styles.safe, styles.center]}><Text style={styles.muted}>Preparing your day…</Text></SafeAreaView>;
  if (!data.settings.onboarded) return <Onboarding data={data} onFinish={commit} />;

  const record = data.records[selectedDate] ?? emptyRecord(selectedDate);
  const todayRecord = data.records[dateKey()] ?? emptyRecord(dateKey());
  const tabs: [Tab, keyof typeof Ionicons.glyphMap, string][] = [
    ['today', 'sunny-outline', 'Today'], ['progress', 'stats-chart-outline', 'Progress'],
    ['diary', 'book-outline', 'Diary'], ['settings', 'options-outline', 'Settings'],
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.flex}>
        {tab === 'today' && <TodayScreen record={record} selectedDate={selectedDate} onDateChange={setSelectedDate} onChange={updateRecord} />}
        {tab === 'progress' && <ProgressScreen records={data.records} />}
        {tab === 'diary' && <DiaryScreen record={todayRecord} onChange={updateRecord} />}
        {tab === 'settings' && <SettingsScreen data={data} onChange={commit} />}
      </View>
      <View style={styles.tabBar}>
        {tabs.map(([value, icon, label]) => <Pressable key={value} onPress={() => setTab(value)} style={styles.tabButton}><Ionicons name={icon} size={22} color={tab === value ? COLORS.green : '#8B948E'} /><Text style={[styles.tabLabel, tab === value && styles.tabLabelActive]}>{label}</Text></Pressable>)}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: COLORS.canvas }, center: { alignItems: 'center', justifyContent: 'center' },
  onboarding: { padding: 24, paddingTop: 50, paddingBottom: 52, gap: 18 }, page: { padding: 20, paddingTop: 26, paddingBottom: 36, gap: 16 },
  brandMark: { width: 52, height: 52, borderRadius: 18, backgroundColor: COLORS.greenSoft, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.7, color: COLORS.green }, heroTitle: { fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1.4, color: COLORS.ink, maxWidth: 330 },
  heroCopy: { fontSize: 17, lineHeight: 25, color: COLORS.muted, maxWidth: 360 }, pageTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.7, color: COLORS.ink, marginTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, datePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.greenSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }, datePillText: { color: COLORS.green, fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: COLORS.card, padding: 18, borderRadius: 22, gap: 14, borderWidth: 1, borderColor: '#E9EDE8' }, cardTitle: { fontSize: 18, lineHeight: 23, fontWeight: '800', color: COLORS.ink },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: COLORS.ink }, muted: { fontSize: 14, lineHeight: 21, color: COLORS.muted }, hint: { fontSize: 12, color: COLORS.muted, marginTop: 6 }, fieldBlock: { gap: 7 },
  input: { minHeight: 50, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#FAFBF9', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.ink, fontSize: 16 }, multiline: { minHeight: 92, textAlignVertical: 'top' }, diaryInput: { minHeight: 280, marginTop: 8, textAlignVertical: 'top', lineHeight: 25 },
  segmented: { flexDirection: 'row', backgroundColor: '#E9EDE8', padding: 4, borderRadius: 14 }, segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11 }, segmentActive: { backgroundColor: COLORS.card }, segmentText: { fontSize: 14, fontWeight: '700', color: COLORS.muted }, segmentTextActive: { color: COLORS.ink },
  button: { minHeight: 52, backgroundColor: COLORS.green, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, buttonSecondary: { backgroundColor: COLORS.greenSoft }, buttonText: { color: '#FFF', fontSize: 16, fontWeight: '800' }, buttonTextSecondary: { color: COLORS.green },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, switchCopy: { flex: 1, gap: 3 }, privacy: { textAlign: 'center', color: COLORS.muted, fontSize: 13 },
  quoteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 15, backgroundColor: '#FFF8E9', borderRadius: 17 }, quote: { flex: 1, color: '#70541F', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  kindChooser: { flexDirection: 'row', gap: 9 }, kindChoice: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 12 }, kindDoActive: { backgroundColor: COLORS.greenSoft, borderColor: '#B8D8C5' }, kindDontActive: { backgroundColor: COLORS.coralSoft, borderColor: '#EDC0B7' }, kindChoiceText: { fontWeight: '800', color: COLORS.muted },
  addRow: { flexDirection: 'row', gap: 10 }, addInput: { flex: 1 }, addButton: { width: 50, height: 50, backgroundColor: COLORS.green, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, summaryText: { fontSize: 12, color: COLORS.muted }, goalRow: { flexDirection: 'row', gap: 11, paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#EEF1ED' }, kindIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, doIcon: { backgroundColor: COLORS.greenSoft }, dontIcon: { backgroundColor: COLORS.coralSoft },
  goalMain: { flex: 1, gap: 10 }, goalTitle: { fontSize: 16, lineHeight: 22, color: COLORS.ink, fontWeight: '600' }, goalDone: { textDecorationLine: 'line-through', color: COLORS.muted }, statusActions: { flexDirection: 'row', gap: 8 }, statusButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 }, statusAchieved: { backgroundColor: COLORS.green, borderColor: COLORS.green }, statusFailed: { backgroundColor: COLORS.coral, borderColor: COLORS.coral }, statusText: { fontSize: 12, fontWeight: '700', color: COLORS.muted }, statusTextActive: { color: '#FFF' }, reasonInput: { borderBottomWidth: 1, borderBottomColor: '#E4C7C1', paddingVertical: 9, color: COLORS.ink, fontSize: 14 },
  emptyCard: { paddingVertical: 34, paddingHorizontal: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9D4CB', borderRadius: 22, alignItems: 'center', gap: 8 }, emptyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.ink, marginTop: 5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(24,35,29,0.55)', justifyContent: 'center', padding: 28 }, celebrationCard: { backgroundColor: COLORS.card, borderRadius: 26, padding: 25, alignItems: 'center', gap: 13 }, celebrationIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' }, celebrationTitle: { fontSize: 25, fontWeight: '800', color: COLORS.ink }, celebrationCopy: { fontSize: 16, lineHeight: 23, color: COLORS.muted, textAlign: 'center', marginBottom: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 }, statCard: { flexGrow: 1, minWidth: '46%', backgroundColor: COLORS.card, padding: 17, borderRadius: 19, borderWidth: 1, borderColor: '#E9EDE8' }, statWide: { width: '100%' }, statValue: { fontSize: 31, fontWeight: '800', color: COLORS.ink }, statLabel: { marginTop: 4, color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  chart: { flexDirection: 'row', height: 190, alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 20 }, barColumn: { flex: 1, alignItems: 'center', gap: 8 }, barArea: { height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }, bar: { width: 8, minHeight: 3, borderRadius: 5 }, achievedBar: { backgroundColor: COLORS.green }, failedBar: { backgroundColor: COLORS.coral }, dayLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '600' }, legend: { flexDirection: 'row', justifyContent: 'center', gap: 20 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 }, legendDot: { width: 8, height: 8, borderRadius: 4 }, legendText: { fontSize: 12, color: COLORS.muted },
  savedNote: { textAlign: 'right', color: COLORS.green, fontSize: 12, fontWeight: '600' }, privacyCard: { flexDirection: 'row', gap: 13, backgroundColor: COLORS.greenSoft, padding: 18, borderRadius: 20 },
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 7 : 10 }, tabButton: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 }, tabLabel: { fontSize: 11, fontWeight: '600', color: '#8B948E' }, tabLabelActive: { color: COLORS.green },
});
