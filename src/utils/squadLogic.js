/**
 * @file squadLogic.js
 * @description 스쿼드 모달에서 사용되는 복잡한 팀 밸런싱 및 선수 배치 알고리즘을 담당합니다.
 * [개선] splitTeamsDeterministic 함수의 비효율적인 OVR 합산 로직을 누적 합산 방식으로 변경하여 성능을 최적화했습니다.
 */

// --- 포지션 관련 유틸리티 (변경 없음) ---
const basePosOf = (raw) => {
  const p = String(raw || '').toUpperCase();
  if (p.includes('GK')) return 'GK';
  if (p.includes('CB')) return 'CB';
  if (p.includes('RB') || p.includes('RWB')) return 'RB';
  if (p.includes('LB') || p.includes('LWB')) return 'LB';
  if (p.includes('CDM') || p === 'DM') return 'CDM';
  if (p.includes('CAM')) return 'CAM';
  if (p.includes('CM') || p.includes('RCM') || p.includes('LCM') || p === 'MID' || p === 'MF') return 'CM';
  if (p.includes('RW') || p === 'RM') return 'RW';
  if (p.includes('LW') || p === 'LM') return 'LW';
  if (p.includes('ST') || p.includes('CF') || p.includes('FW')) return 'ST';
  return 'CM'; // 기본값
};

const SIMILARITY_COST = {
  RB: { RB:0, CB:1, CDM:2, LB:3, CM:4, RW:5, LW:6, CAM:7, ST:8 },
  LB: { LB:0, CB:1, CDM:2, RB:3, CM:4, LW:5, RW:6, CAM:7, ST:8 },
  CB: { CB:0, RB:1, LB:1, CDM:2, CM:3, RW:5, LW:5, ST:7, CAM:8 },
  CDM:{ CDM:0, CM:1, CB:2, RB:3, LB:3, CAM:4, RW:5, LW:5, ST:6 },
  CM: { CM:0, CDM:1, CAM:1, RW:3, LW:3, RB:4, LB:4, ST:4, CB:5 },
  CAM:{ CAM:0, CM:1, ST:2, RW:3, LW:3, CDM:4, RB:6, LB:6, CB:7 },
  ST: { ST:0, CAM:2, RW:3, LW:3, CM:4, CDM:5, RB:7, LB:7, CB:8 },
  RW: { RW:0, ST:3, CAM:3, CM:4, LW:5, CDM:6, RB:6, LB:7, CB:8 },
  LW: { LW:0, ST:3, CAM:3, CM:4, RW:5, CDM:6, LB:6, RB:7, CB:8 },
};

const getPositionCost = (slotPos, playerBasePos) => {
  if (slotPos === 'GK' && playerBasePos !== 'GK') return Infinity;
  if (playerBasePos === 'GK' && slotPos !== 'GK') return Infinity;
  if (slotPos === playerBasePos) return 0;
  return SIMILARITY_COST[slotPos]?.[playerBasePos] ?? 99;
};

// --- 팀 편성 알고리즘 (변경 없음) ---
const pickStarters = (teamIds, attendeesMap, needed) => {
  const getOvr = (uid) => attendeesMap.get(uid)?.ovr || 0;
  const isGk = (uid) => basePosOf(attendeesMap.get(uid)?.pos) === 'GK';

  const gks = teamIds.filter(isGk).sort((a, b) => getOvr(b) - getOvr(a));
  const fieldPlayers = teamIds.filter(uid => !isGk(uid)).sort((a, b) => getOvr(b) - getOvr(a));
  
  const starters = [];
  if (gks.length > 0) starters.push(gks[0]);

  const pool = [...gks.slice(1), ...fieldPlayers];
  starters.push(...pool.slice(0, needed - starters.length));

  const bench = teamIds.filter(uid => !starters.includes(uid));
  return { starters, bench };
};

