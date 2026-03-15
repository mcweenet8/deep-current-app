import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, StyleSheet, SafeAreaView,
  ScrollView, StatusBar, Image, RefreshControl,
} from 'react-native';

// ── API URL ───────────────────────────────────────────────────────────────────
const DEFAULT_API_URL = 'https://web-production-0e482.up.railway.app';

// ── Theme ─────────────────────────────────────────────────────────────────────
const C = {
  bg:        '#0A0A0F',
  surface:   '#13131A',
  card:      '#15151E',
  border:    '#18181F',
  accent:    '#6D5AE6',
  accentDim: '#1C1830',
  accentLt:  '#9D8DF1',
  green:     '#3DDC84',
  red:       '#FF6B6B',
  orange:    '#FF9500',
  blue:      '#60A5FA',
  text:      '#E8E8F0',
  muted:     '#6B7280',
  sub:       '#9CA3AF',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const scoreColor = (score) => {
  if (score >= 3.0) return '#00BFFF';  // electric blue
  if (score >= 2.0) return '#3DDC84';  // green
  if (score >= 1.0) return '#F0B429';  // yellow
  return '#FF6B6B';                    // red
};

const teamLogoUrl = (teamId) =>
  teamId ? `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png` : null;

const TeamLogo = ({ teamId, size = 20 }) => {
  const uri = teamLogoUrl(teamId);
  if (!uri) return <View style={{ width: size, height: size }} />;
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="contain"
    />
  );
};

const shortLeague = (l) => ({
  'Premier League': 'PL', 'Championship': 'CH',
  'La Liga': 'ESP', 'Serie A': 'ITA',
  'Bundesliga': 'GER', 'Ligue 1': 'FRA',
  'MLS': 'MLS', 'A-League Men': 'AUS',
}[l] || l?.slice(0, 3).toUpperCase());

const leagueLabel = (l) => {
  if (l && l.startsWith('MLS ')) return '🇺🇸 ' + l;
  return ({
  'Premier League': '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  'Championship':   '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  'La Liga':        '🇪🇸 La Liga',
  'Serie A':        '🇮🇹 Serie A',
  'Bundesliga':     '🇩🇪 Bundesliga',
  'Ligue 1':        '🇫🇷 Ligue 1',
  'MLS':            '🇺🇸 MLS',
  'A-League Men':   '🇦🇺 A-League Men',
}[l] || l || '');
};

const formatKickoff = (utcTime) => {
  if (!utcTime) return '';
  try {
    const d = new Date(utcTime);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday)    return `Today ${time}`;
    if (isTomorrow) return `Tomorrow ${time}`;
    return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
  } catch {
    return utcTime;
  }
};

const formDot = (result) => {
  const colors = { w: C.green, d: C.orange, l: C.red };
  return colors[result?.toLowerCase()] || C.muted;
};

// ── Form Pills ────────────────────────────────────────────────────────────────
const FormPills = ({ form }) => {
  if (!form || form.length === 0) return null;
  return (
    <View style={styles.formRow}>
      {form.map((r, i) => (
        <View key={i} style={[styles.formDot, { backgroundColor: formDot(r) }]} />
      ))}
    </View>
  );
};

// ── Player Avatar ────────────────────────────────────────────────────────────
const PlayerAvatar = ({ url, name, size = 36 }) => {
  const [failed, setFailed] = useState(false);
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '?';
  if (failed || !url) {
    return (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size/2 }]}>
        <Text style={[styles.avatarInitials, { fontSize: size * 0.35 }]}>{initials}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size/2 }}
      onError={() => setFailed(true)}
    />
  );
};

// ── Team Logo ─────────────────────────────────────────────────────────────────
// ── Stat Row ──────────────────────────────────────────────────────────────────
const StatRow = ({ label, value, highlight }) => (
  <View style={styles.statRow}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, highlight && { color: C.accent, fontWeight: '700' }]}>
      {value}
    </Text>
  </View>
);

