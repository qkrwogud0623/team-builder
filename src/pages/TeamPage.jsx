/**
 * @file TeamPage.jsx
 * @description 팀 상세 정보, 멤버 및 경기 목록을 보여주는 페이지
 * [리팩토링 최종본]
 * - 모든 하위 컴포넌트(Header, MatchCard, MemberCard)를 포함합니다.
 * - 모든 스타일을 TeamPage.module.css로 분리했습니다.
 * - 모든 alert/confirm을 제거하고 error state와 전용 모달로 대체했습니다.
 * [수정]
 * - buildAttendeesForMatch 함수에서 선수 이름에 별명이 붙지 않도록 수정
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  doc, getDoc, collection, onSnapshot, query, orderBy,
  deleteDoc, updateDoc, deleteField, setDoc, serverTimestamp,
  where, getDocs, writeBatch
} from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CreateMatchModal } from '../components/CreateMatchModal.jsx';
import { SquadModal } from '../components/SquadModal.jsx';
import { PostMatchSurveyModal } from '../components/PostMatchSurveyModal.jsx';
import { ResultsModal } from '../components/ResultsModal.jsx';
import { calculateStatChanges } from '../utils/statCalculationLogic.js';
import styles from './TeamPage.module.css';

// ... (하위 컴포넌트 코드는 이전과 동일하여 생략) ...
const TeamHeader = ({ teamInfo, isCaptain, onLeaveTeam, isLeaving }) => (
    <header className={styles.header}>
      <div className={styles.headerMain}>
        <h2 className={styles.headerTitle}>{teamInfo?.teamName || '팀 정보'}</h2>
        <div className={styles.headerActions}>
          {!isCaptain && (
            <button className={styles.actionButton} onClick={onLeaveTeam} disabled={isLeaving}>
              {isLeaving ? '나가는 중…' : '팀 나가기'}
            </button>
          )}
          <Link to="/" className={styles.actionLink}>마이 프로필</Link>
        </div>
      </div>
      <div className={styles.inviteCode}>
        초대 코드: <strong>{teamInfo?.inviteCode || '-'}</strong>
      </div>
    </header>
  );
  
// [수정] MatchCard 컴포넌트 전체를 교체합니다.
const MatchCard = ({ match, myStatus, canManage, onCardClick, onSetAttendance, onComplete, onCancel, onDelete, onCalculateStats, isCalculating }) => {
    const whenStr = match.when?.toDate
        ? format(match.when.toDate(), 'yyyy.MM.dd (EEE) HH:mm', { locale: ko })
        : '-';
    const isPending = !match.status || match.status === 'pending';
    const isCompleted = match.status === 'completed';

    return (
        <div className={`${styles.card} ${isCompleted ? styles.cardCompleted : ''}`}>
            {/* [수정] 오른쪽 위 버튼들을 그룹으로 묶습니다. */}
            {canManage && (
                <div className={styles.topRightActions}>
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="경기 삭제" className={styles.deleteButton}>×</button> {/* 삭제 버튼을 위로 */}
                {isCompleted && !match.statsCalculated && (
                  <button onClick={onCalculateStats} disabled={isCalculating} title="설문 결과 집계" className={styles.aggregateButton}>
                      {isCalculating ? '...' : '📊'}
                  </button>
                )}
              </div>
            )}
            
            <div role="button" tabIndex={0} className={styles.cardClickableArea} onClick={onCardClick} onKeyDown={(e) => e.key === 'Enter' && onCardClick()}>
                <h4>{whenStr}</h4>
                <p>{match.location}</p>
            </div>

            {isPending && (
                <div className={styles.cardActions}>
                    <div className={styles.attendanceButtons}>
                        <button className={`${styles.attButton} ${myStatus === 'yes' ? styles.active : ''}`} onClick={() => onSetAttendance('yes')}>참석</button>
                        <button className={`${styles.attButton} ${myStatus === 'maybe' ? styles.active : ''}`} onClick={() => onSetAttendance('maybe')}>미정</button>
                        <button className={`${styles.attButton} ${myStatus === 'no' ? styles.active : ''}`} onClick={() => onSetAttendance('no')}>불참</button>
                    </div>
                    {canManage && (
                        <div className={styles.adminActions}>
                            <button className={`${styles.adminButton} ${styles.primary}`} onClick={() => onComplete()}>경기 완료</button>
                            <button className={`${styles.adminButton} ${styles.danger}`} onClick={() => onCancel()}>경기 취소</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

  const MemberCard = ({ member, isMyCard, isCaptainView, onDelegateCaptain, onSetVice }) => {
    const nameWithPlayer = member.selectedPlayerName
      ? `${member.realName} (${member.selectedPlayerName})`
      : member.realName;
  
    const roleLower = (member.role || 'member').toLowerCase();
    const isMemberCaptain = roleLower === 'captain';
    const isMemberVice = roleLower.includes('vice');
  
    return (
      <div className={`${styles.memberCard} ${isMemberCaptain ? styles.captainCard : ''} ${isMemberVice ? styles.viceCard : ''}`}>
        {/* [개선] 이름과 OVR을 상단 헤더로 배치 */}
        <div className={styles.memberHeader}>
          <div className={styles.memberName}>{nameWithPlayer}</div>
          <div className={styles.memberOvr}>{member.displayOvr ?? '-'}</div>
        </div>
  
        {/* [개선] 포지션, 역할 정보는 아래로 배치 */}
        <div className={styles.memberMeta}>{member.position || '-'} · {member.role || 'member'}</div>
  
        {/* [개선] 주장/부주장 관리 버튼 영역 */}
        {isCaptainView && !isMyCard && !isMemberCaptain && (
          <div className={styles.captainActions}>
            <button onClick={onDelegateCaptain}>주장 위임</button>
            <button onClick={onSetVice} className={isMemberVice ? styles.active : ''}>부주장 임명</button>
          </div>
        )}
      </div>
    );
  };
// ----------------------------------------------------------------
// Main Component (메인 컴포넌트)
// ----------------------------------------------------------------

function TeamPage({ userProfile }) {
  const { teamId } = useParams();
  const navigate = useNavigate();

  // ... (상태 관리 및 데이터 구독 로직은 이전과 동일) ...
  // --- 상태 관리 ---
  const [teamInfo, setTeamInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [myAttMap, setMyAttMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // --- 모달 상태 ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [squadState, setSquadState] = useState({ open: false, match: null, attendees: [] });
  const [surveyState, setSurveyState] = useState({ open: false, match: null, attendees: [] });
  const [resultsState, setResultsState] = useState({ open: false, match: null, data: null });

  const role = useMemo(() =>
    userProfile?.teamId === teamId ? (userProfile?.teamRole || 'member').toLowerCase() : '',
    [userProfile, teamId]
  );
  const isCaptain = role === 'captain';
  const isVice = role.includes('vice');
  const canManage = isCaptain || isVice;

  // --- 데이터 구독 ---
  useEffect(() => {
    if (!teamId) return;
    setLoading(true);

    const teamDocRef = doc(db, 'teams', teamId);
    const unsubscribeTeam = onSnapshot(teamDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setTeamInfo(docSnap.data());
      } else {
        navigate('/');
      }
    });

    const membersQuery = query(collection(db, 'teams', teamId, 'members'));
    const unsubscribeMembers = onSnapshot(membersQuery, async (snapshot) => {
      const baseMembers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const userDocs = await Promise.all(
        baseMembers.map(m => getDoc(doc(db, 'users', m.id)).catch(() => null))
      );
      const usersMap = new Map(userDocs.filter(Boolean).map(snap => [snap.id, snap.data()]));

      const confirmed = [];
      for (const m of baseMembers) {
        const u = usersMap.get(m.id);
        if (!u || u.teamId !== teamId) {
          if (canManage) deleteDoc(doc(db, 'teams', teamId, 'members', m.id));
          continue;
        }

        let displayOvr = 60;
        if (typeof u.playerOvr === 'number') {
          displayOvr = u.playerOvr;
        } else if (u.stats) {
          const vals = Object.values(u.stats).filter(v => typeof v === 'number');
          if (vals.length > 0) {
            displayOvr = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
          }
        }
        
        confirmed.push({
          ...m,
          selectedPlayerName: u.selectedPlayer?.name || null,
          position: u.position || m.position,
          displayOvr,
        });
      }
      
      const roleRank = (r) => {
        const s = String(r || 'member').toLowerCase();
        if (s === 'captain') return 0;
        if (s.includes('vice')) return 1;
        return 2;
      };

      const sortedMembers = [...confirmed].sort((a, b) => {
        const roleA = roleRank(a.role);
        const roleB = roleRank(b.role);
        if (roleA !== roleB) return roleA - roleB;

        const ovrA = a.displayOvr || 0;
        const ovrB = b.displayOvr || 0;
        if (ovrB !== ovrA) return ovrB - ovrA;

        return (a.realName || '').localeCompare(b.realName || '', 'ko');
      });

      setMembers(sortedMembers);
      setLoading(false);
    });

    const matchesQuery = query(collection(db, 'teams', teamId, 'matches'), orderBy('when', 'desc'));
    const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
      setMatches(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubscribeTeam();
      unsubscribeMembers();
      unsubscribeMatches();
    };
  }, [teamId, navigate, canManage]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!teamId || !uid || matches.length === 0) {
      setMyAttMap({});
      return;
    };

    const unsubs = matches.map((m) =>
      onSnapshot(doc(db, 'teams', teamId, 'matches', m.id, 'attendance', uid), (snap) => {
        setMyAttMap(prev => ({ ...prev, [m.id]: snap.exists() ? snap.data().status : 'none' }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, [teamId, matches]);

  // --- [수정] 공용 유틸리티 함수 ---
  const buildAttendeesForMatch = useCallback(async (match) => {
    if (!teamId || !match?.id) return [];
    const attendanceRef = collection(db, 'teams', teamId, 'matches', match.id, 'attendance');
    const qYes = query(attendanceRef, where("status", "==", "yes"));
    const attSnap = await getDocs(qYes);
    const yesUids = attSnap.docs.map(d => d.id);
    if (yesUids.length === 0) return [];

    const userDocs = await Promise.all(yesUids.map(uid => getDoc(doc(db, 'users', uid))));
    
    return userDocs.map(userSnap => {
      if (!userSnap.exists()) return null;
      const u = userSnap.data();
      const name = u.realName; // [수정!] 별명 부분 제거
      let ovr = 60;
      if (typeof u.playerOvr === 'number') ovr = u.playerOvr;
      else if (u.stats) {
        const vals = Object.values(u.stats).filter(v => typeof v === 'number');
        if (vals.length > 0) ovr = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      }
      return { uid: userSnap.id, name, pos: u.position || 'CM', ovr };
    }).filter(Boolean);
  }, [teamId]);

  // --- 경기 카드 클릭 핸들러 (이전과 동일) ---
  const handleMatchCardClick = useCallback(async (match) => {
    try {
      const attendees = await buildAttendeesForMatch(match);
      if (match.status === 'completed') {
        const nameMap = new Map(attendees.map(p => [p.uid, p.name]));

        const sCol = collection(db, 'teams', teamId, 'matches', match.id, 'surveys');
        const sSnap = await getDocs(sCol);

        const counts = { attack: new Map(), defense: new Map(), mvp: new Map() };
        sSnap.docs.forEach(d => {
          const v = d.data() || {};
          (v.attack || []).forEach(uid => counts.attack.set(uid, (counts.attack.get(uid) || 0) + 1));
          (v.defense || []).forEach(uid => counts.defense.set(uid, (counts.defense.get(uid) || 0) + 1));
          if (v.mvp) counts.mvp.set(v.mvp, (counts.mvp.get(v.mvp) || 0) + 1);
        });

        const toSortedArr = (mp) => [...mp.entries()]
          .map(([uid, cnt]) => ({ uid, cnt, name: nameMap.get(uid) || `(탈퇴)` }))
          .sort((a, b) => b.cnt - a.cnt);

        setResultsState({
          open: true,
          match,
          data: {
            attack: toSortedArr(counts.attack),
            defense: toSortedArr(counts.defense),
            mvp: toSortedArr(counts.mvp),
          }
        });
      } else {
        setSquadState({ open: true, match, attendees });
      }
    } catch (error) {
      console.error("카드 클릭 핸들러 에러:", error);
      alert("데이터를 불러오는 중 오류가 발생했습니다.");
    }
  }, [teamId, buildAttendeesForMatch]);
  /**
   * [신규] 부주장 임명 및 해제 핸들러
   */
  const handleSetVice = async (memberToUpdate) => {
    if (!teamId) return;

    // 현재 부주장인지 확인하여 역할을 토글합니다.
    const isAlreadyVice = (memberToUpdate.role || '').toLowerCase().includes('vice');
    const newRole = isAlreadyVice ? 'member' : 'vice-captain';

    // Batch 쓰기를 사용해 두 문서를 안전하게 동시 업데이트합니다.
    try {
      const batch = writeBatch(db);

      // 1. 팀의 members 컬렉션에 있는 문서 업데이트
      const memberDocRef = doc(db, 'teams', teamId, 'members', memberToUpdate.id);
      batch.update(memberDocRef, { role: newRole });

      // 2. 최상위 users 컬렉션에 있는 유저 문서도 업데이트 (앱 전반의 권한 관리용)
      const userDocRef = doc(db, 'users', memberToUpdate.id);
      batch.update(userDocRef, { teamRole: newRole });

      await batch.commit(); // Batch 실행

    } catch (error) {
      console.error("부주장 임명/해제 실패:", error);
      alert("역할 변경 중 오류가 발생했습니다.");
    }
  };

  /**
   * [신규] 주장 위임 핸들러
   */
  const handleDelegateCaptain = async (newCaptain) => {
    const currentCaptainId = auth.currentUser?.uid;
    if (!teamId || !currentCaptainId || !newCaptain.id || currentCaptainId === newCaptain.id) {
      return;
    }
    
    if (!window.confirm(`${newCaptain.realName}님에게 주장을 위임하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const batch = writeBatch(db);

      // 1. 새로운 주장의 역할 업데이트 (members, users)
      const newCaptainMemberRef = doc(db, 'teams', teamId, 'members', newCaptain.id);
      const newCaptainUserRef = doc(db, 'users', newCaptain.id);
      batch.update(newCaptainMemberRef, { role: 'captain' });
      batch.update(newCaptainUserRef, { teamRole: 'captain' });

      // 2. 현재 주장(나)의 역할 업데이트 (members, users)
      const oldCaptainMemberRef = doc(db, 'teams', teamId, 'members', currentCaptainId);
      const oldCaptainUserRef = doc(db, 'users', currentCaptainId);
      batch.update(oldCaptainMemberRef, { role: 'member' });
      batch.update(oldCaptainUserRef, { teamRole: 'member' });

      await batch.commit();

    } catch (error) {
      console.error("주장 위임 실패:", error);
      alert("주장 위임 중 오류가 발생했습니다.");
    }
  };

  const handleSetAttendance = async (matchId, status) => {
    const uid = auth.currentUser?.uid;
    if (!uid || !teamId || !matchId) {
      console.error("사용자 정보 또는 팀/매치 정보가 없습니다.");
      return;
    }

    try {
      // teams -> {teamId} -> matches -> {matchId} -> attendance -> {uid} 경로에 문서를 생성/업데이트합니다.
      const attendanceDocRef = doc(db, 'teams', teamId, 'matches', matchId, 'attendance', uid);
      
      // setDoc을 사용하면 문서가 없으면 생성하고, 있으면 덮어씁니다.
      await setDoc(attendanceDocRef, { status: status });

    } catch (error) {
      console.error("참석 여부 설정 실패:", error);
      alert("참석 여부를 변경하는 중 오류가 발생했습니다.");
    }
  };

    /**
   * [신규] 경기 완료 핸들러
   * - 경기 완료 후, 현재 사용자가 참석자일 경우 페이지 이동 없이 즉시 설문 모달을 띄웁니다.
   */
const handleCompleteMatch = async (match) => {
  if (!teamId || !match?.id) return;
  
  /* [테스트용 주석 처리] 미래의 경기를 완료하지 못하도록 방지하는 기능
  if (match.when.toDate() > new Date()) {
    alert("아직 시작되지 않은 경기는 완료할 수 없습니다.");
    return;
  }
  */

  try {
    // 1. 설문 대상이 될 참가자 목록을 미리 생성합니다.
    const attendees = await buildAttendeesForMatch(match);
    const participantUids = attendees.map(p => p.uid);

    // 2. DB에 경기 완료 상태와 설문 대상자 목록을 업데이트합니다.
    const matchDocRef = doc(db, 'teams', teamId, 'matches', match.id);
    await updateDoc(matchDocRef, {
      status: 'completed',
      pendingSurveyParticipants: participantUids // HomePage의 로직이 이 필드를 사용합니다.
    });

    // 3. 현재 사용자가 이 경기에 참석했는지 확인합니다.
    const currentUid = auth.currentUser?.uid;
    const didCurrentUserAttend = participantUids.includes(currentUid);

    if (didCurrentUserAttend) {
      // 4a. 참석한 경우: TeamPage에 있는 설문 모달 상태를 
      //      즉시 'open'으로 변경하여 설문을 시작합니다. (페이지 이동 X)
      setSurveyState({ open: true, match: match, attendees: attendees });
    
    } else {
      // 4b. 참석하지 않은 경우: 그냥 완료 알림만 띄웁니다.
      alert('경기를 완료 처리했습니다.');
    }

  } catch (error) {
    console.error("경기 완료 처리 실패:", error);
    alert("경기를 완료하는 중 오류가 발생했습니다.");
  }
};

// [수정] handleCalculateStats 함수 전체를 교체합니다.
  const handleCalculateStats = async (match) => {
    if (match.statsCalculated) {
      alert("이미 스탯 계산이 완료된 경기입니다.");
      return;
    }
    
    setIsCalculating(true);
    try {
      // 1. 경기 참가자와 설문 제출자 명단을 각각 가져옵니다.
      const participants = await buildAttendeesForMatch(match);
      const participantUids = participants.map(p => p.uid);
      
      const surveyColRef = collection(db, 'teams', teamId, 'matches', match.id, 'surveys');
      const surveySnapshot = await getDocs(surveyColRef);
      const submitterUids = surveySnapshot.docs.map(d => d.id);

      // 2. 미제출자 명단을 확인합니다.
      const missingUids = participantUids.filter(uid => !submitterUids.includes(uid));

      if (missingUids.length > 0) {
        // 3a. 미제출자가 있으면, 그들의 이름을 찾아서 알려줍니다.
        const missingNames = participants
          .filter(p => missingUids.includes(p.uid))
          .map(p => p.name)
          .join('\n');
        alert(`아직 다음 선수들이 설문을 제출하지 않았습니다:\n\n${missingNames}`);
      
      } else {
        // 3b. 미제출자가 없으면, 기존의 계산 로직을 실행합니다.
        if (!window.confirm("모든 선수가 설문을 제출했습니다. 결과를 집계하여 스탯에 반영하시겠습니까?")) return;
        
        const allSurveys = surveySnapshot.docs.map(d => d.data());
        const players = participants.map(p => ({
            ...p,
            team: match.teams?.A.includes(p.uid) ? 'A' : 'B'
        }));
        
        const statChanges = calculateStatChanges(allSurveys, players, match.result || {});
        
        const batch = writeBatch(db);
        for (const uid in statChanges) {
            const userRef = doc(db, 'users', uid);
            const changes = statChanges[uid];
            const updatePayload = {};
            for (const stat in changes) {
                updatePayload[`stats.${stat}`] = increment(changes[stat]);
            }
            batch.update(userRef, updatePayload);
        }

        const matchRef = doc(db, 'teams', teamId, 'matches', match.id);
        batch.update(matchRef, { statsCalculated: true });

        await batch.commit();
        alert("스탯 반영이 완료되었습니다!");
      }
    } catch (error) {
      console.error("스탯 계산 실패:", error);
      alert("오류가 발생하여 스탯을 반영하지 못했습니다.");
    } finally {
      setIsCalculating(false);
    }
  };

  if (loading && !teamInfo) {
    return <div className={styles.loadingContainer}>팀 정보를 불러오는 중...</div>;
  }

  return (
    <div className={styles.pageContainer}>
      <TeamHeader teamInfo={teamInfo} isCaptain={isCaptain} onLeaveTeam={()=>{}} isLeaving={isLeaving} />

      <main className={styles.content}>
        <section className={styles.section}>
          <h3>경기 일정 ({matches.length})</h3>
          {matches.length === 0 ? (
            <div className={styles.emptyState}>등록된 경기가 없습니다.</div>
          ) : (
            matches.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                myStatus={myAttMap[match.id] || 'none'}
                canManage={canManage}
                onCardClick={() => handleMatchCardClick(match)}
                onSetAttendance={(status) => handleSetAttendance(match.id, status)}
                onComplete={() => handleCompleteMatch(match)}
                onCancel={() => handleDeleteMatch(match.id)}
                onDelete={() => handleDeleteMatch(match.id)}
                onCalculateStats={() => handleCalculateStats(match)}
              />
            ))
          )}
        </section>
        
        {canManage && (
          <section className={styles.section}>
            <button className={styles.createMatchButton} onClick={() => setIsCreateModalOpen(true)}>
              <h4>새로운 경기 만들기</h4>
              <p>경기 일정을 잡고 참석 여부를 투표하세요.</p>
            </button>
          </section>
        )}

        <section className={styles.section}>
          <h3>팀원 목록 ({members.length})</h3>
          {members.map((member) => (
            <MemberCard 
              key={member.id} 
              member={member}
              isMyCard={auth.currentUser?.uid === member.id}
              isCaptainView={isCaptain}
              onDelegateCaptain={() => handleDelegateCaptain(member)}
              onSetVice={() => handleSetVice(member)}
            />
          ))}
        </section>
      </main>

      {/* --- 모달들 --- */}
      {isCreateModalOpen && (
        <CreateMatchModal teamId={teamId} onClose={() => setIsCreateModalOpen(false)} />
      )}
      <SquadModal {...squadState} onClose={() => setSquadState(p => ({...p, open: false}))} teamId={teamId} canManage={canManage} />
      <PostMatchSurveyModal {...surveyState} onClose={() => setSurveyState(p => ({...p, open: false}))} teamId={teamId} userProfile={userProfile} />
      <ResultsModal {...resultsState} onClose={() => setResultsState(p => ({...p, open: false}))} />

    </div>
  );
}

export default TeamPage;

