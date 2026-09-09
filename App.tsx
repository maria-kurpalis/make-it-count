import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
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
import { completionLines, reflectionLines, pickLine, screenLines } from './src/motivation';
import { addDays, AppData, dateKey, DayRecord, diaryEntries, emptyRecord, Goal, GoalKind, initialData } from './src/model';
import { cancelGoalReminder, rescheduleNotifications, scheduleGoalReminder, snoozeForFifteenMinutes } from './src/notifications';
import { loadData, saveData } from './src/storage';

type Tab = 'today' | 'progress' | 'diary' | 'settings';

const COLORS = {
  ink: '#25213D', muted: '#69647D', canvas: '#F7F3FF', card: '#FFFFFF',
  green: '#6543BB', greenSoft: '#EDE3FF', coral: '#BA493D',
  coralSoft: '#FFE5DE', gold: '#E4A83B', line: '#DED6EC',
};
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Button({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hour, minute] = value.split(':');
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}. Change time`} onPress={() => setOpen(true)} style={[styles.input, styles.summaryRow]}>
        <Text style={styles.label}>{value}</Text><Ionicons name="time-outline" size={22} color={COLORS.green} />
      </Pressable>
      <Text style={styles.hint}>Keep this time or tap to choose. No typing needed.</Text>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.cardTitle}>{label}</Text><Text style={styles.pageTitle}>{value}</Text>
          <Text style={styles.label}>Hour · 24-hour clock</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => <Pressable key={h} accessibilityRole="button" accessibilityState={{ selected: hour === h }} onPress={() => onChange(`${h}:${minute}`)} style={[styles.timeOption, hour === h && styles.segmentActive]}><Text style={styles.label}>{h}</Text></Pressable>)}
          </ScrollView>
          <Text style={styles.label}>Minute · swipe for more</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => <Pressable key={m} accessibilityRole="button" accessibilityState={{ selected: minute === m }} onPress={() => onChange(`${hour}:${m}`)} style={[styles.timeOption, minute === m && styles.segmentActive]}><Text style={styles.label}>{m}</Text></Pressable>)}
          </ScrollView>
          <Button label="Done" onPress={() => setOpen(false)} />
        </View></View>
      </Modal>
    </View>
  );
}

function Onboarding({ data, onFinish }: { data: AppData; onFinish: (data: AppData, startDay: 'today' | 'tomorrow') => void }) {
  const [settings, setSettings] = useState(data.settings);
  const [startDay, setStartDay] = useState<'today' | 'tomorrow'>('tomorrow');

  async function finish() {
    try {
      const next = { ...data, settings: { ...settings, onboarded: true } };
      const granted = await rescheduleNotifications(settings.planningTime, settings.reviewTime, settings.diaryEnabled, settings.diaryTime);
      if (!granted) Alert.alert('Notifications are off', 'You can enable them later in your phone settings.');
      onFinish(next, startDay);
    } catch (error) {
      Alert.alert('Check the reminder times', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.onboarding} keyboardShouldPersistTaps="handled">
          <View style={styles.brandMark}><Ionicons name="sparkles" size={26} color={COLORS.green} /></View>
          <Text style={styles.eyebrow}>MAKE IT COUNT</Text>
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

function GoalRow({ goal, onStatus, onReason, onReflect }: { goal: Goal; onStatus: (status: Goal['status']) => void; onReason: (reason: string) => void; onReflect: () => void }) {
  const [reflecting, setReflecting] = useState(false);
  const successLabel = goal.kind === 'do' ? 'Completed' : 'Resisted';
  const failureLabel = goal.kind === 'do' ? 'Not completed' : 'Slipped';
  function finishReflection() { setReflecting(false); Keyboard.dismiss(); onReflect(); }
  return (
    <View style={styles.goalRow}>
      <View style={[styles.kindIcon, goal.kind === 'do' ? styles.doIcon : styles.dontIcon]}>
        <Ionicons name={goal.kind === 'do' ? 'arrow-up' : 'shield-outline'} size={17} color={goal.kind === 'do' ? COLORS.green : COLORS.coral} />
      </View>
      <View style={styles.goalMain}>
        <Text style={[styles.goalTitle, goal.status === 'achieved' && styles.goalDone]}>{goal.title}</Text>
        {!!goal.reminderIntervalMinutes && goal.status === 'pending' && (
          <View style={styles.reminderBadge}>
            <Ionicons name="notifications-outline" size={14} color={COLORS.green} />
            <Text style={styles.reminderBadgeText}>Every {goal.reminderIntervalMinutes < 60 ? `${goal.reminderIntervalMinutes} min` : goal.reminderIntervalMinutes === 60 ? '1 hour' : `${goal.reminderIntervalMinutes / 60} hours`}</Text>
          </View>
        )}
        <View style={styles.statusActions}>
          <Pressable onPress={() => { setReflecting(false); Keyboard.dismiss(); onStatus('achieved'); }} style={[styles.statusButton, goal.status === 'achieved' && styles.statusAchieved]}>
            <Ionicons name="checkmark" size={16} color={goal.status === 'achieved' ? '#FFF' : COLORS.green} />
            <Text style={[styles.statusText, goal.status === 'achieved' && styles.statusTextActive]}>{successLabel}</Text>
          </Pressable>
          <Pressable onPress={() => { onStatus('failed'); setReflecting(true); }} style={[styles.statusButton, goal.status === 'failed' && styles.statusFailed]}>
            <Ionicons name="close" size={16} color={goal.status === 'failed' ? '#FFF' : COLORS.coral} />
            <Text style={[styles.statusText, goal.status === 'failed' && styles.statusTextActive]}>{failureLabel}</Text>
          </Pressable>
        </View>
        {goal.status === 'failed' && reflecting && (
          <View style={styles.fieldBlock}><TextInput autoFocus value={goal.failureReason ?? ''} onChangeText={onReason} onSubmitEditing={finishReflection} returnKeyType="done" placeholder="What got in the way? (optional)" placeholderTextColor="#8B948E" style={styles.reasonInput} /><Button label="Done" onPress={finishReflection} secondary /></View>
        )}
        {goal.status === 'failed' && !reflecting && <Pressable accessibilityRole="button" onPress={() => setReflecting(true)}><Text style={styles.muted}>{goal.failureReason || 'Add a reflection (optional)'} ✎</Text></Pressable>}
      </View>
    </View>
  );
}

function TodayScreen({ record, selectedDate, onDateChange, onChange }: { record: DayRecord; selectedDate: string; onDateChange: (key: string) => void; onChange: (record: DayRecord) => void }) {
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState<GoalKind>('do');
  const [encouragement, setEncouragement] = useState('');
  const [reflecting, setReflecting] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderChoice, setReminderChoice] = useState<'15' | '30' | '60' | 'custom'>('30');
  const [customReminder, setCustomReminder] = useState('45');
  const achieved = record.goals.filter((goal) => goal.status === 'achieved').length;
  const failed = record.goals.filter((goal) => goal.status === 'failed').length;
  const reviewed = achieved + failed;
  const doCount = record.goals.filter((goal) => goal.kind === 'do').length;
  const dontCount = record.goals.filter((goal) => goal.kind === 'dont').length;
  const templates: { title: string; kind: GoalKind }[] = [
    { title: 'Move my body for 20 minutes', kind: 'do' },
    { title: 'Read for 15 minutes', kind: 'do' },
    { title: 'No late-night scrolling', kind: 'dont' },
    { title: 'No junk food today', kind: 'dont' },
  ];

  async function addGoal() {
    if (!draft.trim()) return;
    const interval = reminderChoice === 'custom' ? Number(customReminder) : Number(reminderChoice);
    if (reminderEnabled && (!Number.isInteger(interval) || interval < 1)) {
      Alert.alert('Choose a valid interval', 'Enter the number of minutes between reminders.');
      return;
    }
    const goal: Goal = { id: `${Date.now()}-${Math.random()}`, title: draft.trim(), kind, status: 'pending', reminderIntervalMinutes: reminderEnabled ? interval : undefined };
    if (reminderEnabled) {
      try {
        const notificationId = await scheduleGoalReminder(goal.id, goal.title, goal.kind, interval);
        if (notificationId) goal.notificationId = notificationId;
        else {
          goal.reminderIntervalMinutes = undefined;
          Alert.alert('Goal saved without reminders', 'Enable notifications in your phone settings when you want reminders.');
        }
      } catch {
        goal.reminderIntervalMinutes = undefined;
        Alert.alert('Goal saved without reminders', 'The reminder could not be scheduled. Please try again from your phone.');
      }
    }
    onChange({ ...record, goals: [...record.goals, goal] });
    setDraft('');
    setReminderEnabled(false);
    Keyboard.dismiss();
  }

  function addTemplate(template: { title: string; kind: GoalKind }) {
    if (record.goals.some((goal) => goal.title === template.title)) return;
    onChange({ ...record, goals: [...record.goals, { id: `${Date.now()}-${Math.random()}`, title: template.title, kind: template.kind, status: 'pending' }] });
  }

  function updateGoal(id: string, patch: Partial<Goal>) {
    const previous = record.goals.find((goal) => goal.id === id);
    if (patch.status && patch.status !== 'pending' && previous?.notificationId) cancelGoalReminder(previous.notificationId).catch(() => undefined);
    onChange({ ...record, goals: record.goals.map((goal) => goal.id === id ? { ...goal, ...patch, notificationId: patch.status && patch.status !== 'pending' ? undefined : goal.notificationId } : goal) });
    if (patch.status === 'achieved' && previous?.status !== 'achieved') { setReflecting(false); setEncouragement(pickLine(completionLines)); }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <View><Text style={styles.eyebrow}>YOUR DAY</Text><Text style={styles.pageTitle}>Make it count.</Text></View>
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
        <Text style={styles.cardTitle}>Your Do’s and Don’ts</Text>
        <Text style={styles.muted}>A focused day works best: aim for up to 3 Do’s and 2 Don’ts.</Text>
        <View style={styles.kindChooser}>
          <Pressable onPress={() => setKind('do')} style={[styles.kindChoice, kind === 'do' && styles.kindDoActive]}><Text style={[styles.kindChoiceText, kind === 'do' && { color: COLORS.green }]}>Do</Text></Pressable>
          <Pressable onPress={() => setKind('dont')} style={[styles.kindChoice, kind === 'dont' && styles.kindDontActive]}><Text style={[styles.kindChoiceText, kind === 'dont' && { color: COLORS.coral }]}>Don’t</Text></Pressable>
        </View>
        <View style={styles.addRow}>
          <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={addGoal} placeholder={kind === 'do' ? 'e.g. Walk for 20 minutes' : 'e.g. No scrolling after 10 PM'} placeholderTextColor="#8B948E" style={[styles.input, styles.addInput]} />
          <Pressable onPress={addGoal} style={styles.addButton} accessibilityLabel="Add goal"><Ionicons name="add" size={26} color="#FFF" /></Pressable>
        </View>
        <View style={styles.reminderPanel}>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}><Text style={styles.label}>Remind me about this</Text><Text style={styles.muted}>Optional · repeats until you review the item</Text></View>
            <Switch value={reminderEnabled} onValueChange={setReminderEnabled} trackColor={{ true: COLORS.greenSoft }} thumbColor={reminderEnabled ? COLORS.green : '#AAA'} />
          </View>
          {reminderEnabled && <>
            <View style={styles.reminderChoices}>
              {(['15', '30', '60', 'custom'] as const).map(value => <Pressable key={value} onPress={() => setReminderChoice(value)} style={[styles.reminderChoice, reminderChoice === value && styles.reminderChoiceActive]}><Text style={[styles.reminderChoiceText, reminderChoice === value && styles.reminderChoiceTextActive]}>{value === '15' ? '15 min' : value === '30' ? '30 min' : value === '60' ? '1 hour' : 'Custom'}</Text></Pressable>)}
            </View>
            {reminderChoice === 'custom' && <View style={styles.customReminderRow}><TextInput value={customReminder} onChangeText={setCustomReminder} keyboardType="number-pad" placeholder="Minutes" placeholderTextColor="#8B948E" style={[styles.input, styles.customReminderInput]} /><Text style={styles.muted}>minutes</Text></View>}
          </>}
        </View>
        <Text style={styles.templateHeading}>Quick templates</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
          {templates.map((template) => <Pressable key={template.title} onPress={() => addTemplate(template)} style={[styles.templateChip, template.kind === 'do' ? styles.templateDo : styles.templateDont]}><Ionicons name="add" size={15} color={template.kind === 'do' ? COLORS.green : COLORS.coral} /><Text style={[styles.templateText, { color: template.kind === 'do' ? COLORS.green : COLORS.coral }]}>{template.title}</Text></Pressable>)}
        </ScrollView>
      </View>
      {record.goals.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.summaryRow}><Text style={styles.cardTitle}>Today’s promises</Text><Text style={styles.summaryText}>{doCount} Do’s · {dontCount} Don’ts</Text></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${achieved / record.goals.length * 100}%` }]} /></View>
          {record.goals.map((goal) => <GoalRow key={goal.id} goal={goal} onStatus={(status) => updateGoal(goal.id, { status })} onReason={(failureReason) => updateGoal(goal.id, { failureReason })} onReflect={() => { setReflecting(true); setEncouragement(pickLine(reflectionLines)); }} />)}
        </View>
      ) : (
        <View style={styles.emptyCard}><Ionicons name="leaf-outline" size={30} color={COLORS.green} /><Text style={styles.emptyTitle}>A clear day starts small.</Text><Text style={styles.muted}>Add one Do and one Don’t to begin.</Text></View>
      )}
      {record.goals.length > 0 && <View style={styles.dailySummaryCard}><View style={styles.summaryIcon}><Ionicons name={reviewed === record.goals.length ? 'sparkles' : 'moon-outline'} size={22} color="#FFF" /></View><View style={styles.flex}><Text style={styles.cardTitle}>{reviewed === record.goals.length ? 'Today is reviewed.' : 'End-of-day check-in'}</Text><Text style={styles.summaryDetail}>{reviewed === record.goals.length ? `You completed ${achieved} and marked ${failed} as not achieved.` : `${reviewed} of ${record.goals.length} goals reviewed. Finish whenever you are ready.`}</Text></View></View>}
      <Modal transparent visible={!!encouragement} animationType="fade" onRequestClose={() => setEncouragement('')}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEncouragement('')}>
          <View style={styles.celebrationCard}><View style={styles.celebrationIcon}><Ionicons name={reflecting ? 'heart' : 'checkmark'} size={32} color="#FFF" /></View><Text style={styles.celebrationTitle}>{reflecting ? 'A fresh step awaits.' : 'Beautiful work.'}</Text><Text style={styles.celebrationCopy}>{encouragement}</Text><Button label="Keep going" onPress={() => setEncouragement('')} /></View>
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
  const bestDay = days.reduce((best, day) => day.achieved > best.achieved ? day : best, days[0]);
  const bestDate = new Date(`${bestDay.key}T12:00:00`);
  const weeklyInsight = bestDay.achieved > 0 ? `${WEEKDAYS[bestDate.getDay()]} was your strongest day with ${bestDay.achieved} ${bestDay.achieved === 1 ? 'win' : 'wins'}.` : 'Your week begins with one small promise.';

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
      <View style={styles.insightCard}><Ionicons name="heart" size={19} color="#FFF" /><Text style={styles.insightText}>{weeklyInsight}</Text></View>
    </ScrollView>
  );
}