// ── Player Detail Modal ───────────────────────────────────────────────────────
const PlayerModal = ({ player, onClose, apiUrl, colabUrl }) => {
  const [l5Data,    setL5Data]    = useState(null);
  const [l5Loading, setL5Loading] = useState(false);

  useEffect(() => {
    if (!player) return;
    setL5Data(null);
    const base = (colabUrl || '').replace(/\/$/, '');
    if (!base || !player.player_id || !player.team_id) return;
    setL5Loading(true);
    fetch(`${base}/player/${player.player_id}?team_id=${player.team_id}&name=${encodeURIComponent(player.player)}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setL5Data(d); })
      .catch(() => {})
      .finally(() => setL5Loading(false));
  }, [player?.player_id]);

  if (!player) return null;
  const isGoalScorer = player.gs_score !== undefined && player.tsoa_score === undefined;
  const isTSOA       = player.tsoa_score !== undefined;
  const score        = isTSOA ? player.tsoa_score : isGoalScorer ? player.gs_score : player.score;
  const gap          = isGoalScorer || isTSOA
    ? (player.xgot_gap >= 0 ? `+${player.xgot_gap}` : `${player.xgot_gap ?? 0}`)
    : (player.xa_gap >= 0   ? `+${player.xa_gap}`   : `${player.xa_gap}`);

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <PlayerAvatar url={player.player_img} name={player.player} size={52} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.modalName}>{player.player}</Text>
                  {isGoalScorer && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <Text style={{ color: C.orange, fontSize: 11, fontWeight: '700' }}>⚽ GOAL SCORER</Text>
                    </View>
                  )}
                  {isTSOA && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <Text style={{ color: C.accent, fontSize: 11, fontWeight: '700' }}>🎯 TO SCORE OR ASSIST</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.modalSub}>
                {player.team}  ·  {shortLeague(player.league)}
              </Text>
              {player.form && player.form.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  <FormPills form={player.form} />
                </View>
              )}
            </View>
            <View style={styles.scoreBadgeLarge}>
              <Text style={[styles.scoreBadgeText, { color: scoreColor(score) }]}>
                {score?.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Next opponent */}
          {player.next_opponent && (
            <View style={[styles.nextOppRow,
              player.weak_opp_def && styles.nextOppRowWeak]}>
              <Text style={styles.nextOppLabel}>Next: </Text>
              <Text style={styles.nextOppTeam}>{player.next_opponent}</Text>
              {player.weak_opp_def && (
                <Text style={styles.weakBadge}> 🛡️ Weak Defense</Text>
              )}
              {player.next_kickoff && (
                <Text style={styles.nextOppTime}>
                  {' · '}{formatKickoff(player.next_kickoff)}
                </Text>
              )}
            </View>
          )}

          {/* Goal scorer extra stats */}
          {isGoalScorer && (
            <View style={styles.gsStatsRow}>
              <View style={styles.gsStatItem}>
                <Text style={styles.gsStatVal}>⚽ {player.goals}</Text>
                <Text style={styles.gsStatLabel}>Goals</Text>
              </View>
              <View style={styles.gsStatItem}>
                <Text style={styles.gsStatVal}>{player.xg?.toFixed(1)}</Text>
                <Text style={styles.gsStatLabel}>xG</Text>
              </View>
              <View style={styles.gsStatItem}>
                <Text style={styles.gsStatVal}>{player.xgot?.toFixed(1)}</Text>
                <Text style={styles.gsStatLabel}>xGOT</Text>
              </View>
              <View style={styles.gsStatItem}>
                <Text style={[styles.gsStatVal, player.xgot_gap > 0 && { color: C.green }]}>
                  {gap}
                </Text>
                <Text style={styles.gsStatLabel}>xGOT Gap</Text>
              </View>
              <View style={styles.gsStatItem}>
                <Text style={styles.gsStatVal}>{player.sot_per90?.toFixed(2)}</Text>
                <Text style={styles.gsStatLabel}>SOT/90</Text>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>FORMULA BREAKDOWN</Text>
          {isTSOA ? (<>
            <StatRow label="xG/90      (×0.25)"  value={player.xg_per90?.toFixed(2)} />
            <StatRow label="xA/90      (×0.25)"  value={player.xa_per90?.toFixed(2)} />
            <StatRow label="xGOT Gap   (×0.20)"  value={player.xgot_gap?.toFixed(2)} highlight={player.xgot_gap > 0} />
            <StatRow label="xA Gap     (×0.20)"  value={player.xa_gap?.toFixed(2)}   highlight={player.xa_gap > 0} />
            <StatRow label="BC Combined(×0.10)"  value={player.bc_combined} />
          </>) : isGoalScorer ? (<>
            <StatRow label="xGOT Gap  (×0.35)"    value={gap}                                    highlight={player.xgot_gap > 0} />
            <StatRow label="SOT/90   (×0.25)"      value={player.sot_per90?.toFixed(2)} />
            <StatRow label="xG/90    (×0.20)"      value={player.xg_per90?.toFixed(2)} />
            <StatRow label="BC Missed (×0.20)"     value={player.big_chances_missed} />
          </>) : (<>
            <StatRow label="xA Gap  (×0.40)"      value={gap}                                highlight={player.xa_gap > 0} />
            <StatRow label="CC/Game (×0.30)"       value={player.chances_per_game?.toFixed(2)} />
            <StatRow label="Big Chances (×0.20)"   value={player.big_chances} />
            <StatRow label="Penalties Won (×0.10)" value={player.penalties_won} />
          </>)}

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>RAW STATS</Text>
          {isTSOA ? (<>
            <StatRow label="Goals"      value={player.goals} />
            <StatRow label="Assists"    value={player.assists} />
            <StatRow label="xG/90"      value={player.xg_per90?.toFixed(2)} />
            <StatRow label="xA/90"      value={player.xa_per90?.toFixed(2)} />
            <StatRow label="xGOT Gap"   value={player.xgot_gap?.toFixed(2)} highlight={player.xgot_gap > 0} />
            <StatRow label="xA Gap"     value={player.xa_gap?.toFixed(2)}   highlight={player.xa_gap > 0} />
            <StatRow label="BC Combined"value={player.bc_combined} />
          </>) : isGoalScorer ? (<>
            <StatRow label="Goals"     value={player.goals} />
            <StatRow label="xG"        value={player.xg?.toFixed(2)} />
            <StatRow label="xGOT"      value={player.xgot?.toFixed(2)} />
            <StatRow label="xGOT Gap"  value={gap} highlight={player.xgot_gap > 0} />
            <StatRow label="SOT/90"    value={player.sot_per90?.toFixed(2)} />
            <StatRow label="Shots/90"  value={player.shots_per90?.toFixed(2)} />
            <StatRow label="BC Missed" value={player.big_chances_missed} />
          </>) : (<>
            <StatRow label="Assists"  value={player.assists} />
            <StatRow label="xA"       value={player.xa?.toFixed(2)} />
            <StatRow label="xA Gap"   value={gap} highlight={player.xa_gap > 0} />
          </>)}
          {player.form_score != null && (
            <StatRow label="Form (last 5)" value={`${(player.form_score * 100).toFixed(0)}%`} />
          )}

          {/* L5 Games — only show when Colab is connected */}
          {colabUrl && <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>LAST 5 GAMES  ⚽ Goals  🅰️ Assists</Text>
          {l5Loading && (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={C.accent} />
            </View>
          )}
          {!l5Loading && l5Data?.l5_games?.length > 0 && (
            <>
              {l5Data.l5_games.map((g, i) => (
                <View key={i} style={styles.l5Row}>
                  <View style={[styles.l5ResultBadge, {
                    backgroundColor: g.result==='W' ? '#1A2E1A' : g.result==='D' ? '#2A2A1A' : '#2E1A1A',
                    borderColor:     g.result==='W' ? C.green   : g.result==='D' ? C.orange  : C.red,
                  }]}>
                    <Text style={[styles.l5ResultText, {
                      color: g.result==='W' ? C.green : g.result==='D' ? C.orange : C.red
                    }]}>{g.result}</Text>
                  </View>
                  <View style={styles.l5Info}>
                    <Text style={styles.l5Opponent} numberOfLines={1}>vs {g.opponent}</Text>
                    <Text style={styles.l5Score}>{g.score}  ·  {g.date}</Text>
                  </View>
                  <View style={styles.l5StatBlock}>
                    <Text style={styles.l5StatVal}>⚽ {g.goals ?? 0}</Text>
                    <Text style={styles.l5StatVal}>🅰️ {g.assists ?? 0}</Text>
                  </View>
                </View>
              ))}
              <View style={styles.l5TotalsRow}>
                <Text style={styles.l5TotalLabel}>L5 Totals</Text>
                <Text style={styles.l5TotalVal}>
                  ⚽ {l5Data.l5_goals_total ?? 0}  🅰️ {l5Data.l5_assists_total ?? 0}
                </Text>
              </View>
            </>
          )}
          {!l5Loading && colabUrl && (!l5Data?.l5_games || l5Data.l5_games.length === 0) && (
            <Text style={styles.l5Empty}>No recent match data</Text>
          )}
          </>}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ── Player Row ────────────────────────────────────────────────────────────────
const PlayerRow = ({ player, rank, onPress }) => (
  <TouchableOpacity style={styles.playerRow} onPress={() => onPress(player)}>
    <Text style={styles.rank}>{rank}</Text>
    <View style={{ position: 'relative', marginRight: 10 }}>
      <PlayerAvatar url={player.player_img} name={player.player} size={38} />
      <View style={styles.teamLogoBadge}>
        <TeamLogo teamId={player.team_id} size={14} />
      </View>
    </View>
    <View style={styles.playerInfo}>
      <View style={styles.playerNameRow}>
        <Text style={styles.playerName} numberOfLines={1}>{player.player}</Text>
        {player.weak_opp_def && <Text style={styles.weakIcon}>🛡️</Text>}
      </View>
      <View style={styles.playerMetaRow}>
        <Text style={[styles.playerSub, { flex: 1 }]} numberOfLines={1}>
          {player.team}  ·  {shortLeague(player.league)}
          {player.next_opponent
            ? <Text style={player.weak_opp_def ? { color: C.green } : {}}> · vs {player.next_opponent}</Text>
            : null}
        </Text>
        {player.form && player.form.length > 0 && <FormPills form={player.form} />}
      </View>
    </View>
    <Text style={[styles.score, { color: scoreColor(player.score ?? player.gs_score ?? player.tsoa_score ?? 0) }]}>
      {(player.score ?? player.gs_score ?? player.tsoa_score ?? 0).toFixed(2)}
    </Text>
  </TouchableOpacity>
);

// ── Fixture Card ──────────────────────────────────────────────────────────────
const FixtureCard = ({ match, onPress }) => {
  const isLive     = match.live;
  const isFinished = match.finished;
  return (
    <TouchableOpacity
      style={[styles.fixtureCard, isLive && styles.fixtureCardLive]}
      onPress={() => onPress && onPress(match)}
      activeOpacity={0.75}>
      {isLive && (
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>● LIVE {match.minute}</Text>
        </View>
      )}
      <View style={styles.fixtureTeams}>
        <View style={styles.fixtureTeamBlock}>
          <TeamLogo teamId={match.home_id} size={24} />
          <Text style={[styles.fixtureTeam, { marginLeft: 6 }]} numberOfLines={1}>{match.home}</Text>
        </View>
        <View style={styles.fixtureScoreBox}>
          {(isLive || isFinished) && match.score
            ? <Text style={styles.fixtureScore}>{match.score}</Text>
            : <Text style={styles.fixtureTime}>{formatKickoff(match.kickoff)}</Text>
          }
        </View>
        <View style={[styles.fixtureTeamBlock, styles.fixtureTeamBlockRight]}>
          <Text style={[styles.fixtureTeam, styles.fixtureTeamRight, { marginRight: 6 }]} numberOfLines={1}>{match.away}</Text>
          <TeamLogo teamId={match.away_id} size={24} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ── Match Screen (full screen) ───────────────────────────────────────────────
const MatchScreen = ({ match, apiUrl, colabUrl, top25, onClose, squadOnly = false }) => {
  const [data, setData]             = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [error, setError]           = useState(null);
  const [squadPlayer, setSquadPlayer] = useState(null);
  const [focusTeam,   setFocusTeam]   = useState(null);
  const [showTeamStats, setShowTeamStats] = useState(null); // 'home' | 'away' | null
  const [lineups, setLineups]       = useState(null);
  const [lineupLoading, setLineupLoading] = useState(false);
  const [liveStats,    setLiveStats]    = useState(null);
  const [squadMetric,  setSquadMetric]  = useState('assists');

  const sortedHomePlayers = React.useMemo(() => {
    if (!data?.home_players) return [];
    const getScore = (p) => {
      if (squadMetric === 'goals') return typeof p.gs_score === 'number' ? p.gs_score : -1;
      if (squadMetric === 'tsoa')  return typeof p.tsoa_score === 'number' ? p.tsoa_score : -1;
      return typeof p.score === 'number' ? p.score : 0;
    };
    return [...data.home_players].sort((a, b) => getScore(b) - getScore(a));
  }, [data?.home_players, squadMetric]);

  const sortedAwayPlayers = React.useMemo(() => {
    if (!data?.away_players) return [];
    const getScore = (p) => {
      if (squadMetric === 'goals') return typeof p.gs_score === 'number' ? p.gs_score : -1;
      if (squadMetric === 'tsoa')  return typeof p.tsoa_score === 'number' ? p.tsoa_score : -1;
      return typeof p.score === 'number' ? p.score : 0;
    };
    return [...data.away_players].sort((a, b) => getScore(b) - getScore(a));
  }, [data?.away_players, squadMetric]);

  const base = apiUrl.replace(/\/$/, '');

  useEffect(() => {
    // Fetch confirmed lineups in parallel
    if (match.kickoff && !match.finished) {
      setLineupLoading(true);
      fetch(`${base}/lineups/${match.match_id}?home=${encodeURIComponent(match.home)}&away=${encodeURIComponent(match.away)}&kickoff=${encodeURIComponent(match.kickoff)}`)
        .then(r => r.json())
        .then(d => { if (d.confirmed) setLineups(d.lineups); })
        .catch(() => {})
        .finally(() => setLineupLoading(false));
    }
    if (match.live) {
      fetch(`${base}/live/${match.match_id}`)
        .then(r => r.json())
        .then(d => {
          console.log('live data:', JSON.stringify(d).slice(0,200));
          if (!d.error) setLiveStats(d);
          else console.warn('live error:', d.error);
        })
        .catch(e => console.error('live fetch failed:', e));
    }

    const fetchMatch = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          home_id:  match.home_id,
          away_id:  match.away_id,
          home:     match.home,
          away:     match.away,
          live:     match.live     ? 'true' : 'false',
          finished: match.finished ? 'true' : 'false',
        });
        const res  = await fetch(`${base}/match/${match.match_id}?${params}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMatch();
  }, [match.match_id]);

  const isLive     = match.live;
  const isFinished = match.finished;

  const PlayerSquadRow = ({ p, side, onPress, metric = 'assists' }) => {
    const displayScore = metric === 'goals'  ? p.gs_score
                       : metric === 'tsoa'   ? p.tsoa_score
                       : p.score;
    const subText = metric === 'goals'
      ? `xG/90 ${p.xg_per90?.toFixed(2) ?? '-'}  ·  SOT ${p.sot_per90?.toFixed(2) ?? '-'}  ·  Goals ${p.goals ?? '-'}`
      : metric === 'tsoa'
      ? `xG/90 ${p.xg_per90?.toFixed(2) ?? '-'}  ·  xA/90 ${p.xa_per90?.toFixed(2) ?? '-'}  ·  G+A ${(p.goals ?? 0) + (p.assists ?? 0)}`
      : `xA Gap ${p.xa_gap >= 0 ? '+' : ''}${p.xa_gap?.toFixed(2) ?? '-'}  ·  CC/G ${p.chances_per_game?.toFixed(2) ?? '-'}  ·  BC ${p.big_chances ?? '-'}`;
    return (
      <TouchableOpacity
        style={[styles.squadRow, p.in_top25 && styles.squadRowHighlight]}
        onPress={() => {
          if (!onPress) return;
          // Strip scores from other markets so modal shows correct formula
          const p2 = { ...p };
          if (metric === 'assists') { delete p2.gs_score; delete p2.tsoa_score; }
          if (metric === 'goals')   { delete p2.tsoa_score; delete p2.score; }
          if (metric === 'tsoa')    { delete p2.gs_score; delete p2.score; }
          onPress(p2);
        }}
        activeOpacity={0.75}>
        <View style={{ position: 'relative', marginRight: 8 }}>
          <PlayerAvatar url={p.player_img} name={p.player} size={32} />
          <View style={styles.teamLogoBadge}>
            <TeamLogo teamId={p.team_id} size={12} />
          </View>
        </View>
        <View style={[styles.squadPlayerInfo, { marginLeft: 8 }]}>
          <View style={styles.squadNameRow}>
            {p.in_top25 && <Text style={styles.starBadge}>★ </Text>}
            <Text style={[styles.squadPlayerName,
              p.in_top25 && styles.squadPlayerNameHighlight]}
              numberOfLines={1}>
              {p.player}
            </Text>
            {p.weak_opp && <Text style={styles.weakIconSmall}> 🛡️</Text>}
          </View>
          <Text style={styles.squadPlayerSub}>{subText}</Text>
        </View>
        <Text style={[styles.squadScore, { color: scoreColor(displayScore ?? 0) }]}>
          {displayScore != null ? displayScore.toFixed(2) : '-'}
        </Text>
      </TouchableOpacity>
    );
  };

  const LineupSection = ({ title, players }) => {
    if (!players || players.length === 0) return null;
    return (
      <View style={styles.lineupSection}>
        <Text style={styles.sectionLabel}>{title}</Text>
        <View style={styles.lineupGrid}>
          {players.map((p, i) => (
            <View key={i} style={[styles.lineupPill,
              p.in_top25 && styles.lineupPillHighlight]}>
              <Text style={[styles.lineupName,
                p.in_top25 && styles.lineupNameHighlight]}
                numberOfLines={1}>
                {p.in_top25 ? `★ ${p.name}` : p.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />

        {/* Header */}
        <View style={styles.matchHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          {isLive && (
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>● LIVE {match.minute}</Text>
            </View>
          )}
        </View>

        {/* Score bar — hidden when viewing squad directly from standings */}
        {!squadOnly && <View style={styles.scoreBar}>
          <TouchableOpacity
            style={styles.scoreTeamBlock}
            onPress={() => {
              setFocusTeam(focusTeam === 'home' ? null : 'home');
              setShowTeamStats(showTeamStats === 'home' ? null : 'home');
            }}>
            <TeamLogo teamId={match.home_id} size={36} />
            <Text style={[styles.scoreTeam,
              focusTeam === 'home' && { color: C.accent },
              { marginTop: 6 }]} numberOfLines={2}>{match.home}</Text>
          </TouchableOpacity>
          <View style={styles.scoreCenter}>
            {(isLive || isFinished) && match.score
              ? <Text style={styles.scoreLarge}>{match.score}</Text>
              : <Text style={styles.scoreVs}>vs</Text>}
            <Text style={styles.scoreKickoff}>{formatKickoff(match.kickoff)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.scoreTeamBlock, { alignItems: 'flex-end' }]}
            onPress={() => {
              setFocusTeam(focusTeam === 'away' ? null : 'away');
              setShowTeamStats(showTeamStats === 'away' ? null : 'away');
            }}>
            <TeamLogo teamId={match.away_id} size={36} />
            <Text style={[styles.scoreTeam, styles.scoreTeamRight,
              focusTeam === 'away' && { color: C.accent },
              { marginTop: 6 }]} numberOfLines={2}>{match.away}</Text>
          </TouchableOpacity>
        </View>}

        {/* Weak def banners */}
        {data && (
          <View style={styles.weakDefRow}>
            {data.away_weak_def && (
              <View style={styles.weakDefBanner}>
                <Text style={styles.weakDefText}>🛡️ {match.away} — Weak Defense</Text>
              </View>
            )}
            {data.home_weak_def && (
              <View style={styles.weakDefBanner}>
                <Text style={styles.weakDefText}>🛡️ {match.home} — Weak Defense</Text>
              </View>
            )}
          </View>
        )}

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={[styles.emptySub, { marginTop: 12 }]}>
              {isLive ? 'Loading live data...' : 'Loading squad data...'}
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.center}>
            <Text style={styles.errorText}>⚠ {error}</Text>
          </View>
        )}

        {data && !loading && (
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

            {/* Live lineups if available */}
            {data.lineups && (
              <>
                <LineupSection
                  title={`${match.home.toUpperCase()} LINEUP`}
                  players={data.lineups.home}
                />
                <LineupSection
                  title={`${match.away.toUpperCase()} LINEUP`}
                  players={data.lineups.away}
                />
                <View style={styles.divider} />
              </>
            )}

            {/* Confirmed lineups if available */}
            {lineupLoading && (
              <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={C.green} />
                <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
                  {match.live ? 'Loading starting XI...' : 'Checking for confirmed lineup...'}
                </Text>
              </View>
            )}
            {lineups && (() => {
              const findTeam = (name) => {
                const clean = s => s.toLowerCase().replace(/[^a-z0-9]/g,'');
                const namec = clean(name);
                return Object.entries(lineups).find(([k]) => {
                  const kc = clean(k);
                  if (kc === namec) return true;
                  if (kc.includes(namec) || namec.includes(kc)) return true;
                  const kWords = k.toLowerCase().split(' ').filter(w => w.length > 2);
                  const nWords = name.toLowerCase().split(' ').filter(w => w.length > 2);
                  return kWords.some(w => nWords.some(n => clean(w) === clean(n)));
                });
              };

              const parseFormation = (str) => {
                if (!str) return [4,4,2];
                return str.split('-').map(Number).filter(n => n > 0);
              };

              const buildRows = (starters, formationStr, reversed) => {
                const rows = parseFormation(formationStr);
                const result = [[starters[0]]];
                let idx = 1;
                rows.forEach(count => {
                  result.push(starters.slice(idx, idx + count));
                  idx += count;
                });
                return reversed ? result.reverse() : result;
              };

              const findPlayerImg = (playerName, teamPlayers) => {
                const clean = (s) => (s || '').toLowerCase().replace(/[^a-z]/g,'');
                const afParts = playerName.split(' ')
                  .map(w => w.replace('.','').trim())
                  .filter(w => w.length > 2 && !w.match(/^[A-Z]$/));
                const afLastName = clean(afParts[afParts.length - 1] || '');
                const allP = [...(teamPlayers || []),
                              ...(data?.home_players || []),
                              ...(data?.away_players || [])];
                let found = allP.find(p => clean(p.player) === clean(playerName));
                if (!found && afLastName.length >= 4)
                  found = allP.find(p => clean(p.player?.split(' ').pop() || '') === afLastName);
                if (!found && afLastName.length >= 4)
                  found = allP.find(p => clean(p.player || '').includes(afLastName));
                if (!found)
                  found = allP.find(p => {
                    const pc = clean(p.player || '');
                    return afParts.filter(w => w.length >= 4).some(part => pc.includes(clean(part)));
                  });
                return found?.player_img || null;
              };

              const homeEntry = findTeam(match.home);
              const awayEntry = findTeam(match.away);
              if (!homeEntry && !awayEntry) return null;

              const homeLineup = homeEntry ? homeEntry[1] : null;
              const awayLineup = awayEntry ? awayEntry[1] : null;
              const homeRows = homeLineup ? buildRows(homeLineup.starters, homeLineup.formation, true) : [];
              const awayRows = awayLineup ? buildRows(awayLineup.starters, awayLineup.formation, false) : [];

              const renderPitchRow = (row, side, key, isGKRow) => (
                <View key={key} style={styles.pitchRow}>
                  {row.map((p, pi) => {
                    const teamPs = side === 'home' ? (data?.home_players||[]) : (data?.away_players||[]);
                    const img = findPlayerImg(p.name, teamPs);
                    const isGK = p.pos === 'G' || isGKRow;
                    const isHome = side === 'home';
                    return (
                      <View key={pi} style={styles.pitchPlayer}>
                        <View style={[styles.pitchAvatarRing,
                          isGK && styles.pitchAvatarRingGK,
                          !isHome && styles.pitchAvatarRingAway]}>
                          <PlayerAvatar url={img} name={p.name} size={28} />
                        </View>
                        <View style={[styles.pitchNumBadge, !isHome && styles.pitchNumBadgeAway]}>
                          <Text style={styles.pitchNum}>{p.number}</Text>
                        </View>
                        <Text style={[styles.pitchName, !isHome && styles.pitchNameAway]} numberOfLines={1}>
                          {p.name.split(' ').pop()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );

              return (
                <View style={styles.pitchContainer}>
                  {/* Header */}
                  <View style={styles.pitchHeader}>
                    <TeamLogo teamId={match.home_id} size={18} />
                    <Text style={[styles.pitchTitle, { flex: 1 }]}>{match.home}</Text>
                    <Text style={styles.pitchFormation}>
                      {homeLineup?.formation || ''} {match.live ? '⚽' : '✅'} {awayLineup?.formation || ''}
                    </Text>
                    <Text style={[styles.pitchTitle, { flex: 1, textAlign: 'right' }]}>{match.away}</Text>
                    <TeamLogo teamId={match.away_id} size={18} />
                  </View>

                  {/* Single pitch */}
                  <View style={styles.pitch}>
                    <View style={styles.pitchCentreCircle} />
                    <View style={styles.pitchCentreLine} />
                    <View style={[styles.pitchBox, { top: 4 }]} />
                    <View style={[styles.pitchBox, { bottom: 4 }]} />

                    {/* Away — GK at top, attackers towards centre */}
                    {awayRows.map((row, ri) => renderPitchRow(row, 'away', `a${ri}`, ri === 0))}

                    <View style={styles.pitchMidline} />

                    {/* Home — attackers towards centre, GK at bottom */}
                    {homeRows.map((row, ri) => renderPitchRow(row, 'home', `h${ri}`, ri === homeRows.length - 1))}
                  </View>

                  {/* Benches */}
                  <View style={styles.benchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.benchLabel}>{match.home} subs</Text>
                      <Text style={styles.benchNames} numberOfLines={2}>
                        {homeLineup?.bench?.slice(0,5).map(p => p.name.split(' ').pop()).join(' · ')}
                      </Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: '#1A3A1A', marginHorizontal: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.benchLabel, { textAlign: 'right' }]}>{match.away} subs</Text>
                      <Text style={[styles.benchNames, { textAlign: 'right' }]} numberOfLines={2}>
                        {awayLineup?.bench?.slice(0,5).map(p => p.name.split(' ').pop()).join(' · ')}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* Live match stats — only for live games */}
            {match.live && !liveStats && (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={C.green} />
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>
                  Loading live stats...
                </Text>
              </View>
            )}
            {match.live && liveStats && (() => {
              const homeColor = liveStats.home_color || C.accent;
              const awayColor = liveStats.away_color || '#E85D5D';
              return (
              <View style={styles.liveSection}>

                {/* Goal events */}
                {liveStats.events?.filter(e => e.type === 'goal' || e.type === 'owngoal').length > 0 && (
                  <View style={styles.liveEventsBox}>
                    {liveStats.events
                      .filter(e => ['goal','owngoal','yellow','red','sub'].includes(e.type))
                      .map((e, i) => {
                        const isHome = e.side === 'home';
                        const icon = e.type === 'goal' ? '⚽'
                          : e.type === 'owngoal' ? '⚽ OG'
                          : e.type === 'yellow' ? '🟨'
                          : e.type === 'red' ? '🟥'
                          : '🔄';
                        return (
                          <View key={i} style={[styles.liveEventRow,
                            isHome ? styles.liveEventHome : styles.liveEventAway]}>
                            {!isHome && <Text style={styles.liveEventMin}>{e.minute}'</Text>}
                            <Text style={styles.liveEventIcon}>{icon}</Text>
                            <View style={styles.liveEventInfo}>
                              <Text style={styles.liveEventPlayer}>{e.player}</Text>
                              {e.assist ? <Text style={styles.liveEventAssist}>🅰️ {e.assist}</Text> : null}
                              {e.type === 'sub' ? <Text style={styles.liveEventAssist}>↓ {e.playerOut}</Text> : null}
                            </View>
                            {isHome && <Text style={styles.liveEventMin}>{e.minute}'</Text>}
                          </View>
                        );
                    })}
                  </View>
                )}

                {/* Possession pie + shots bar */}
                {liveStats.stats && (
                  <View style={styles.liveStatsBox}>
                    {/* Possession */}
                    {liveStats.stats.possession && (() => {
                      const h = liveStats.stats.possession[0];
                      const a = liveStats.stats.possession[1];
                      return (
                        <View style={styles.liveStatRow}>
                          <Text style={styles.liveStatLabel}>Possession</Text>
                          <View style={styles.liveBar}>
                            <View style={[styles.liveBarHome, { flex: h, backgroundColor: homeColor }]} />
                            <View style={[styles.liveBarAway, { flex: a, backgroundColor: awayColor }]} />
                          </View>
                          <View style={styles.liveBarLabels}>
                            <Text style={[styles.liveBarValHome, { color: homeColor }]}>{h}%</Text>
                            <Text style={[styles.liveBarValAway, { color: awayColor }]}>{a}%</Text>
                          </View>
                        </View>
                      );
                    })()}

                    {/* Shots */}
                    {liveStats.stats.shots && (() => {
                      const h = liveStats.stats.shots[0];
                      const a = liveStats.stats.shots[1];
                      const ht = liveStats.stats.shots_on_target?.[0] || 0;
                      const at = liveStats.stats.shots_on_target?.[1] || 0;
                      const max = Math.max(h, a, 1);
                      return (
                        <View style={styles.liveStatRow}>
                          <Text style={styles.liveStatLabel}>Shots (on target)</Text>
                          <View style={styles.liveShotsRow}>
                            <View style={styles.liveShotsBlock}>
                              <View style={[styles.liveShotsBar,
                                { width: `${(h/max)*100}%`, backgroundColor: homeColor }]} />
                              <View style={[styles.liveShotsBar,
                                { width: `${(ht/max)*100}%`, backgroundColor: homeColor + '88',
                                  marginTop: 3 }]} />
                            </View>
                            <View style={styles.liveShotsMid}>
                              <Text style={styles.liveShotsMidText}>{h} | {a}</Text>
                              <Text style={[styles.liveShotsMidText, { fontSize: 10 }]}>{ht} | {at}</Text>
                            </View>
                            <View style={[styles.liveShotsBlock, { alignItems: 'flex-end' }]}>
                              <View style={[styles.liveShotsBar,
                                { width: `${(a/max)*100}%`, backgroundColor: awayColor }]} />
                              <View style={[styles.liveShotsBar,
                                { width: `${(at/max)*100}%`, backgroundColor: awayColor + '88',
                                  marginTop: 3 }]} />
                            </View>
                          </View>
                        </View>
                      );
                    })()}

                    {/* xG */}
                    {liveStats.stats.xg && (() => {
                      const h = liveStats.stats.xg[0];
                      const a = liveStats.stats.xg[1];
                      const max = Math.max(h, a, 0.1);
                      return (
                        <View style={styles.liveStatRow}>
                          <Text style={styles.liveStatLabel}>xG</Text>
                          <View style={styles.liveBar}>
                            <View style={[styles.liveBarHome, { flex: h/max, backgroundColor: homeColor }]} />
                            <View style={[styles.liveBarAway, { flex: a/max, backgroundColor: awayColor }]} />
                          </View>
                          <View style={styles.liveBarLabels}>
                            <Text style={[styles.liveBarValHome, { color: homeColor }]}>{h}</Text>
                            <Text style={[styles.liveBarValAway, { color: awayColor }]}>{a}</Text>
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                )}
              </View>
              );
            })()}

            {/* Team stats card — shows when team logo tapped */}
            {showTeamStats && data && (
              <TeamStatsCard
                teamStats={showTeamStats === 'home' ? data.home_stats : data.away_stats}
                teamName={showTeamStats === 'home' ? match.home : match.away}
                isHome={showTeamStats === 'home'}
                fallbackGa={showTeamStats === 'home' ? data.home_ga_pg : data.away_ga_pg}
              />
            )}

            {/* Home + Away squad with market toggle */}
            {!match.live && (data.home_players?.length > 0 || data.away_players?.length > 0) && (
              <>
                {/* Market toggle pills */}
                <View style={styles.squadToggleRow}>
                  {[['assists','Assists'],['goals','Goals'],['tsoa','TSOA']].map(([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.squadTogglePill,
                        squadMetric === key && styles.squadTogglePillActive]}
                      onPress={() => setSquadMetric(key)}>
                      <Text style={[styles.squadToggleText,
                        squadMetric === key && styles.squadToggleTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {[['home', match.home, sortedHomePlayers, data.away_weak_def],
                  ['away', match.away, sortedAwayPlayers, data.home_weak_def]
                ].map(([side, name, players, weakDef]) => {
                  if (!players?.length) return null;
                  if (focusTeam === 'home' && side === 'away') return null;
                  if (focusTeam === 'away' && side === 'home') return null;
                  return (
                    <View key={side}>
                      <Text style={[styles.squadHeader, side === 'away' && { marginTop: 8 }]}>
                        {name.toUpperCase()}
                        {weakDef ? '  🛡️ Weak Defense' : ''}
                      </Text>
                      {players.slice(0, 8).map((p, i) => (
                        <PlayerSquadRow key={i} p={p} side={side} onPress={setSquadPlayer} metric={squadMetric} />
                      ))}
                    </View>
                  );
                })}
              </>
            )}

            {!match.live && data.home_players?.length === 0 && data.away_players?.length === 0 && (
              <View style={styles.center}>
                <Text style={styles.emptyText}>No player data for these teams</Text>
                <Text style={styles.emptySub}>
                  These teams may not be in your tracked leagues
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      {/* Player modal slides up on top of match screen */}
      <PlayerModal
        player={squadPlayer}
        onClose={() => setSquadPlayer(null)}
        apiUrl={apiUrl}
        colabUrl={colabUrl}
      />
    </SafeAreaView>
    </Modal>
  );
};

// ── Team Stats Card ──────────────────────────────────────────────────────────
const TeamStatsCard = ({ teamStats, teamName, isHome, fallbackGa }) => {
  // Use full stats if available, otherwise show basic card with fallback
  const s = teamStats || {};
  const hasFullStats = s.played > 0;

  const StatLine = ({ label, val, avg, better }) => {
    if (val == null) return null;
    const color = better === 'high'
      ? (val >= avg ? C.green : C.red)
      : (val <= avg ? C.green : C.red);
    return (
      <View style={styles.teamStatLine}>
        <Text style={styles.teamStatLabel}>{label}</Text>
        <Text style={[styles.teamStatVal, { color }]}>{val?.toFixed(2)}</Text>
        {avg != null && <Text style={styles.teamStatAvg}>avg {avg?.toFixed(2)}</Text>}
      </View>
    );
  };

  if (!hasFullStats) {
    // Basic fallback card
    return (
      <View style={styles.teamStatsCard}>
        <View style={styles.teamStatsHeader}>
          <Text style={styles.teamStatsTitle}>{teamName.toUpperCase()}</Text>
          <Text style={styles.teamStatsPos}>{isHome ? '🏠 Home' : '✈️ Away'}</Text>
        </View>
        {fallbackGa != null && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
            <Text style={[styles.teamStatVal, {
              color: fallbackGa >= 1.5 ? C.red : C.green, fontSize: 14 }]}>
              GA/G: {fallbackGa?.toFixed(2)}
            </Text>
            {fallbackGa >= 1.5 && (
              <Text style={{ color: C.red, fontSize: 11, marginTop: 4 }}>🛡️ Weak Defense</Text>
            )}
          </View>
        )}
      </View>
    );
  }

  const gf_loc = isHome ? s.gf_h_pg : s.gf_a_pg;
  const ga_loc = isHome ? s.ga_h_pg : s.ga_a_pg;

  return (
    <View style={styles.teamStatsCard}>
      <View style={styles.teamStatsHeader}>
        <Text style={styles.teamStatsTitle}>{teamName.toUpperCase()}</Text>
        <Text style={styles.teamStatsPos}>#{s.table_pos}  ·  {s.played} played</Text>
      </View>
      <View style={styles.teamStatsDivider} />
      <Text style={styles.teamStatsSection}>{isHome ? '🏠 HOME' : '✈️ AWAY'} RECORD</Text>
      <StatLine label="Goals For/G"     val={gf_loc}  avg={s.gf_pg} better="high" />
      <StatLine label="Goals Against/G" val={ga_loc}  avg={s.ga_pg} better="low" />
      <View style={styles.teamStatsDivider} />
      <Text style={styles.teamStatsSection}>SEASON OVERALL</Text>
      <StatLine label="Goals For/G"     val={s.gf_pg} avg={s.gf_pg} better="high" />
      <StatLine label="Goals Against/G" val={s.ga_pg} avg={s.ga_pg} better="low" />
      {s.weak_def && (
        <View style={[styles.weakDefBanner, { margin: 8 }]}>
          <Text style={styles.weakDefText}>🛡️ Weak Defense (GA/G ≥ 1.5)</Text>
        </View>
      )}
    </View>
  );
};

// ── Fixtures Tab ──────────────────────────────────────────────────────────────
const FixturesTab = ({ fixtures, loading, onLoad, onMatchPress }) => {
  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={C.accent} />
    </View>
  );
  if (!fixtures || Object.keys(fixtures).length === 0) return (
    <View style={styles.center}>
      <Text style={styles.emptyIcon}>📅</Text>
      <Text style={styles.emptyText}>No fixtures loaded</Text>
      <TouchableOpacity style={styles.loadBtn} onPress={onLoad}>
        <Text style={styles.loadBtnText}>Load Fixtures</Text>
      </TouchableOpacity>
    </View>
  );

  // Flatten + dedupe by match_id + sort
  const seen = new Set();
  const allMatches = [];
  Object.entries(fixtures).forEach(([league, matches]) => {
    matches.forEach(m => {
      if (m.match_id && seen.has(m.match_id)) return;
      if (m.match_id) seen.add(m.match_id);
      allMatches.push({ ...m, league });
    });
  });

  const live     = allMatches.filter(m => m.live);
  const upcoming = allMatches.filter(m => !m.live && !m.finished)
                             .sort((a,b) => (a.kickoff||'').localeCompare(b.kickoff||''));
  const finished = allMatches.filter(m => m.finished)
                             .sort((a,b) => (b.kickoff||'').localeCompare(a.kickoff||''));

  const sections = [];
  if (live.length > 0)     sections.push({ title: '🔴 LIVE', data: live });
  if (upcoming.length > 0) sections.push({ title: 'UPCOMING', data: upcoming });
  if (finished.length > 0) sections.push({ title: 'RESULTS', data: finished });

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onLoad}
          tintColor={C.accent} colors={[C.accent]} />
      }>
      {sections.map(({ title, data }) => (
        <View key={title}>
          <Text style={styles.fixturesSectionHeader}>{title}</Text>
          {data.map((match, i) => (
            <View key={match.match_id || i}>
              <Text style={styles.fixtureLeagueLabel}>{leagueLabel(match.league)}</Text>
              <FixtureCard match={match} onPress={onMatchPress} />
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
};

// ── League Drill-Down ─────────────────────────────────────────────────────────
const LeagueView = ({ byLeague, onPlayerPress }) => {
  const [openLeague, setOpenLeague] = useState(null);
  const [openTeam,   setOpenTeam]   = useState(null);
  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: 40 }}>
      {Object.entries(byLeague).map(([league, teams]) => (
        <View key={league}>
          <TouchableOpacity
            style={styles.leagueHeader}
            onPress={() => setOpenLeague(openLeague === league ? null : league)}>
            <Text style={styles.leagueTitle}>{league}</Text>
            <Text style={styles.chevron}>{openLeague === league ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {openLeague === league && teams.length === 0 && (
            <View style={{ padding: 16, paddingLeft: 24 }}>
              <Text style={{ color: C.muted, fontSize: 13 }}>
                No player stats available for this league
              </Text>
            </View>
          )}
          {openLeague === league && teams.map(({ team, players }) => (
            <View key={team}>
              <TouchableOpacity
                style={styles.teamHeader}
                onPress={() => setOpenTeam(openTeam === team ? null : team)}>
                <Text style={styles.teamTitle}>{team}</Text>
                <Text style={styles.teamCount}>
                  {players.length} players  {openTeam === team ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
              {openTeam === team && players.map((p, i) => (
                <PlayerRow key={p.player+i} player={p} rank={i+1} onPress={onPlayerPress} />
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
};

// ── Sub Tab Bar ───────────────────────────────────────────────────────────────
const SubTabBar = ({ tabs, active, onChange }) => (
  <View style={styles.subTabBar}>
    {tabs.map(([key, label]) => (
      <TouchableOpacity
        key={key}
        style={[styles.subTabItem, active === key && styles.subTabItemActive]}
        onPress={() => onChange(key)}>
        <Text style={[styles.subTabLabel, active === key && styles.subTabLabelActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

// ── All Players Tab ───────────────────────────────────────────────────────────
const LEAGUES_LIST = ['All','Premier League','Championship','La Liga','Serie A','Bundesliga','Ligue 1','MLS','A-League Men'];
const POSITIONS    = ['All','FW','MF','DF'];

const AllPlayersTab = ({ data, filter, setFilter, onPlayerPress, isGoals = false, isTSOA = false }) => {
  const allPlayers = data?.all_players || [];

  // Apply filters
  const filtered = allPlayers.filter(p => {
    if (!isGoals && !isTSOA && filter.minAssists > 0  && (p.assists  || 0) < filter.minAssists) return false;
    if (!isGoals && !isTSOA && filter.minXaGap > -99 && (p.xa_gap   || 0) < filter.minXaGap)   return false;
    if (isGoals  && filter.minGoals  > 0  && (p.goals    || 0) < filter.minGoals)    return false;
    if (isGoals  && filter.minXgGap  > 0  && (p.xgot_gap || 0) < filter.minXgGap)   return false;
    if (isTSOA   && filter.minTSOAGoals > 0 && (p.goals   || 0) < filter.minTSOAGoals) return false;
    if (isTSOA   && filter.minTSOAAssists > 0 && (p.assists || 0) < filter.minTSOAAssists) return false;
    if (filter.league !== 'All' && p.league !== filter.league)                        return false;
    if (filter.weakOpp && !p.weak_opp_def)                                            return false;
    if (filter.minWStreak > 0) {
      const wStreak = (p.form || []).slice(-filter.minWStreak)
                        .filter(r => r === 'w').length;
      if (wStreak < filter.minWStreak) return false;
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!p.player?.toLowerCase().includes(q) && !p.team?.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (b.score ?? b.gs_score ?? b.tsoa_score ?? 0) - (a.score ?? a.gs_score ?? a.tsoa_score ?? 0));

  const activeFilters = [
    !isGoals && !isTSOA ? filter.minAssists > 0 : false,
    !isGoals && !isTSOA ? filter.minXaGap > -99 : false,
    isGoals ? filter.minGoals > 0 : false,
    isGoals ? filter.minXgGap > 0 : false,
    isTSOA  ? filter.minTSOAGoals > 0 : false,
    isTSOA  ? filter.minTSOAAssists > 0 : false,
    filter.league !== 'All',
    filter.weakOpp,
    filter.minWStreak > 0,
  ].filter(Boolean).length;

  return (
    <View style={styles.flex}>
      {/* Filter bar */}
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search player or team..."
          placeholderTextColor={C.muted}
          value={filter.search || ''}
          onChangeText={v => setFilter(f => ({ ...f, search: v }))}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <TouchableOpacity
        style={styles.filterBar}
        onPress={() => setFilter(f => ({ ...f, showFilter: !f.showFilter }))}>
        <Text style={styles.filterBarText}>
          ⚙️ Filters {activeFilters > 0 ? `(${activeFilters} active)` : ''}
        </Text>
        <Text style={styles.chevron}>{filter.showFilter ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {filter.showFilter && (
        <View style={styles.filterPanel}>

          {/* TSOA filters */}
          {isTSOA && <>
            <Text style={styles.filterLabel}>Min Goals</Text>
            <View style={styles.filterRow}>
              {[0,1,3,5,8].map(v => (
                <TouchableOpacity key={v}
                  style={[styles.filterChip, filter.minTSOAGoals===v && styles.filterChipActive]}
                  onPress={() => setFilter(f => ({ ...f, minTSOAGoals: v }))}>
                  <Text style={[styles.filterChipText, filter.minTSOAGoals===v && styles.filterChipTextActive]}>
                    {v === 0 ? 'Any' : `${v}+`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterLabel}>Min Assists</Text>
            <View style={styles.filterRow}>
              {[0,1,2,3,5].map(v => (
                <TouchableOpacity key={v}
                  style={[styles.filterChip, filter.minTSOAAssists===v && styles.filterChipActive]}
                  onPress={() => setFilter(f => ({ ...f, minTSOAAssists: v }))}>
                  <Text style={[styles.filterChipText, filter.minTSOAAssists===v && styles.filterChipTextActive]}>
                    {v === 0 ? 'Any' : `${v}+`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>}

          {/* Assists filters */}
          {!isGoals && !isTSOA && <>
            <Text style={styles.filterLabel}>Min Assists</Text>
            <View style={styles.filterRow}>
              {[0,1,2,3,4].map(v => (
                <TouchableOpacity key={v}
                  style={[styles.filterChip, filter.minAssists===v && styles.filterChipActive]}
                  onPress={() => setFilter(f => ({ ...f, minAssists: v }))}>
                  <Text style={[styles.filterChipText, filter.minAssists===v && styles.filterChipTextActive]}>
                    {v === 0 ? 'Any' : `${v}+`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterLabel}>Min xA Gap</Text>
            <View style={styles.filterRow}>
              {[[-99,'Any'],[0,'0+'],[0.5,'0.5+'],[1,'1+'],[2,'2+']].map(([v, label]) => (
                <TouchableOpacity key={v}
                  style={[styles.filterChip, filter.minXaGap===v && styles.filterChipActive]}
                  onPress={() => setFilter(f => ({ ...f, minXaGap: v }))}>
                  <Text style={[styles.filterChipText, filter.minXaGap===v && styles.filterChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>}

          {/* Goals filters */}
          {isGoals && !isTSOA && <>
            <Text style={styles.filterLabel}>Min Goals</Text>
            <View style={styles.filterRow}>
              {[0,1,3,5,8].map(v => (
                <TouchableOpacity key={v}
                  style={[styles.filterChip, filter.minGoals===v && styles.filterChipActive]}
                  onPress={() => setFilter(f => ({ ...f, minGoals: v }))}>
                  <Text style={[styles.filterChipText, filter.minGoals===v && styles.filterChipTextActive]}>
                    {v === 0 ? 'Any' : `${v}+`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterLabel}>Min xGOT Gap</Text>
            <View style={styles.filterRow}>
              {[0,0.5,1,2,3].map(v => (
                <TouchableOpacity key={v}
                  style={[styles.filterChip, filter.minXgGap===v && styles.filterChipActive]}
                  onPress={() => setFilter(f => ({ ...f, minXgGap: v }))}>
                  <Text style={[styles.filterChipText, filter.minXgGap===v && styles.filterChipTextActive]}>
                    {v === 0 ? 'Any' : `${v}+`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>}

          {/* Shared filters */}
          <Text style={styles.filterLabel}>League</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              {LEAGUES_LIST.map(l => (
                <TouchableOpacity key={l}
                  style={[styles.filterChip, filter.league===l && styles.filterChipActive]}
                  onPress={() => setFilter(f => ({ ...f, league: l }))}>
                  <Text style={[styles.filterChipText, filter.league===l && styles.filterChipTextActive]}>
                    {l === 'All' ? 'All' : shortLeague(l)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.filterLabel}>Recent Form (W streak)</Text>
          <View style={styles.filterRow}>
            {[[0,'Any'],[1,'1W'],[2,'2W'],[3,'3W']].map(([v, label]) => (
              <TouchableOpacity key={v}
                style={[styles.filterChip, filter.minWStreak===v && styles.filterChipActive]}
                onPress={() => setFilter(f => ({ ...f, minWStreak: v }))}>
                <Text style={[styles.filterChipText, filter.minWStreak===v && styles.filterChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, filter.weakOpp && styles.filterChipActive]}
              onPress={() => setFilter(f => ({ ...f, weakOpp: !f.weakOpp }))}>
              <Text style={[styles.filterChipText, filter.weakOpp && styles.filterChipTextActive]}>
                🛡️ Weak Opponent
              </Text>
            </TouchableOpacity>
            {activeFilters > 0 && (
              <TouchableOpacity
                style={[styles.filterChip, { borderColor: C.red }]}
                onPress={() => setFilter(f => ({ ...f,
                  minAssists: 0, minXaGap: -99, minGoals: 0, minXgGap: 0,
                  minTSOAGoals: 0, minTSOAAssists: 0,
                  league: 'All', weakOpp: false, minWStreak: 0, search: '' }))}>
                <Text style={[styles.filterChipText, { color: C.red }]}>✕ Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Results count */}
      <View style={styles.filterResultsRow}>
        <Text style={styles.filterResultsText}>
          {filtered.length} player{filtered.length !== 1 ? 's' : ''}
          {activeFilters > 0 ? ' matching filters' : ''}
        </Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p, i) => p.player_id || `${p.player}${i}`}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item: player, index }) => (
          <PlayerRow
            player={player}
            rank={index + 1}
            onPress={() => onPlayerPress(player)}
          />
        )}
      />
    </View>
  );
};

// ── Goal Scorer Row ───────────────────────────────────────────────────────────
const GoalScorerRow = ({ player, rank, onPress }) => (
  <TouchableOpacity style={styles.playerRow} onPress={() => onPress(player)}>
    <Text style={styles.rank}>{rank}</Text>
    <View style={{ position: 'relative', marginRight: 10 }}>
      <PlayerAvatar url={player.player_img} name={player.player} size={38} />
      <View style={styles.teamLogoBadge}>
        <TeamLogo teamId={player.team_id} size={14} />
      </View>
    </View>
    <View style={styles.playerInfo}>
      <View style={styles.playerNameRow}>
        <Text style={styles.playerName} numberOfLines={1}>{player.player}</Text>
        {player.weak_opp_def && <Text style={styles.weakIcon}>🛡️</Text>}
      </View>
      <View style={styles.playerMetaRow}>
        <Text style={[styles.playerSub, { flex: 1 }]} numberOfLines={1}>
          {player.team}  ·  {shortLeague(player.league)}
          {player.next_opponent
            ? <Text style={player.weak_opp_def ? { color: C.green } : {}}> · vs {player.next_opponent}</Text>
            : null}
        </Text>
        {player.form && player.form.length > 0 && <FormPills form={player.form} />}
      </View>
    </View>
    <Text style={[styles.score, { color: scoreColor(player.gs_score) }]}>
      {player.gs_score?.toFixed(2)}
    </Text>
  </TouchableOpacity>
);

// ── TSOA Row ──────────────────────────────────────────────────────────────────
const TSOARow = ({ player, rank, onPress }) => (
  <TouchableOpacity style={styles.playerRow} onPress={() => onPress(player)}>
    <Text style={styles.rank}>{rank}</Text>
    <View style={{ position: 'relative', marginRight: 10 }}>
      <PlayerAvatar url={player.player_img} name={player.player} size={38} />
      <View style={styles.teamLogoBadge}>
        <TeamLogo teamId={player.team_id} size={14} />
      </View>
    </View>
    <View style={styles.playerInfo}>
      <View style={styles.playerNameRow}>
        <Text style={styles.playerName} numberOfLines={1}>{player.player}</Text>
        {player.weak_opp_def && <Text style={styles.weakIcon}>🛡️</Text>}
      </View>
      <View style={styles.playerMetaRow}>
        <Text style={[styles.playerSub, { flex: 1 }]} numberOfLines={1}>
          {player.team}  ·  {shortLeague(player.league)}
          {player.next_opponent
            ? <Text style={player.weak_opp_def ? { color: C.green } : {}}> · vs {player.next_opponent}</Text>
            : null}
        </Text>
        {player.form && player.form.length > 0 && <FormPills form={player.form} />}
      </View>
    </View>
    <Text style={[styles.score, { color: scoreColor(player.tsoa_score) }]}>
      {player.tsoa_score?.toFixed(2)}
    </Text>
  </TouchableOpacity>
);

// ── Standings Tab ─────────────────────────────────────────────────────────────
const StandingsTab = ({ standings, loading, onLoad, apiUrl, colabUrl }) => {
  const LEAGUE_NAMES_INIT = Object.keys(standings || {});
  const DISPLAY_INIT = LEAGUE_NAMES_INIT.reduce((acc, k) => {
    if (k === 'MLS Eastern' || k === 'MLS Western') { if (!acc.includes('MLS')) acc.push('MLS'); }
    else acc.push(k);
    return acc;
  }, []);
  const [selectedLeague, setSelectedLeague] = useState(
    DISPLAY_INIT.includes('Premier League') ? 'Premier League' : (DISPLAY_INIT[0] || '')
  );
  const [showPicker,     setShowPicker]     = useState(false);
  const [sortCol,        setSortCol]        = useState('table_pos');
  const [sortAsc,        setSortAsc]        = useState(true);
  const [selectedTeam,   setSelectedTeam]   = useState(null);

  const LEAGUE_NAMES = Object.keys(standings || {});

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={C.accent} />
    </View>
  );

  if (!standings || LEAGUE_NAMES.length === 0) return (
    <View style={styles.center}>
      <Text style={styles.emptyIcon}>🏆</Text>
      <Text style={styles.emptyText}>No standings yet</Text>
      <TouchableOpacity style={styles.loadBtn} onPress={onLoad}>
        <Text style={styles.loadBtnText}>Load Standings</Text>
      </TouchableOpacity>
    </View>
  );

  // Merge MLS Eastern/Western into single "MLS" entry in dropdown
  const LEAGUE_NAMES_DISPLAY = LEAGUE_NAMES.reduce((acc, k) => {
    if (k === 'MLS Eastern' || k === 'MLS Western') {
      if (!acc.includes('MLS')) acc.push('MLS');
    } else { acc.push(k); }
    return acc;
  }, []);

  const sortConf = (arr) => [...arr].sort((a, b) => {
    const av = a[sortCol] ?? 0; const bv = b[sortCol] ?? 0;
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortAsc ? av - bv : bv - av;
  });

  // For MLS combine both conferences with section headers
  const sorted = selectedLeague === 'MLS'
    ? [
        { _conf_header: true, _conf_name: '🇺🇸 Eastern Conference', team_id: '_eh' },
        ...sortConf(standings['MLS Eastern'] || []),
        { _conf_header: true, _conf_name: '🇺🇸 Western Conference', team_id: '_wh' },
        ...sortConf(standings['MLS Western'] || []),
      ]
    : [...(standings[selectedLeague] || [])].sort((a, b) => {
        const av = a[sortCol] ?? 0; const bv = b[sortCol] ?? 0;
        if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        return sortAsc ? av - bv : bv - av;
      });

  const SortHeader = ({ col, label, width }) => {
    const active = sortCol === col;
    return (
      <TouchableOpacity
        style={[styles.standColHeader, { width }]}
        onPress={() => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } }}>
        <Text style={[styles.standColHeaderText, active && { color: C.accent }]}>
          {label}{active ? (sortAsc ? ' ↑' : ' ↓') : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.flex}>
      {/* League picker */}
      <TouchableOpacity
        style={styles.leaguePicker}
        onPress={() => setShowPicker(!showPicker)}>
        <Text style={styles.leaguePickerText}>{leagueLabel(selectedLeague)}</Text>
        <Text style={styles.chevron}>{showPicker ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {showPicker && (
        <View style={styles.leagueDropdown}>
          {LEAGUE_NAMES_DISPLAY.map(ln => (
            <TouchableOpacity
              key={ln}
              style={[styles.leagueDropdownItem,
                selectedLeague === ln && styles.leagueDropdownItemActive]}
              onPress={() => { setSelectedLeague(ln); setShowPicker(false); }}>
              <Text style={[styles.leagueDropdownText,
                selectedLeague === ln && { color: C.accent }]}>
                {leagueLabel(ln)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Column headers */}
      <View style={styles.standHeaderRow}>
        <SortHeader col="table_pos"  label="Pos"  width={36} />
        <View style={{ flex: 1 }}><Text style={styles.standColHeaderText}>Team</Text></View>
        <SortHeader col="played"     label="GP"   width={32} />
        <SortHeader col="gf_pg"      label="GF/G" width={44} />
        <SortHeader col="ga_pg"      label="GA/G" width={44} />
        <SortHeader col="home_adv"   label="HAdv" width={44} />
        <SortHeader col="away_vuln"  label="AVul" width={44} />
      </View>

      <FlatList
        data={sorted}
        keyExtractor={t => t.team_id || t.team}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item: t }) => {
          if (t._conf_header) return (
            <View style={styles.confHeader}>
              <Text style={styles.confHeaderText}>{t._conf_name}</Text>
            </View>
          );
          return (
            <TouchableOpacity
              style={[styles.standRow, t.weak_def && styles.standRowWeak]}
              onPress={() => setSelectedTeam(t)}>
              <Text style={styles.standPos}>{t.table_pos}</Text>
              <View style={styles.standTeamBlock}>
                <TeamLogo teamId={t.team_id} size={18} />
                <Text style={styles.standTeamName} numberOfLines={1}>{t.team}</Text>
  
              </View>
              <Text style={styles.standCell}>{t.played}</Text>
              <Text style={[styles.standCell, { color: C.green }]}>{t.gf_pg?.toFixed(1)}</Text>
              <Text style={[styles.standCell, { color: t.weak_def ? C.red : C.sub }]}>{t.ga_pg?.toFixed(1)}</Text>
              <Text style={[styles.standCell, {
                color: t.home_adv > 0 ? C.green : C.red
              }]}>{t.home_adv > 0 ? `+${t.home_adv?.toFixed(1)}` : t.home_adv?.toFixed(1)}</Text>
              <Text style={[styles.standCell, {
                color: t.away_vuln > 0 ? C.orange : C.sub
              }]}>{t.away_vuln > 0 ? `+${t.away_vuln?.toFixed(1)}` : t.away_vuln?.toFixed(1)}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Team squad modal */}
      {selectedTeam && (
        <MatchScreen
          match={{
            match_id:  `team_${selectedTeam.team_id}`,
            home:      selectedTeam.team,
            home_id:   selectedTeam.team_id,
            away:      '',
            away_id:   '',
            kickoff:   null,
            live:      false,
            finished:  false,
            score:     null,
            home_logo: selectedTeam.team_logo,
            away_logo: null,
          }}
          apiUrl={apiUrl}
          colabUrl={colabUrl}
          top25={[]}
          onClose={() => setSelectedTeam(null)}
          squadOnly={true}
        />
      )}
    </View>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [apiUrl,    setApiUrl]    = useState(DEFAULT_API_URL);
  const [colabUrl,   setColabUrl]   = useState('');
  const [standings,   setStandings]   = useState(null);
  const [assistSub,   setAssistSub]   = useState('today');
  const [goalSub,     setGoalSub]     = useState('today');
  const [tsoaSub,     setTsoaSub]     = useState('today');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Compute today's team IDs from fixtures (used for Today tab filtering)
  const todayTeamIds = React.useMemo(() => {
    const ids = new Set();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    if (!fixtures) return ids;
    Object.values(fixtures).forEach(matches => {
      matches.forEach(m => {
        const ko = m.kickoff || m.date || '';
        const koDate = ko.length === 8
          ? `${ko.slice(0,4)}-${ko.slice(4,6)}-${ko.slice(6,8)}`
          : ko.slice(0,10);
        if (koDate === today) {
          if (m.home_id) ids.add(String(m.home_id));
          if (m.away_id) ids.add(String(m.away_id));
        }
      });
    });
    console.log('[todayTeamIds] date='+today+' count='+ids.size+' sample='+([...ids][0]||'none'));
    return ids;
  }, [fixtures]);
  const [playerFilter, setPlayerFilter] = useState({
    minAssists: 0,
    minXaGap:   -99,
    minGoals:   0,
    minXgGap:   0,
    minTSOAGoals:   0,
    minTSOAAssists: 0,
    league:     'All',
    position:   'All',
    weakOpp:    false,
    minWStreak: 0,
    showFilter: false,
    search:     '',
  });
  const [standLeague, setStandLeague] = useState('Premier League');
  const [sortCol,    setSortCol]    = useState('table_pos');
  const [sortAsc,    setSortAsc]    = useState(true);
  const [standTeam,  setStandTeam]  = useState(null);
  const [tab,       setTab]       = useState('fixtures');
  const [data,      setData]      = useState(null);
  const [fixtures,  setFixtures]  = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,     setError]     = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedMatch,  setSelectedMatch]  = useState(null);
  const [urlInput,  setUrlInput]  = useState(DEFAULT_API_URL);
  const [colabInput, setColabInput] = useState('');

  const base = apiUrl.replace(/\/$/, '');

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${base}/data`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [base]);

  const loadFixtures = useCallback(async () => {
    setFixturesLoading(true); setError(null);
    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 8000);
      const res  = await fetch(`${base}/fixtures`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // If cache empty just show empty state
      if (json.error) { setFixtures({}); setFixturesLoading(false); return; }
      setFixtures(json.fixtures || {});
    } catch (e) {
      setFixtures({});
      if (e.name !== 'AbortError') setError('Fixtures unavailable — hit Refresh');
    }
    finally { setFixturesLoading(false); }
  }, [base]);

  const loadStandings = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 8000);
      const res  = await fetch(`${base}/standings`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) { setStandings({}); setLoading(false); return; }
      setStandings(json.standings || {});
    } catch (e) {
      setStandings({});
      if (e.name !== 'AbortError') setError('Standings unavailable — hit Refresh');
    }
    finally { setLoading(false); }
  }, [base]);

  const runRefresh = useCallback(async () => {
    setRefreshing(true); setError(null);
    try {
      // Fire refresh without waiting — it takes 2-5 min
      fetch(`${base}/refresh`, { method: 'POST' }).catch(() => {});

      // Poll /status every 10 seconds until done
      let attempts = 0;
      const maxAttempts = 36; // 6 minutes max
      const poll = async () => {
        try {
          const res  = await fetch(`${base}/status`);
          const json = await res.json();
          if (json.status === 'ok' && json.last_updated) {
            // Done — load fresh data
            await loadFixtures();
            const dataRes  = await fetch(`${base}/data`);
            const dataJson = await dataRes.json();
            if (!dataJson.error) setData(dataJson);
            setRefreshing(false);
          } else if (json.status?.startsWith('error')) {
            setError(`Refresh failed: ${json.status}`);
            setRefreshing(false);
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, 10000);
          } else {
            setError('Refresh timed out — try again');
            setRefreshing(false);
          }
        } catch (e) {
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, 10000);
          } else {
            setError('Could not reach server');
            setRefreshing(false);
          }
        }
      };
      setTimeout(poll, 10000); // first check after 10s
    } catch (e) {
      setError(e.message);
      setRefreshing(false);
    }
  }, [base, loadFixtures]);

  // Auto-load fixtures on mount
  useEffect(() => {
    loadFixtures();
    if (autoRefresh) {
      loadData();
      loadStandings();
    }
  }, []);

  const hasData = data && data.top25?.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7 }}>
              <Text style={styles.headerTitle}>Forma</Text>
              <Text style={styles.headerSport}>football</Text>
            </View>
          {data?.last_updated && (() => {
              const timeAgo = (str) => {
                try {
                  const diff = (Date.now() - new Date(str.replace(' ','T')+'Z')) / 60000;
                  if (diff < 1)   return 'just now';
                  if (diff < 60)  return `${Math.floor(diff)}m ago`;
                  if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
                  return `${Math.floor(diff/1440)}d ago`;
                } catch { return str; }
              };
              return (
                <Text style={styles.headerSub}>
                  Updated {timeAgo(data.last_updated)}
                </Text>
              );
            })()}
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

      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>⚠  {error}</Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {[['fixtures','Fixtures'],['assists','Assists'],['goals','Goals'],['tsoa','TSOA'],['standings','Standings'],['settings','Settings']].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => {
              setTab(key);
              if (key === 'fixtures' && !fixtures) loadFixtures();
              if ((key === 'top25' || key === 'leagues') && !hasData) loadData();
              if (key === 'standings' && !standings) loadStandings();
              if (key === 'players' && !hasData) loadData();
            }}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {tab === 'fixtures' && (
        <FixturesTab
          fixtures={fixtures}
          loading={fixturesLoading}
          onLoad={loadFixtures}
          onMatchPress={setSelectedMatch}
        />
      )}

      {tab === 'assists' && (
        <View style={styles.flex}>
          <SubTabBar
            tabs={[['today','Today'],['season','Season'],['all','All Players'],['leagues','By League']]}
            active={assistSub}
            onChange={setAssistSub}
          />
          {(assistSub === 'today' || assistSub === 'season') && (
            loading ? <View style={styles.center}><ActivityIndicator size="large" color={C.accent} /></View>
            : !hasData ? <View style={styles.center}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyText}>No data yet — hit Refresh</Text>
                <TouchableOpacity style={styles.loadBtn} onPress={loadData}>
                  <Text style={styles.loadBtnText}>Load Data</Text>
                </TouchableOpacity>
              </View>
            : (() => {
                const todayPlayers = (data.top25 || []).filter(p =>
                  todayTeamIds.has(String(p.team_id))
                );
                const players = assistSub === 'today' ? todayPlayers : (data.top25 || []);
                return (
                  <FlatList
                    data={players}
                    keyExtractor={(p,i) => p.player+i}
                    renderItem={({ item, index }) => (
                      <PlayerRow player={item} rank={index+1} onPress={setSelectedPlayer} />
                    )}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    refreshControl={
                      <RefreshControl refreshing={loading} onRefresh={loadData}
                        tintColor={C.accent} colors={[C.accent]} />
                    }
                    ListHeaderComponent={
                      <View>
                        <Text style={styles.listHeader}>
                          {assistSub === 'today' ? 'ASSISTS — TODAY' : 'ASSISTS — SEASON'}
                        </Text>
                        {assistSub === 'today' && players.length === 0 && (
                          <Text style={styles.emptySub}>No tracked players have fixtures today</Text>
                        )}
                        <View style={styles.legendRow}>
                          <Text style={styles.legendItem}>🛡️ Weak opp defense (GA/G ≥ 1.5)</Text>
                        </View>
                      </View>
                    }
                  />
                );
              })()
          )}
          {assistSub === 'all' && (
            <AllPlayersTab
              data={data}
              filter={playerFilter}
              setFilter={setPlayerFilter}
              onPlayerPress={setSelectedPlayer}
            />
          )}
          {assistSub === 'leagues' && (
            <LeagueView byLeague={data?.by_league || {}} onPlayerPress={setSelectedPlayer} />
          )}
        </View>
      )}

      {tab === 'goals' && (
        <View style={styles.flex}>
          <SubTabBar
            tabs={[['today','Today'],['season','Season'],['all','All Players'],['leagues','By League']]}
            active={goalSub}
            onChange={setGoalSub}
          />
          {(goalSub === 'today' || goalSub === 'season') && (
            loading ? <View style={styles.center}><ActivityIndicator size="large" color={C.accent} /></View>
            : !hasData ? <View style={styles.center}>
                <Text style={styles.emptyIcon}>⚽</Text>
                <Text style={styles.emptyText}>No data yet — hit Refresh</Text>
                <TouchableOpacity style={styles.loadBtn} onPress={loadData}>
                  <Text style={styles.loadBtnText}>Load Data</Text>
                </TouchableOpacity>
              </View>
            : (() => {
                const todayPlayers = (data?.gs_top25 || []).filter(p =>
                  todayTeamIds.has(String(p.team_id))
                );
                const players = goalSub === 'today' ? todayPlayers : (data?.gs_top25 || []);
                return (
                  <FlatList
                    data={players}
                    keyExtractor={(p,i) => p.player_id || p.player+i}
                    renderItem={({ item, index }) => (
                      <GoalScorerRow player={item} rank={index+1} onPress={(p) => setSelectedPlayer(p)} />
                    )}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    refreshControl={
                      <RefreshControl refreshing={loading} onRefresh={loadData}
                        tintColor={C.accent} colors={[C.accent]} />
                    }
                    ListHeaderComponent={
                      <View>
                        <Text style={styles.listHeader}>
                          {goalSub === 'today' ? 'GOALS — TODAY' : 'GOALS — SEASON'}
                        </Text>
                        {goalSub === 'today' && players.length === 0 && (
                          <Text style={styles.emptySub}>No tracked players have fixtures today</Text>
                        )}
                        <View style={styles.legendRow}>
                          <Text style={styles.legendItem}>🛡️ Weak opp defense (GA/G ≥ 1.5)</Text>
                        </View>
                      </View>
                    }
                  />
                );
              })()
          )}
          {goalSub === 'all' && (
            <AllPlayersTab
              data={{ ...data, all_players: data?.gs_all || [] }}
              filter={playerFilter}
              setFilter={setPlayerFilter}
              onPlayerPress={setSelectedPlayer}
              isGoals={true}
            />
          )}
          {goalSub === 'leagues' && (
            <LeagueView byLeague={data?.gs_by_league || {}} onPlayerPress={setSelectedPlayer} />
          )}
        </View>
      )}

      {tab === 'tsoa' && (
        <View style={styles.flex}>
          <SubTabBar
            tabs={[['today','Today'],['season','Season'],['all','All Players'],['leagues','By League']]}
            active={tsoaSub}
            onChange={setTsoaSub}
          />
          {(tsoaSub === 'today' || tsoaSub === 'season') && (
            loading ? <View style={styles.center}><ActivityIndicator size="large" color={C.accent} /></View>
            : !hasData ? <View style={styles.center}>
                <Text style={styles.emptyIcon}>🎯</Text>
                <Text style={styles.emptyText}>No data yet — hit Refresh</Text>
                <TouchableOpacity style={styles.loadBtn} onPress={loadData}>
                  <Text style={styles.loadBtnText}>Load Data</Text>
                </TouchableOpacity>
              </View>
            : (() => {
                const todayPlayers = (data?.tsoa_top25 || []).filter(p =>
                  todayTeamIds.has(String(p.team_id))
                );
                const players = tsoaSub === 'today' ? todayPlayers : (data?.tsoa_top25 || []);
                return (
                  <FlatList
                    data={players}
                    keyExtractor={(p,i) => p.player_id || p.player+i}
                    renderItem={({ item, index }) => (
                      <TSOARow player={item} rank={index+1} onPress={setSelectedPlayer} />
                    )}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    refreshControl={
                      <RefreshControl refreshing={loading} onRefresh={loadData}
                        tintColor={C.accent} colors={[C.accent]} />
                    }
                    ListHeaderComponent={
                      <View>
                        <Text style={styles.listHeader}>
                          {tsoaSub === 'today' ? 'TSOA — TODAY' : 'TSOA — SEASON'}
                        </Text>
                        {tsoaSub === 'today' && players.length === 0 && (
                          <Text style={styles.emptySub}>No tracked players have fixtures today</Text>
                        )}
                        <View style={styles.legendRow}>
                          <Text style={styles.legendItem}>🛡️ Weak opp defense (GA/G ≥ 1.5)</Text>
                        </View>
                      </View>
                    }
                  />
                );
              })()
          )}
          {tsoaSub === 'all' && (
            <AllPlayersTab
              data={{ ...data, all_players: data?.tsoa_all || [] }}
              filter={playerFilter}
              setFilter={setPlayerFilter}
              onPlayerPress={setSelectedPlayer}
              isTSOA={true}
            />
          )}
          {tsoaSub === 'leagues' && (
            <LeagueView byLeague={data?.tsoa_by_league || {}} onPlayerPress={setSelectedPlayer} />
          )}
        </View>
      )}

      {tab === 'standings' && (
        <StandingsTab
          standings={standings}
          loading={loading}
          onLoad={loadStandings}
          apiUrl={apiUrl}
          colabUrl={colabUrl}
        />
      )}

      {tab === 'settings' && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.settingsContent}>
          {/* Auto-refresh toggle */}
          <View style={styles.settingsToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsLabel}>AUTO-LOAD ON LAUNCH</Text>
              <Text style={styles.settingsHint}>Load player data automatically when app opens</Text>
            </View>
            <TouchableOpacity
              style={[styles.togglePill, autoRefresh && styles.togglePillOn]}
              onPress={() => setAutoRefresh(v => !v)}>
              <View style={[styles.toggleThumb, autoRefresh && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>

          <View style={styles.settingsDivider} />

          <Text style={styles.settingsLabel}>RAILWAY URL</Text>
          <Text style={styles.settingsHint}>Main backend — always on. No trailing slash.</Text>
          <TextInput
            style={styles.urlInput}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="https://xxxx.up.railway.app"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => { setApiUrl(urlInput.trim()); setData(null); setFixtures(null); setError(null); }}>
            <Text style={styles.saveBtnText}>Save Railway URL</Text>
          </TouchableOpacity>

          <View style={styles.divider} />
          <Text style={styles.settingsLabel}>COLAB URL (optional)</Text>
          <Text style={styles.settingsHint}>
            Run colab_l5_server.py in Colab on matchday for last 5 games data.
            Leave blank when not using.
          </Text>
          <TextInput
            style={styles.urlInput}
            value={colabInput}
            onChangeText={setColabInput}
            placeholder="https://xxxx.ngrok-free.app"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colabInput ? C.accent : C.border }]}
            onPress={() => { setColabUrl(colabInput.trim()); }}>
            <Text style={[styles.saveBtnText, { color: colabInput ? C.bg : C.muted }]}>
              {colabUrl ? 'Colab Connected ✓' : 'Save Colab URL'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      )}

      <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} apiUrl={colabUrl || apiUrl} />
      {selectedMatch && (
        <MatchScreen
          match={selectedMatch}
          apiUrl={apiUrl}
          colabUrl={colabUrl}
          top25={data?.top25 || []}
          onClose={() => setSelectedMatch(null)}
          onPlayerPress={setSelectedPlayer}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: C.bg },
  flex:              { flex: 1 },
  header:            { flexDirection: 'row', justifyContent: 'space-between',
                       alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
                       borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:       { color: '#9D8DF1', fontSize: 30, fontWeight: '900',
                     letterSpacing: -1, fontFamily: 'Georgia' },
  headerSport:       { color: '#ffffff', fontSize: 16, fontWeight: '400',
                     fontStyle: 'italic', fontFamily: 'Georgia', opacity: 0.6 },
  headerSub:         { color: C.muted, fontSize: 11, marginTop: 2 },
  refreshBtn:        { backgroundColor: '#6D5AE6', paddingHorizontal: 16,
                       paddingVertical: 8, borderRadius: 20 },
  refreshBtnActive:  { backgroundColor: '#4A3DB0' },
  refreshBtnText:    { color: C.bg, fontWeight: '700', fontSize: 14 },
  errorBar:          { backgroundColor: '#3D1515', padding: 10, paddingHorizontal: 16 },
  errorText:         { color: C.red, fontSize: 13 },
  tabs:              { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#18181F',
                       backgroundColor: C.bg, paddingHorizontal: 4 },
  tab:               { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive:         { borderBottomWidth: 2, borderBottomColor: '#9D8DF1' },
  tabText:           { color: '#444455', fontSize: 12, fontWeight: '600' },
  tabTextActive:     { color: '#9D8DF1' },

  // Fixtures
  fixturesSectionHeader: { color: C.muted, fontSize: 11, fontWeight: '700',
                           letterSpacing: 1.5, paddingHorizontal: 16,
                           paddingTop: 16, paddingBottom: 6 },
  fixtureLeagueLabel:{ color: C.accentDim, fontSize: 10, fontWeight: '700',
                       letterSpacing: 1, paddingHorizontal: 16,
                       paddingTop: 8, paddingBottom: 2 },
  fixtureCard:       { marginHorizontal: 12, marginBottom: 4, backgroundColor: C.card,
                       borderRadius: 10, padding: 12,
                       borderWidth: 1, borderColor: C.border },
  fixtureCardLive:   { borderColor: C.red },
  liveBadge:         { marginBottom: 6 },
  liveBadgeText:     { color: C.red, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  fixtureTeams:      { flexDirection: 'row', alignItems: 'center' },
  fixtureTeamBlock:      { flex: 1, flexDirection: 'row', alignItems: 'center' },
  fixtureTeamBlockRight: { justifyContent: 'flex-end' },
  fixtureTeam:       { flex: 1, color: C.text, fontSize: 13, fontWeight: '600' },
  fixtureTeamRight:  { textAlign: 'right' },
  fixtureScoreBox:   { paddingHorizontal: 10, minWidth: 80, alignItems: 'center' },
  fixtureScore:      { color: C.accent, fontSize: 16, fontWeight: '800' },
  fixtureTime:       { color: C.muted, fontSize: 11, textAlign: 'center' },

  // Player list
  listHeader:        { color: C.muted, fontSize: 11, fontWeight: '700',
                       letterSpacing: 1.5, padding: 16, paddingBottom: 4 },
  legendRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                       paddingHorizontal: 16, paddingBottom: 8 },
  legendItem:        { color: C.muted, fontSize: 11 },
  legendDots:        { flexDirection: 'row', alignItems: 'center' },
  legendLabel:       { color: C.muted, fontSize: 11 },
  playerRow:         { flexDirection: 'row', alignItems: 'center',
                       paddingHorizontal: 16, paddingVertical: 10,
                       borderBottomWidth: 1, borderBottomColor: C.border },
  rank:              { color: C.muted, fontSize: 13, width: 28, fontWeight: '600' },
  playerInfo:        { flex: 1 },
  playerNameRow:     { flexDirection: 'row', alignItems: 'center' },
  playerName:        { color: C.text, fontSize: 15, fontWeight: '600', flex: 1 },
  weakIcon:          { fontSize: 13, marginLeft: 4 },
  playerMetaRow:     { flexDirection: 'row', alignItems: 'center',
                       marginTop: 3, gap: 8 },
  playerSub:         { color: C.muted, fontSize: 12 },
  score:             { fontSize: 17, fontWeight: '800', minWidth: 44, textAlign: 'right' },
  formRow:           { flexDirection: 'row', gap: 3 },
  formDot:           { width: 8, height: 8, borderRadius: 4 },

  // Empty
  center:            { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon:         { fontSize: 48, marginBottom: 12 },
  emptyText:         { color: C.text, fontSize: 18, fontWeight: '700' },
  emptySub:          { color: C.muted, fontSize: 14, marginTop: 6, textAlign: 'center' },
  loadBtn:           { marginTop: 24, borderWidth: 1, borderColor: C.accent,
                       paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  loadBtnText:       { color: C.accent, fontWeight: '700' },

  // League
  leagueHeader:      { flexDirection: 'row', justifyContent: 'space-between',
                       alignItems: 'center', padding: 16, backgroundColor: C.surface,
                       borderBottomWidth: 1, borderBottomColor: C.border },
  leagueTitle:       { color: C.accent, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  chevron:           { color: C.muted, fontSize: 12 },
  teamHeader:        { flexDirection: 'row', justifyContent: 'space-between',
                       alignItems: 'center', paddingHorizontal: 24, paddingVertical: 10,
                       backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  teamTitle:         { color: C.text, fontSize: 13, fontWeight: '700' },
  teamCount:         { color: C.muted, fontSize: 12 },

  // Modal
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard:         { backgroundColor: C.surface, borderTopLeftRadius: 20,
                       borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalName:         { color: C.text, fontSize: 20, fontWeight: '800' },
  modalSub:          { color: C.muted, fontSize: 13, marginTop: 4 },
  scoreBadgeLarge:   { backgroundColor: C.card, borderRadius: 12,
                       paddingHorizontal: 14, paddingVertical: 8 },
  scoreBadgeText:    { fontSize: 24, fontWeight: '900' },
  nextOppRow:        { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
                       marginTop: 10, padding: 8, borderRadius: 8,
                       backgroundColor: C.card },
  nextOppRowWeak:    { backgroundColor: '#1A2510', borderWidth: 1, borderColor: C.green },
  nextOppLabel:      { color: C.muted, fontSize: 13 },
  nextOppTeam:       { color: C.text, fontSize: 13, fontWeight: '700' },
  weakBadge:         { color: C.green, fontSize: 13, fontWeight: '700' },
  nextOppTime:       { color: C.muted, fontSize: 12 },
  sectionLabel:      { color: C.muted, fontSize: 11, fontWeight: '700',
                       letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
  statRow:           { flexDirection: 'row', justifyContent: 'space-between',
                       paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border },
  statLabel:         { color: C.sub, fontSize: 14 },
  statValue:         { color: C.text, fontSize: 14, fontWeight: '600' },
  divider:           { height: 1, backgroundColor: C.border, marginVertical: 16 },
  closeBtn:          { marginTop: 20, backgroundColor: C.card, borderRadius: 10,
                       paddingVertical: 14, alignItems: 'center' },
  closeBtnText:      { color: C.text, fontWeight: '700', fontSize: 15 },

  // Settings
  settingsContent:   { padding: 20, paddingBottom: 60 },
  settingsLabel:     { color: C.muted, fontSize: 11, fontWeight: '700',
                       letterSpacing: 1.5, marginBottom: 8 },
  settingsHint:      { color: C.muted, fontSize: 13, marginBottom: 12, lineHeight: 18 },
  urlInput:          { backgroundColor: C.card, color: C.text, borderRadius: 10,
                       padding: 14, fontSize: 13, borderWidth: 1, borderColor: C.border,
                       marginBottom: 12 },
  saveBtn:           { backgroundColor: C.accent, borderRadius: 10,
                       paddingVertical: 14, alignItems: 'center' },
  saveBtnText:       { color: C.bg, fontWeight: '800', fontSize: 15 },
  formulaRow:        { flexDirection: 'row', justifyContent: 'space-between',
                       paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  formulaLabel:      { color: C.text, fontSize: 13, flex: 1 },
  formulaWeight:     { color: C.accent, fontSize: 14, fontWeight: '700' },

  // Match screen
  matchHeader:       { flexDirection: 'row', alignItems: 'center',
                       justifyContent: 'space-between', padding: 16,
                       borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:           { paddingVertical: 6, paddingRight: 16 },
  backBtnText:       { color: C.accent, fontSize: 15, fontWeight: '700' },
  livePill:          { backgroundColor: '#3D1515', borderRadius: 8,
                       paddingHorizontal: 10, paddingVertical: 4 },
  livePillText:      { color: C.red, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  scoreBar:          { flexDirection: 'row', alignItems: 'center',
                       paddingHorizontal: 16, paddingVertical: 20,
                       backgroundColor: C.surface },
  scoreTeamBlock:    { flex: 1, alignItems: 'center' },
  scoreTeam:         { color: C.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  scoreTeamRight:    { textAlign: 'right' },
  scoreCenter:       { alignItems: 'center', paddingHorizontal: 12, minWidth: 90 },
  scoreLarge:        { color: C.accent, fontSize: 28, fontWeight: '900' },
  scoreVs:           { color: C.muted, fontSize: 16, fontWeight: '600' },
  scoreKickoff:      { color: C.muted, fontSize: 11, marginTop: 4, textAlign: 'center' },
  weakDefRow:        { paddingHorizontal: 12, paddingVertical: 6, gap: 4 },
  weakDefBanner:     { backgroundColor: '#1A2510', borderRadius: 8, padding: 8,
                       borderWidth: 1, borderColor: C.green },
  weakDefText:       { color: C.green, fontSize: 13, fontWeight: '700' },
  squadHeader:       { color: C.muted, fontSize: 11, fontWeight: '700',
                       letterSpacing: 1.5, paddingHorizontal: 16,
                       paddingTop: 16, paddingBottom: 6 },
  squadRow:          { flexDirection: 'row', alignItems: 'center',
                       paddingHorizontal: 16, paddingVertical: 10,
                       borderBottomWidth: 1, borderBottomColor: C.border },
  squadRowHighlight: { backgroundColor: '#1C2415' },
  squadPlayerInfo:   { flex: 1 },
  squadNameRow:      { flexDirection: 'row', alignItems: 'center' },
  starBadge:         { color: C.accent, fontSize: 13, fontWeight: '800' },
  squadPlayerName:   { color: C.sub, fontSize: 14, fontWeight: '600', flex: 1 },
  squadPlayerNameHighlight: { color: C.text },
  weakIconSmall:     { fontSize: 12 },
  squadPlayerSub:    { color: C.muted, fontSize: 11, marginTop: 2 },
  squadScore:        { fontSize: 16, fontWeight: '800', minWidth: 40, textAlign: 'right' },
  lineupSection:     { paddingHorizontal: 16, paddingTop: 16 },
  lineupGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  lineupPill:        { backgroundColor: C.card, borderRadius: 16,
                       paddingHorizontal: 10, paddingVertical: 5,
                       borderWidth: 1, borderColor: C.border },
  lineupPillHighlight: { backgroundColor: '#1C2415', borderColor: C.accent },
  lineupName:        { color: C.muted, fontSize: 12 },
  lineupNameHighlight: { color: C.accent, fontWeight: '700' },
  // Goal scorer stats in modal
  gsStatsRow:        { flexDirection: 'row', justifyContent: 'space-around',
                       paddingVertical: 12, backgroundColor: C.surface,
                       borderRadius: 10, marginVertical: 8 },
  gsStatItem:        { alignItems: 'center' },
  gsStatVal:         { color: C.text, fontSize: 16, fontWeight: '800' },
  gsStatLabel:       { color: C.muted, fontSize: 10, marginTop: 2 },

  // Sub tab bar
  subTabBar:         { flexDirection: 'row', backgroundColor: C.bg,
                       paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  subTabItem:        { paddingVertical: 7, paddingHorizontal: 14,
                       borderRadius: 20, backgroundColor: C.card,
                       alignItems: 'center' },
  subTabItemActive:  { backgroundColor: C.accent },
  subTabLabel:       { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  subTabLabelActive: { color: '#ffffff' },
  subTabIndicator:   { display: 'none' },

  // All Players filter
  searchBar:         { flexDirection: 'row', alignItems: 'center',
                       marginHorizontal: 12, marginTop: 12, marginBottom: 4,
                       backgroundColor: C.card, borderRadius: 12,
                       borderWidth: 1, borderColor: C.border,
                       paddingHorizontal: 12, paddingVertical: 8 },
  searchIcon:        { fontSize: 16, marginRight: 8 },
  searchInput:       { flex: 1, color: C.text, fontSize: 14 },
  filterBar:         { flexDirection: 'row', justifyContent: 'space-between',
                       alignItems: 'center', margin: 12, padding: 14,
                       backgroundColor: C.card, borderRadius: 12,
                       borderWidth: 1, borderColor: C.border },
  filterBarText:     { color: C.text, fontSize: 14, fontWeight: '700' },
  filterPanel:       { marginHorizontal: 12, marginBottom: 8, padding: 12,
                       backgroundColor: C.card, borderRadius: 12,
                       borderWidth: 1, borderColor: C.border, gap: 6 },
  filterLabel:       { color: C.muted, fontSize: 11, fontWeight: '700',
                       letterSpacing: 0.5, marginTop: 4 },
  filterRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip:        { paddingHorizontal: 12, paddingVertical: 6,
                       borderRadius: 20, borderWidth: 1,
                       borderColor: C.border, backgroundColor: C.surface },
  filterChipActive:  { borderColor: C.accent, backgroundColor: C.accentDim },
  filterChipText:    { color: C.muted, fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: C.accentLt },
  filterResultsRow:  { paddingHorizontal: 16, paddingVertical: 6 },
  filterResultsText: { color: C.muted, fontSize: 12 },

  // Standings
  leaguePicker:      { flexDirection: 'row', justifyContent: 'space-between',
                       alignItems: 'center', margin: 12, padding: 14,
                       backgroundColor: C.card, borderRadius: 12,
                       borderWidth: 1, borderColor: C.border },
  leaguePickerText:  { color: C.text, fontSize: 15, fontWeight: '700' },
  leagueDropdown:    { marginHorizontal: 12, backgroundColor: C.card,
                       borderRadius: 12, borderWidth: 1, borderColor: C.border,
                       marginBottom: 8, overflow: 'hidden' },
  leagueDropdownItem:{ padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  leagueDropdownItemActive: { backgroundColor: C.surface },
  leagueDropdownText:{ color: C.sub, fontSize: 14 },
  standHeaderRow:    { flexDirection: 'row', alignItems: 'center',
                       paddingHorizontal: 12, paddingVertical: 8,
                       backgroundColor: C.surface, borderBottomWidth: 1,
                       borderBottomColor: C.border },
  standColHeader:    { alignItems: 'center' },
  standColHeaderText:{ color: C.muted, fontSize: 11, fontWeight: '700' },
  standRow:          { flexDirection: 'row', alignItems: 'center',
                       paddingHorizontal: 12, paddingVertical: 10,
                       borderBottomWidth: 1, borderBottomColor: C.border },
  standRowWeak:      { backgroundColor: '#1A1218' },
  standPos:          { color: C.muted, fontSize: 13, width: 36,
                       fontWeight: '600', textAlign: 'center' },
  standTeamBlock:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  standTeamName:     { color: C.text, fontSize: 13, fontWeight: '600', flex: 1 },
  standCell:         { width: 44, textAlign: 'center', fontSize: 12,
                       color: C.sub, fontWeight: '600' },
  confirmedLineupBox:   { marginHorizontal: 16, marginBottom: 12,
                         backgroundColor: '#0D1F0D', borderRadius: 10,
                         borderWidth: 1, borderColor: C.green, padding: 10 },
  confirmedLineupTitle: { color: C.green, fontSize: 11, fontWeight: '800',
                          letterSpacing: 1, marginBottom: 8 },
  confirmedLineupGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  confirmedPlayer:      { alignItems: 'center', width: 52,
                          backgroundColor: C.card, borderRadius: 8, padding: 4 },
  confirmedPlayerNum:   { color: C.accent, fontSize: 10, fontWeight: '800' },
  confirmedPlayerName:  { color: C.text, fontSize: 10, fontWeight: '600',
                          marginTop: 1 },
  confirmedPlayerPos:   { color: C.muted, fontSize: 9, marginTop: 1 },

  // Team stats card
  teamStatsCard:    { marginHorizontal: 12, marginVertical: 8, borderRadius: 12,
                      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
                      overflow: 'hidden' },
  teamStatsHeader:  { flexDirection: 'row', justifyContent: 'space-between',
                      alignItems: 'center', padding: 12 },
  teamStatsTitle:   { color: C.text, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  teamStatsPos:     { color: C.muted, fontSize: 12 },
  teamStatsDivider: { height: 1, backgroundColor: C.border, marginHorizontal: 12 },
  teamStatsSection: { color: C.muted, fontSize: 10, fontWeight: '700',
                      letterSpacing: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  teamStatLine:     { flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 12, paddingVertical: 5 },
  teamStatLabel:    { color: C.sub, fontSize: 12, flex: 1 },
  teamStatVal:      { fontSize: 13, fontWeight: '700', minWidth: 40, textAlign: 'right' },
  teamStatAvg:      { color: C.muted, fontSize: 11, minWidth: 60, textAlign: 'right' },

  // Settings toggle
  settingsToggleRow: { flexDirection: 'row', alignItems: 'center',
                       marginHorizontal: 16, marginVertical: 12 },
  settingsDivider:   { height: 1, backgroundColor: C.border,
                       marginHorizontal: 16, marginVertical: 8 },
  togglePill:        { width: 48, height: 28, borderRadius: 14,
                       backgroundColor: C.border, padding: 2,
                       justifyContent: 'center' },
  togglePillOn:      { backgroundColor: C.accent },
  toggleThumb:       { width: 24, height: 24, borderRadius: 12,
                       backgroundColor: C.muted },
  toggleThumbOn:     { backgroundColor: '#fff',
                       alignSelf: 'flex-end' },

  // Squad market toggle
  squadToggleRow:       { flexDirection: 'row', marginHorizontal: 16,
                          marginTop: 12, marginBottom: 4, gap: 8 },
  squadTogglePill:      { flex: 1, paddingVertical: 7, borderRadius: 20,
                          borderWidth: 1, borderColor: C.border,
                          alignItems: 'center', backgroundColor: C.surface },
  squadTogglePillActive:{ borderColor: C.accent, backgroundColor: C.accentDim },
  squadToggleText:      { color: C.muted, fontSize: 12, fontWeight: '600' },
  squadToggleTextActive:{ color: C.accent },

  // Live match stats
  liveSection:       { marginHorizontal: 12, marginVertical: 8, gap: 8 },
  liveEventsBox:     { backgroundColor: C.card, borderRadius: 10,
                       borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  liveEventRow:      { flexDirection: 'row', alignItems: 'center',
                       paddingHorizontal: 12, paddingVertical: 7,
                       borderBottomWidth: 1, borderBottomColor: C.border, gap: 6 },
  liveEventHome:     { justifyContent: 'flex-start' },
  liveEventAway:     { justifyContent: 'flex-end' },
  liveEventMin:      { color: C.muted, fontSize: 11, fontWeight: '700', minWidth: 28 },
  liveEventIcon:     { fontSize: 14 },
  liveEventInfo:     { flex: 1 },
  liveEventPlayer:   { color: C.text, fontSize: 13, fontWeight: '600' },
  liveEventAssist:   { color: C.muted, fontSize: 11, marginTop: 1 },
  liveStatsBox:      { backgroundColor: C.card, borderRadius: 10,
                       borderWidth: 1, borderColor: C.border, padding: 12, gap: 10 },
  liveStatRow:       { gap: 4 },
  liveStatLabel:     { color: C.muted, fontSize: 11, fontWeight: '700',
                       textAlign: 'center', letterSpacing: 0.5 },
  liveBar:           { flexDirection: 'row', height: 8, borderRadius: 4,
                       overflow: 'hidden', backgroundColor: C.border },
  liveBarHome:       { backgroundColor: C.accent },
  liveBarAway:       { backgroundColor: '#E85D5D' },
  liveBarLabels:     { flexDirection: 'row', justifyContent: 'space-between' },
  liveBarValHome:    { color: C.accent, fontSize: 11, fontWeight: '700' },
  liveBarValAway:    { color: '#E85D5D', fontSize: 11, fontWeight: '700' },
  liveShotsRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveShotsBlock:    { flex: 1, gap: 2 },
  liveShotsBar:      { height: 6, borderRadius: 3, minWidth: 4 },
  liveShotsMid:      { alignItems: 'center', minWidth: 44 },
  liveShotsMidText:  { color: C.sub, fontSize: 11, fontWeight: '700' },

  // Formation pitch
  pitchContainer:   { marginHorizontal: 12, borderRadius: 12, overflow: 'hidden',
                      borderWidth: 1, borderColor: '#1A3A1A' },
  pitchHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8,
                      paddingHorizontal: 12, paddingVertical: 8,
                      backgroundColor: '#0A180A' },
  pitchTitle:       { color: C.text, fontSize: 13, fontWeight: '700', flex: 1 },
  pitchFormation:   { color: C.green, fontSize: 12, fontWeight: '800' },
  pitch:            { backgroundColor: '#0F2A0F', paddingVertical: 12,
                      paddingHorizontal: 4, gap: 10, position: 'relative',
                      minHeight: 280 },
  pitchCentreCircle:{ position: 'absolute', width: 60, height: 60,
                      borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                      alignSelf: 'center', top: '50%', marginTop: -30, left: '50%', marginLeft: -30 },
  pitchCentreLine:  { position: 'absolute', left: 16, right: 16, height: 1,
                      backgroundColor: 'rgba(255,255,255,0.1)', top: '50%' },
  pitchBox:         { position: 'absolute', left: '25%', right: '25%', height: 40,
                      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pitchRow:         { flexDirection: 'row', justifyContent: 'space-evenly',
                      alignItems: 'center', zIndex: 1 },
  pitchRowGK:       { marginTop: 4 },
  pitchMidline:     { height: 1, backgroundColor: 'rgba(255,255,255,0.15)',
                      marginVertical: 4, marginHorizontal: 16 },
  pitchAvatarRingAway: { borderColor: '#E85D5D' },
  pitchNumBadgeAway:   { backgroundColor: '#7A1A1A' },
  pitchNameAway:       { color: '#FFB3B3' },
  pitchPlayer:      { alignItems: 'center', position: 'relative', width: 50 },
  pitchAvatarRing:  { borderRadius: 20, borderWidth: 2, borderColor: C.accent,
                      padding: 1 },
  pitchAvatarRingGK:{ borderColor: C.orange },
  pitchNumBadge:    { position: 'absolute', top: -4, right: 2,
                      backgroundColor: C.accentDim, borderRadius: 6,
                      paddingHorizontal: 3, paddingVertical: 1, zIndex: 2 },
  pitchNum:         { color: C.accentLt, fontSize: 8, fontWeight: '800' },
  pitchName:        { color: '#E8F5E8', fontSize: 9, fontWeight: '600',
                      marginTop: 3, textAlign: 'center' },
  pitchPos:         { color: C.muted, fontSize: 8, marginTop: 1 },
  benchRow:         { flexDirection: 'row', alignItems: 'flex-start',
                      paddingHorizontal: 12, paddingVertical: 8,
                      backgroundColor: '#0A180A', borderTopWidth: 1,
                      borderTopColor: '#1A3A1A' },
  benchLabel:       { color: C.muted, fontSize: 10, fontWeight: '700',
                      marginTop: 1 },
  benchNames:       { color: C.sub, fontSize: 10, flex: 1, lineHeight: 16 },
  confHeader:        { paddingHorizontal: 12, paddingVertical: 8,
                       backgroundColor: C.surface, borderBottomWidth: 1,
                       borderBottomColor: C.border },
  confHeaderText:    { color: C.accent, fontSize: 12, fontWeight: '800',
                       letterSpacing: 1 },

  teamLogoBadge:     { position: 'absolute', bottom: -2, right: -2,
                       backgroundColor: C.card, borderRadius: 8,
                       padding: 1, borderWidth: 1, borderColor: C.border },

  // L5 games
  l5Row:             { flexDirection: 'row', alignItems: 'center',
                       paddingVertical: 7, borderBottomWidth: 1,
                       borderBottomColor: C.border, gap: 8 },
  l5ResultBadge:     { width: 26, height: 26, borderRadius: 6,
                       borderWidth: 1, alignItems: 'center',
                       justifyContent: 'center' },
  l5ResultText:      { fontSize: 11, fontWeight: '800' },
  l5Info:            { flex: 1 },
  l5Opponent:        { color: C.text, fontSize: 13, fontWeight: '600' },
  l5Score:           { color: C.muted, fontSize: 11, marginTop: 1 },
  l5Empty:           { color: C.muted, fontSize: 13, paddingVertical: 8,
                       textAlign: 'center' },
  l5StatBlock:       { flexDirection: 'row', gap: 8, alignItems: 'center' },
  l5StatVal:         { color: C.text, fontSize: 13, fontWeight: '700', minWidth: 36 },
  l5TotalsRow:       { flexDirection: 'row', justifyContent: 'space-between',
                       paddingVertical: 10, marginTop: 4 },
  l5TotalLabel:      { color: C.muted, fontSize: 13 },
  l5TotalVal:        { color: C.accent, fontSize: 13, fontWeight: '800' },
});
