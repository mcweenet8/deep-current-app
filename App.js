import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, StyleSheet, SafeAreaView,
  ScrollView, StatusBar, Platform,
} from 'react-native';

// ── Paste your ngrok URL here (no trailing slash) ─────────────────────────
const DEFAULT_API_URL = 'https://web-production-0e482.up.railway.app';
// ─────────────────────────────────────────────────────────────────────────

// ── Theme ─────────────────────────────────────────────────────────────────
const C = {
  bg:       '#0D0F14',
  surface:  '#161920',
  card:     '#1C2030',
  border:   '#252A3A',
  accent:   '#F0B429',
  accentDim:'#7A5C14',
  green:    '#3DDC84',
  red:      '#FF6B6B',
  text:     '#F0F2F8',
  muted:    '#6B7280',
  sub:      '#9CA3AF',
};

// ── Helpers ───────────────────────────────────────────────────────────────
const scoreColor = (score) => {
  if (score >= 4)   return C.accent;
  if (score >= 2.5) return C.green;
  return C.text;
};

const shortLeague = (l) => ({
  'Premier League': 'PL', 'Championship': 'CH',
  'La Liga': 'ESP', 'Serie A': 'ITA',
  'Bundesliga': 'GER', 'Ligue 1': 'FRA',
}[l] || l?.slice(0, 3).toUpperCase());

// ── Stat Row ──────────────────────────────────────────────────────────────
const StatRow = ({ label, value, highlight }) => (
  <View style={styles.statRow}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, highlight && { color: C.accent, fontWeight: '700' }]}>
      {value}
    </Text>
  </View>
);

// ── Player Detail Modal ───────────────────────────────────────────────────
const PlayerModal = ({ player, onClose }) => {
  if (!player) return null;
  const gap = player.xa_gap >= 0 ? `+${player.xa_gap}` : `${player.xa_gap}`;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalName}>{player.player}</Text>
              <Text style={styles.modalSub}>
                {player.team}  ·  {shortLeague(player.league)}
              </Text>
            </View>
            <View style={styles.scoreBadgeLarge}>
              <Text style={[styles.scoreBadgeText, { color: scoreColor(player.score) }]}>
                {player.score.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Formula breakdown */}
          <Text style={styles.sectionLabel}>FORMULA BREAKDOWN</Text>
          <StatRow label="xA Gap  (×0.35)" value={gap} highlight={player.xa_gap > 0} />
          <StatRow label="CC/Game (×0.30)" value={player.chances_per_game.toFixed(2)} />
          <StatRow label="Big Chances (×0.20)" value={player.big_chances} />
          <StatRow label="Penalties Won (×0.15)" value={player.penalties_won} />

          <View style={styles.divider} />

          {/* Raw stats */}
          <Text style={styles.sectionLabel}>RAW STATS</Text>
          <StatRow label="Assists" value={player.assists} />
          <StatRow label="xA" value={player.xa.toFixed(2)} />
          <StatRow label="xA Gap" value={gap} highlight={player.xa_gap > 0} />

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ── Player Row ────────────────────────────────────────────────────────────
const PlayerRow = ({ player, rank, onPress }) => (
  <TouchableOpacity style={styles.playerRow} onPress={() => onPress(player)}>
    <Text style={styles.rank}>{rank}</Text>
    <View style={styles.playerInfo}>
      <Text style={styles.playerName} numberOfLines={1}>{player.player}</Text>
      <Text style={styles.playerSub}>{player.team}  ·  {shortLeague(player.league)}</Text>
    </View>
    <Text style={[styles.score, { color: scoreColor(player.score) }]}>
      {player.score.toFixed(2)}
    </Text>
  </TouchableOpacity>
);