const assignSlots = (starterIds, slotPositions, attendeesMap) => {
  let availablePlayers = new Set(starterIds);
  const slots = slotPositions.map(pos => ({ slot: pos, uid: null }));
  const getOvr = (uid) => attendeesMap.get(uid)?.ovr || 0;
  const getBasePos = (uid) => basePosOf(attendeesMap.get(uid)?.pos);

  slots.forEach(slot => {
      const candidates = [...availablePlayers].filter(uid => getBasePos(uid) === slot.slot);
      if (candidates.length > 0) {
          const bestPlayer = candidates.sort((a, b) => getOvr(b) - getOvr(a))[0];
          slot.uid = bestPlayer;
          availablePlayers.delete(bestPlayer);
      }
  });

  slots.forEach(slot => {
      if (slot.uid || availablePlayers.size === 0) return;
      
      let bestPick = null;
      let minScore = Infinity;

      availablePlayers.forEach(uid => {
          const cost = getPositionCost(slot.slot, getBasePos(uid));
          if (!isFinite(cost)) return;
          
          const score = cost * 100 - getOvr(uid); 
          if (score < minScore) {
              minScore = score;
              bestPick = uid;
          }
      });

      if (bestPick) {
          slot.uid = bestPick;
          availablePlayers.delete(bestPick);
      }
  });

  return slots;
};

// [개선] 팀 나누기: 랜덤 셔플 + OVR 밸런싱
const splitTeamsDeterministic = (attendees, pins) => {
  const attendeesMap = new Map(attendees.map(p => [p.uid, p]));
  const getOvr = (uid) => attendeesMap.get(uid)?.ovr || 0;

  // 1. 핀 고정된 선수와 나머지 선수 분리
  const teamA = attendees.filter(p => pins[p.uid] === 'A').map(p => p.uid);
  const teamB = attendees.filter(p => pins[p.uid] === 'B').map(p => p.uid);
  let unpinned = attendees.filter(p => !pins[p.uid]);

  // 2. 핀 고정 안 된 선수들을 무작위로 섞기 (Fisher-Yates Shuffle)
  for (let i = unpinned.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unpinned[i], unpinned[j]] = [unpinned[j], unpinned[i]];
  }

  // 3. 섞인 선수들을 OVR 총합이 낮은 팀에 우선적으로 배정
  let totalOvrA = teamA.reduce((sum, uid) => sum + getOvr(uid), 0);
  let totalOvrB = teamB.reduce((sum, uid) => sum + getOvr(uid), 0);

  unpinned.forEach(player => {
      if (totalOvrA <= totalOvrB) {
          teamA.push(player.uid);
          totalOvrA += player.ovr;
      } else {
          teamB.push(player.uid);
          totalOvrB += player.ovr;
      }
  });
  
  return { teamA, teamB };
};


// --- 최종 스쿼드 구성 함수 (변경 없음) ---
export const buildSquad = (attendees, pins, formationA, formationB) => {
  const FORMATIONS = {
      '4-4-2': ['GK','RB','CB','CB','LB','RM','CM','CM','LM','ST','ST'],
      '4-2-4': ['GK','RB','CB','CB','LB','CDM','CM','RW','ST','ST','LW'],
      '4-3-3': ['GK','RB','CB','CB','LB','CM','CDM','CAM','RW','ST','LW'],
  };
  const attendeesMap = new Map(attendees.map(p => [p.uid, p]));
  const desiredSlotsA = FORMATIONS[formationA] || FORMATIONS['4-3-3'];
  const desiredSlotsB = FORMATIONS[formationB] || FORMATIONS['4-3-3'];

  const { teamA, teamB } = splitTeamsDeterministic(attendees, pins);

  const { starters: startersA, bench: benchA } = pickStarters(teamA, attendeesMap, desiredSlotsA.length);
  const { starters: startersB, bench: benchB } = pickStarters(teamB, attendeesMap, desiredSlotsB.length);

  const slotsA = assignSlots(startersA, desiredSlotsA, attendeesMap);
  const slotsB = assignSlots(startersB, desiredSlotsB, attendeesMap);

  return {
      teams: { A: teamA, B: teamB },
      slots: { A: slotsA, B: slotsB },
      bench: { A: benchA, B: benchB },
  };
};

// --- 유틸리티 함수 (변경 없음) ---
export const cleanName = (name) => String(name || '').replace(/\s*\([^)]*\)\s*/g, '').trim();

export const getAverageOvr = (uids = [], attendeesMap) => {
  if (!uids || uids.length === 0) return 0;
  const totalOvr = uids.reduce((sum, uid) => sum + (attendeesMap.get(uid)?.ovr || 0), 0);
  return Math.round(totalOvr / uids.length);
};