function DiaryScreen({ record, records, onChange }: { record: DayRecord; records: Record<string, DayRecord>; onChange: (record: DayRecord) => void }) {
  const [editing, setEditing] = useState(!!record.diaryDraft);
  const [expanded, setExpanded] = useState<string | null>(null);
  const entries = Object.values(records).sort((a, b) => b.date.localeCompare(a.date)).flatMap(day => diaryEntries(day).slice().reverse().map(entry => ({ ...entry, date: day.date })));
  function done() {
    const text = record.diaryDraft?.trim();
    if (text) onChange({ ...record, diaryDraft: '', diaryEntries: [...diaryEntries(record), { id: `${Date.now()}-${Math.random()}`, text, savedAt: new Date().toISOString() }] });
    else if (record.diaryDraft) onChange({ ...record, diaryDraft: '' });
    setEditing(false); setExpanded(null); Keyboard.dismiss();
  }
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>PRIVATE DIARY</Text><Text style={styles.pageTitle}>A few honest lines.</Text>
      <View style={styles.quoteCard}><Ionicons name="sparkles" size={18} color={COLORS.gold} /><Text style={styles.quote}>Two lines are enough. Your day is worth remembering.</Text></View>
      {editing ? <View style={styles.card}><Text style={styles.cardTitle}>How did today feel?</Text><Text style={styles.muted}>There is no right way to write this.</Text><TextInput autoFocus value={record.diaryDraft ?? ''} onChangeText={(diaryDraft) => onChange({ ...record, diaryDraft })} placeholder="Today I noticed…" placeholderTextColor="#8B948E" multiline textAlignVertical="top" style={[styles.input, styles.diaryInput]} /><Text style={styles.savedNote}>Your draft is saved automatically</Text><Button label="Done" onPress={done} /></View> : <Button label="Write a new entry" onPress={() => setEditing(true)} />}
      <Text style={styles.cardTitle}>Your memories · {entries.length}</Text>
      {entries.length === 0 && <View style={styles.emptyCard}><Ionicons name="book-outline" size={30} color={COLORS.green} /><Text style={styles.emptyTitle}>A little space for your day.</Text><Text style={styles.muted}>Saved entries will appear here.</Text></View>}
      {entries.map(entry => <View key={entry.id} style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === entry.id }} onPress={() => setExpanded(expanded === entry.id ? null : entry.id)} style={styles.summaryRow}>
          <View style={styles.flex}><Text style={styles.label}>{entry.savedAt ? new Date(entry.savedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : `${entry.date} · Earlier entry`}</Text>{expanded !== entry.id && <Text numberOfLines={1} style={styles.muted}>{entry.text}</Text>}</View>
          <Ionicons name={expanded === entry.id ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.green} />
        </Pressable>
        {expanded === entry.id && <><TextInput accessibilityLabel="Edit diary entry" multiline textAlignVertical="top" style={[styles.input, styles.multiline]} value={entry.text} onChangeText={text => { const day = records[entry.date]; onChange({ ...day, diaryEntries: diaryEntries(day).map(item => item.id === entry.id ? { ...item, text } : item) }); }} /><Text style={styles.savedNote}>Changes save automatically</Text><Button label="Done" secondary onPress={() => { setExpanded(null); Keyboard.dismiss(); }} /></>}
      </View>)}
    </ScrollView>
  );
}