// ── League Drill-Down ─────────────────────────────────────────────────────
const LeagueView = ({ byLeague, onPlayerPress }) => {
  const [openLeague, setOpenLeague] = useState(null);
  const [openTeam, setOpenTeam]     = useState(null);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: 40 }}>
      {Object.entries(byLeague).map(([league, teams]) => (
        <View key={league}>
          {/* League header */}
          <TouchableOpacity
            style={styles.leagueHeader}
            onPress={() => setOpenLeague(openLeague === league ? null : league)}>
            <Text style={styles.leagueTitle}>{league}</Text>
            <Text style={styles.chevron}>{openLeague === league ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {openLeague === league && teams.map(({ team, players }) => (
            <View key={team}>
              {/* Team header */}
              <TouchableOpacity
                style={styles.teamHeader}
                onPress={() => setOpenTeam(openTeam === team ? null : team)}>
                <Text style={styles.teamTitle}>{team}</Text>
                <Text style={styles.teamCount}>{players.length} players  {openTeam === team ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {openTeam === team && players.map((p, i) => (
                <PlayerRow key={p.player + i} player={p} rank={i + 1} onPress={onPlayerPress} />
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [apiUrl, setApiUrl]         = useState(DEFAULT_API_URL);
  const [tab, setTab]               = useState('top25');      // 'top25' | 'leagues' | 'settings'
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [urlInput, setUrlInput]     = useState(DEFAULT_API_URL);

  const base = apiUrl.replace(/\/$/, '');

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${base}/data`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [base]);

  const runRefresh = useCallback(async () => {
    setRefreshing(true); setError(null);
    try {
      const res = await fetch(`${base}/refresh`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Refresh failed');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, [base]);

  const hasData = data && (data.top25?.length > 0 || Object.keys(data.by_league || {}).length > 0);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>ASSIST TOOL</Text>
          {data?.last_updated && (
            <Text style={styles.headerSub}>Updated {data.last_updated}</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.refreshBtn, refreshing && styles.refreshBtnActive]}
          onPress={runRefresh}
          disabled={refreshing}>
          {refreshing
            ? <ActivityIndicator size="small" color={C.bg} />
            : <Text style={styles.refreshBtnText}>⟳  Refresh</Text>}
        </TouchableOpacity>
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>⚠  {error}</Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {[['top25','Top 25'], ['leagues','By League'], ['settings','Settings']].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => { setTab(key); if (key !== 'settings' && !hasData) loadData(); }}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {tab === 'top25' && (
        loading
          ? <View style={styles.center}><ActivityIndicator size="large" color={C.accent} /></View>
          : !hasData
            ? <View style={styles.center}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyText}>No data yet</Text>
                <Text style={styles.emptySub}>Hit Refresh to load player rankings</Text>
                <TouchableOpacity style={styles.loadBtn} onPress={loadData}>
                  <Text style={styles.loadBtnText}>Load Cached Data</Text>
                </TouchableOpacity>
              </View>
            : <FlatList
                data={data.top25}
                keyExtractor={(p, i) => p.player + i}
                renderItem={({ item, index }) => (
                  <PlayerRow player={item} rank={index + 1} onPress={setSelectedPlayer} />
                )}
                contentContainerStyle={{ paddingBottom: 40 }}
                ListHeaderComponent={
                  <Text style={styles.listHeader}>
                    TOP {data.top25?.length} — CROSS LEAGUE
                  </Text>
                }
              />
      )}

      {tab === 'leagues' && (
        loading
          ? <View style={styles.center}><ActivityIndicator size="large" color={C.accent} /></View>
          : !hasData
            ? <View style={styles.center}>
                <Text style={styles.emptyText}>No data yet</Text>
                <TouchableOpacity style={styles.loadBtn} onPress={loadData}>
                  <Text style={styles.loadBtnText}>Load Cached Data</Text>
                </TouchableOpacity>
              </View>
            : <LeagueView byLeague={data.by_league || {}} onPlayerPress={setSelectedPlayer} />
      )}

      {tab === 'settings' && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.settingsContent}>
          <Text style={styles.settingsLabel}>API URL</Text>
          <Text style={styles.settingsHint}>
            Paste your ngrok URL from Colab here. No trailing slash.
          </Text>
          <TextInput
            style={styles.urlInput}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="https://xxxx.ngrok-free.app"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => { setApiUrl(urlInput.trim()); setData(null); setError(null); }}>
            <Text style={styles.saveBtnText}>Save & Reconnect</Text>
          </TouchableOpacity>

          <View style={styles.divider} />
          <Text style={styles.settingsLabel}>FORMULA</Text>
          {[
            ['xA Gap',        '×0.35'],
            ['CC / Game',     '×0.30'],
            ['Big Chances',   '×0.20'],
            ['Penalties Won', '×0.15'],
          ].map(([label, weight]) => (
            <View key={label} style={styles.formulaRow}>
              <Text style={styles.formulaLabel}>{label}</Text>
              <Text style={styles.formulaWeight}>{weight}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Player detail modal */}
      <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: C.bg },
  flex:             { flex: 1 },

  // Header
  header:           { flexDirection: 'row', justifyContent: 'space-between',
                      alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
                      borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:      { color: C.accent, fontSize: 18, fontWeight: '800',
                      letterSpacing: 2 },
  headerSub:        { color: C.muted, fontSize: 11, marginTop: 2 },
  refreshBtn:       { backgroundColor: C.accent, paddingHorizontal: 16,
                      paddingVertical: 8, borderRadius: 8 },
  refreshBtnActive: { backgroundColor: C.accentDim },
  refreshBtnText:   { color: C.bg, fontWeight: '700', fontSize: 14 },

  // Error
  errorBar:         { backgroundColor: '#3D1515', padding: 10, paddingHorizontal: 16 },
  errorText:        { color: C.red, fontSize: 13 },

  // Tabs
  tabs:             { flexDirection: 'row', borderBottomWidth: 1,
                      borderBottomColor: C.border },
  tab:              { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive:        { borderBottomWidth: 2, borderBottomColor: C.accent },
  tabText:          { color: C.muted, fontSize: 13, fontWeight: '600' },
  tabTextActive:    { color: C.accent },

  // List
  listHeader:       { color: C.muted, fontSize: 11, fontWeight: '700',
                      letterSpacing: 1.5, padding: 16, paddingBottom: 8 },
  playerRow:        { flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 16, paddingVertical: 12,
                      borderBottomWidth: 1, borderBottomColor: C.border },
  rank:             { color: C.muted, fontSize: 13, width: 28, fontWeight: '600' },
  playerInfo:       { flex: 1 },
  playerName:       { color: C.text, fontSize: 15, fontWeight: '600' },
  playerSub:        { color: C.muted, fontSize: 12, marginTop: 2 },
  score:            { fontSize: 17, fontWeight: '800', minWidth: 44,
                      textAlign: 'right' },

  // Empty state
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center',
                      padding: 32 },
  emptyIcon:        { fontSize: 48, marginBottom: 12 },
  emptyText:        { color: C.text, fontSize: 18, fontWeight: '700' },
  emptySub:         { color: C.muted, fontSize: 14, marginTop: 6,
                      textAlign: 'center' },
  loadBtn:          { marginTop: 24, borderWidth: 1, borderColor: C.accent,
                      paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  loadBtnText:      { color: C.accent, fontWeight: '700' },

  // League drill-down
  leagueHeader:     { flexDirection: 'row', justifyContent: 'space-between',
                      alignItems: 'center', padding: 16,
                      backgroundColor: C.surface,
                      borderBottomWidth: 1, borderBottomColor: C.border },
  leagueTitle:      { color: C.accent, fontSize: 14, fontWeight: '800',
                      letterSpacing: 1 },
  chevron:          { color: C.muted, fontSize: 12 },
  teamHeader:       { flexDirection: 'row', justifyContent: 'space-between',
                      alignItems: 'center', paddingHorizontal: 24,
                      paddingVertical: 10, backgroundColor: C.card,
                      borderBottomWidth: 1, borderBottomColor: C.border },
  teamTitle:        { color: C.text, fontSize: 13, fontWeight: '700' },
  teamCount:        { color: C.muted, fontSize: 12 },

  // Modal
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
                      justifyContent: 'flex-end' },
  modalCard:        { backgroundColor: C.surface, borderTopLeftRadius: 20,
                      borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between',
                      alignItems: 'flex-start' },
  modalName:        { color: C.text, fontSize: 20, fontWeight: '800', maxWidth: 240 },
  modalSub:         { color: C.muted, fontSize: 13, marginTop: 4 },
  scoreBadgeLarge:  { backgroundColor: C.card, borderRadius: 12,
                      paddingHorizontal: 14, paddingVertical: 8 },
  scoreBadgeText:   { fontSize: 24, fontWeight: '900' },
  sectionLabel:     { color: C.muted, fontSize: 11, fontWeight: '700',
                      letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
  statRow:          { flexDirection: 'row', justifyContent: 'space-between',
                      paddingVertical: 7, borderBottomWidth: 1,
                      borderBottomColor: C.border },
  statLabel:        { color: C.sub, fontSize: 14 },
  statValue:        { color: C.text, fontSize: 14, fontWeight: '600' },
  divider:          { height: 1, backgroundColor: C.border, marginVertical: 16 },
  closeBtn:         { marginTop: 20, backgroundColor: C.card, borderRadius: 10,
                      paddingVertical: 14, alignItems: 'center' },
  closeBtnText:     { color: C.text, fontWeight: '700', fontSize: 15 },

  // Settings
  settingsContent:  { padding: 20, paddingBottom: 60 },
  settingsLabel:    { color: C.muted, fontSize: 11, fontWeight: '700',
                      letterSpacing: 1.5, marginBottom: 8 },
  settingsHint:     { color: C.muted, fontSize: 13, marginBottom: 12,
                      lineHeight: 18 },
  urlInput:         { backgroundColor: C.card, color: C.text, borderRadius: 10,
                      padding: 14, fontSize: 13, borderWidth: 1,
                      borderColor: C.border, marginBottom: 12 },
  saveBtn:          { backgroundColor: C.accent, borderRadius: 10,
                      paddingVertical: 14, alignItems: 'center' },
  saveBtnText:      { color: C.bg, fontWeight: '800', fontSize: 15 },
  formulaRow:       { flexDirection: 'row', justifyContent: 'space-between',
                      paddingVertical: 8, borderBottomWidth: 1,
                      borderBottomColor: C.border },
  formulaLabel:     { color: C.text, fontSize: 14 },
  formulaWeight:    { color: C.accent, fontSize: 14, fontWeight: '700' },
});