function SettingsScreen({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
  const [settings, setSettings] = useState(data.settings);
  async function apply() {
    try {
      const granted = await rescheduleNotifications(settings.planningTime, settings.reviewTime, settings.diaryEnabled, settings.diaryTime);
      onChange({ ...data, settings });
      Alert.alert(granted ? 'Reminders updated' : 'Settings saved', granted ? 'Your new routine is ready.' : 'Notifications are off. Enable them in your phone settings to receive reminders.');
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
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.actionIdentifier === 'SNOOZE_15') snoozeForFifteenMinutes();
    });
    return () => subscription.remove();
  }, []);
  function commit(next: AppData) { setData(next); saveData(next).catch(() => Alert.alert('Could not save', 'Please try again.')); }
  function updateRecord(record: DayRecord) { commit({ ...data, records: { ...data.records, [record.date]: record } }); }

  if (!loaded) return <SafeAreaView style={[styles.safe, styles.center]}><Text style={styles.muted}>Preparing your day…</Text></SafeAreaView>;
  if (!data.settings.onboarded) return <Onboarding data={data} onFinish={(next, startDay) => { setSelectedDate(startDay === 'today' ? dateKey() : addDays(dateKey(), 1)); commit(next); }} />;

  const record = data.records[selectedDate] ?? emptyRecord(selectedDate);
  const todayRecord = data.records[dateKey()] ?? emptyRecord(dateKey());
  const tabs: [Tab, keyof typeof Ionicons.glyphMap, string][] = [
    ['today', 'sunny-outline', 'Today'], ['progress', 'stats-chart-outline', 'Progress'],
    ['diary', 'book-outline', 'Diary'], ['settings', 'options-outline', 'Settings'],
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {tab === 'today' && <TodayScreen key={selectedDate} record={record} selectedDate={selectedDate} onDateChange={setSelectedDate} onChange={updateRecord} />}
        {tab === 'progress' && <ProgressScreen records={data.records} />}
        {tab === 'diary' && <DiaryScreen key={todayRecord.date} record={todayRecord} records={data.records} onChange={updateRecord} />}
        {tab === 'settings' && <SettingsScreen data={data} onChange={commit} />}
      </KeyboardAvoidingView>
      <View style={styles.tabBar}>
        {tabs.map(([value, icon, label]) => <Pressable key={value} onPress={() => setTab(value)} style={styles.tabButton}><Ionicons name={icon} size={22} color={tab === value ? COLORS.green : '#8B948E'} /><Text style={[styles.tabLabel, tab === value && styles.tabLabelActive]}>{label}</Text></Pressable>)}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  timeOption: { padding: 14, marginRight: 6, borderRadius: 12, backgroundColor: COLORS.greenSoft, borderWidth: 1, borderColor: COLORS.green },
  progressTrack: { height: 8, backgroundColor: COLORS.greenSoft, borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.green, borderRadius: 8 },
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
  kindChooser: { flexDirection: 'row', gap: 9 }, kindChoice: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 12 }, kindDoActive: { backgroundColor: COLORS.greenSoft, borderColor: '#B8D8C5' }, kindDontActive: { backgroundColor: COLORS.coralSoft, borderColor: '#EDC0B7' }, kindChoiceText: { fontWeight: '800', color: COLORS.muted }, templateHeading: { color: COLORS.muted, fontSize: 13, fontWeight: '800', marginTop: 2 }, templateRow: { gap: 8, paddingVertical: 2 }, templateChip: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 11, paddingVertical: 9, borderRadius: 999 }, templateDo: { backgroundColor: COLORS.greenSoft }, templateDont: { backgroundColor: COLORS.coralSoft }, templateText: { fontSize: 12, fontWeight: '700' },
  reminderPanel: { gap: 11, padding: 13, borderRadius: 15, backgroundColor: '#F7F3FF', borderWidth: 1, borderColor: COLORS.line }, reminderChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, reminderChoice: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card }, reminderChoiceActive: { borderColor: COLORS.green, backgroundColor: COLORS.greenSoft }, reminderChoiceText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' }, reminderChoiceTextActive: { color: COLORS.green }, customReminderRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, customReminderInput: { width: 110, minHeight: 44 }, reminderBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: COLORS.greenSoft }, reminderBadgeText: { color: COLORS.green, fontSize: 12, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 10 }, addInput: { flex: 1 }, addButton: { width: 50, height: 50, backgroundColor: COLORS.green, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, summaryText: { fontSize: 12, color: COLORS.muted }, goalRow: { flexDirection: 'row', gap: 11, paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#EEF1ED' }, kindIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, doIcon: { backgroundColor: COLORS.greenSoft }, dontIcon: { backgroundColor: COLORS.coralSoft },
  goalMain: { flex: 1, gap: 10 }, goalTitle: { fontSize: 16, lineHeight: 22, color: COLORS.ink, fontWeight: '600' }, goalDone: { textDecorationLine: 'line-through', color: COLORS.muted }, statusActions: { flexDirection: 'row', gap: 8 }, statusButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 }, statusAchieved: { backgroundColor: COLORS.green, borderColor: COLORS.green }, statusFailed: { backgroundColor: COLORS.coral, borderColor: COLORS.coral }, statusText: { fontSize: 12, fontWeight: '700', color: COLORS.muted }, statusTextActive: { color: '#FFF' }, reasonInput: { borderBottomWidth: 1, borderBottomColor: '#E4C7C1', paddingVertical: 9, color: COLORS.ink, fontSize: 14 },
  emptyCard: { paddingVertical: 34, paddingHorizontal: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9D4CB', borderRadius: 22, alignItems: 'center', gap: 8 }, emptyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.ink, marginTop: 5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(24,35,29,0.55)', justifyContent: 'center', padding: 28 }, celebrationCard: { backgroundColor: COLORS.card, borderRadius: 26, padding: 25, alignItems: 'center', gap: 13 }, celebrationIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' }, celebrationTitle: { fontSize: 25, fontWeight: '800', color: COLORS.ink }, celebrationCopy: { fontSize: 16, lineHeight: 23, color: COLORS.muted, textAlign: 'center', marginBottom: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 }, statCard: { flexGrow: 1, minWidth: '46%', backgroundColor: COLORS.card, padding: 17, borderRadius: 19, borderWidth: 1, borderColor: '#E9EDE8' }, statWide: { width: '100%' }, statValue: { fontSize: 31, fontWeight: '800', color: COLORS.ink }, statLabel: { marginTop: 4, color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  chart: { flexDirection: 'row', height: 190, alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 20 }, barColumn: { flex: 1, alignItems: 'center', gap: 8 }, barArea: { height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }, bar: { width: 8, minHeight: 3, borderRadius: 5 }, achievedBar: { backgroundColor: COLORS.green }, failedBar: { backgroundColor: COLORS.coral }, dayLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '600' }, legend: { flexDirection: 'row', justifyContent: 'center', gap: 20 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 }, legendDot: { width: 8, height: 8, borderRadius: 4 }, legendText: { fontSize: 12, color: COLORS.muted },
  savedNote: { textAlign: 'right', color: COLORS.green, fontSize: 12, fontWeight: '600' }, privacyCard: { flexDirection: 'row', gap: 13, backgroundColor: COLORS.greenSoft, padding: 18, borderRadius: 20 }, dailySummaryCard: { flexDirection: 'row', gap: 13, backgroundColor: '#FFF0C9', padding: 18, borderRadius: 22, borderWidth: 1, borderColor: '#FFE1A1' }, summaryIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' }, summaryDetail: { color: '#70541F', fontSize: 14, lineHeight: 20, marginTop: 2 }, insightCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 17, borderRadius: 20, backgroundColor: COLORS.green }, insightText: { color: '#FFF', fontSize: 15, lineHeight: 21, fontWeight: '700', flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 7 : 10 }, tabButton: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 }, tabLabel: { fontSize: 11, fontWeight: '600', color: '#8B948E' }, tabLabelActive: { color: COLORS.green },
});
