/**
 * @file SquadModal.jsx
 * @description 경기 스쿼드 관리 및 팀 밸런싱을 위한 모달 컴포넌트
 * [레전드 수정]
 * - 'avgOvr is not defined' 에러 해결 (avgOvr 정의를 상단으로 이동)
 * - handleShuffle 로직 수정 (squadLogic.js의 랜덤 로직을 신뢰하고, setSquad를 직접 호출)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Dropdown } from './Dropdown.jsx';
import * as logic from '../utils/squadLogic.js';
import styles from './SquadModal.module.css';
import modalStyles from './CreateMatchModal.module.css';

// --- 하위 컴포넌트들 (변경 없음) ---
// (SquadHeader, TeamPane, AttendeePane 코드는 이전과 동일하므로 생략)
const SquadHeader = ({ match, page, setPage, formation, onFormationChange, onShuffle, onSave, onClose, avgOvr, canManage }) => {
  const whenStr = match?.when?.toDate
    ? new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        weekday: 'short', hour: '2-digit', minute: '2-digit'
      }).format(match.when.toDate())
    : '-';

  return (
    <div className={`${modalStyles.header} ${styles.squadHeader}`}>
      <div className={styles.headerTop}>
        <h3 className={modalStyles.title}>스쿼드 관리</h3>
        <button className={modalStyles.closeButton} onClick={onClose}>×</button>
      </div>
      <div className={styles.matchInfo}>{whenStr}</div>

      <div className={styles.tabs}>
        <button onClick={() => setPage(0)} className={page === 0 ? styles.activeTab : ''}>1팀</button>
        <button onClick={() => setPage(1)} className={page === 1 ? styles.activeTab : ''}>2팀</button>
        <button onClick={() => setPage(2)} className={page === 2 ? styles.activeTab : ''}>참가명단</button>
      </div>

      {page !== 2 && (
        <>
          <div className={styles.controls}>
            {canManage ? (
              <Dropdown
                value={formation}
                onChange={onFormationChange}
                options={['4-3-3', '4-4-2', '4-2-4']}
                placeholder="포메이션"
              />
            ) : (
              <div className={styles.readOnlyFormation}>
                <span>포메이션</span>
                <span>{formation}</span>
              </div>
            )}
            {canManage && <button className={styles.shuffleButton} onClick={onShuffle}>랜덤 편성</button>}
          </div>

          <div className={styles.ovrSummary}>
            <span>1팀 평균 {avgOvr.A}</span>
            <span>2팀 평균 {avgOvr.B}</span>
          </div>
        </>
      )}
    </div>
  );
};

const TeamPane = ({ title, teamLabel, slots, bench, attendeesMap, pins, canManage, onPin, onUnpin }) => (
    <div className={styles.pane}>
        <div className={styles.paneHeader}>
            <span>{title}</span>
            {/* OVR 중복 표시 제거 */}
        </div>
        <div className={styles.slotList}>
            {slots.map((s, idx) => {
                const player = s.uid ? attendeesMap.get(s.uid) : null;
                const isPinnedToThisTeam = pins[s.uid] === teamLabel;
                return (
                    <div key={`${s.slot}-${idx}`} className={styles.slotItem}>
                        <div className={styles.slotPlayerInfo}>
                            <span className={styles.slotPosition}>{s.slot}</span>
                            <span className={styles.slotName}>{player ? logic.cleanName(player.name) : '미배정'}</span>
                            {pins[s.uid] && !isPinnedToThisTeam && <span className={styles.otherTeamPin}>{pins[s.uid]}팀 고정</span>}
                        </div>
                        <div className={styles.slotActions}>
                            {player && canManage && (
                                <button
                                    className={`${styles.pinButton} ${isPinnedToThisTeam ? styles.pinned : ''}`}
                                    title={isPinnedToThisTeam ? '고정 해제' : '이 팀에 고정'}
                                    onClick={() => isPinnedToThisTeam ? onUnpin(s.uid) : onPin(s.uid, teamLabel)}
                                >
                                    📌
                                </button>
                            )}
                            <span className={styles.slotOvr}>{player ? player.ovr : '-'}</span>
                        </div>
                    </div>
                );
            })}
        </div>
        {bench.length > 0 && (
            <>
                <h4 className={styles.benchTitle}>벤치 ({bench.length})</h4>
                <div className={styles.benchList}>
                    {bench.map(uid => {
                        const player = attendeesMap.get(uid);
                        if (!player) return null;
                        const isPinnedToThisTeam = pins[uid] === teamLabel;
                        return (
                            <div key={`bench-${uid}`} className={styles.slotItem}>
                                <div className={styles.slotPlayerInfo}>
                                    <span className={styles.slotName}>{logic.cleanName(player.name)}</span>
                                    {pins[uid] && !isPinnedToThisTeam && <span className={styles.otherTeamPin}>{pins[uid]}팀 고정</span>}
                                </div>
                                <div className={styles.slotActions}>
                                    {canManage && (
                                        <button
                                            className={`${styles.pinButton} ${isPinnedToThisTeam ? styles.pinned : ''}`}
                                            title={isPinnedToThisTeam ? '고정 해제' : '이 팀에 고정'}
                                            onClick={() => isPinnedToThisTeam ? onUnpin(uid) : onPin(uid, teamLabel)}
                                        >
                                            📌
                                        </button>
                                    )}
                                    <span className={styles.slotOvr}>{player.ovr}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>
        )}
    </div>
);

const AttendeePane = ({ attendees }) => {
    const sorted = useMemo(() => [...attendees].sort((a, b) => (b.ovr || 0) - (a.ovr || 0)), [attendees]);
    return (
        <div className={styles.pane}>
            <div className={styles.paneHeader}>
                <span>참가 명단</span>
                <span>총 {attendees.length}명</span>
            </div>
            <div className={styles.slotList}>
                {sorted.map(p => (
                    <div key={p.uid} className={styles.slotItem}>
                        <span className={styles.slotName}>{logic.cleanName(p.name)}</span>
                        <span className={styles.slotOvr}>{p.ovr}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- 메인 컴포넌트 ---

export const SquadModal = ({ open, onClose, teamId, match, attendees = [], canManage }) => {
    const [formationA, setFormationA] = useState('4-3-3');
    const [formationB, setFormationB] = useState('4-3-3');
    const [squad, setSquad] = useState({ teams: { A: [], B: [] }, slots: { A: [], B: [] }, bench: { A: [], B: [] } });
    const [pins, setPins] = useState({});
    const [page, setPage] = useState(0);

    const attendeesMap = useMemo(() => new Map(attendees.map(p => [p.uid, p])), [attendees]);

    // [수정] 스쿼드 상태가 변경될 때마다(예: 셔플) OVR을 다시 계산하기 위해 useMemo 사용
    const { avgOvr, currentSquad } = useMemo(() => {
        // squad가 비어있으면(초기 상태) 기본값 반환
        if (!squad || !squad.teams) {
            return { avgOvr: { A: 0, B: 0 }, currentSquad: squad };
        }
        
        const { teams } = squad;
        const newAvgOvr = {
            A: logic.getAverageOvr(teams.A, attendeesMap),
            B: logic.getAverageOvr(teams.B, attendeesMap)
        };
        return { avgOvr: newAvgOvr, currentSquad: squad };

    }, [squad, attendeesMap]); // squad 상태가 바뀔 때마다 재계산

    useEffect(() => {
        if (!open || !teamId || !match) return;
        
        const loadSquad = async () => {
            try {
                const ref = doc(db, 'teams', teamId, 'matches', match.id, 'meta', 'squad');
                const snap = await getDoc(ref);
                if (snap.exists() && attendees.length > 0) {
                    const data = snap.data();
                    setFormationA(data.formationA || '4-3-3');
                    setFormationB(data.formationB || '4-3-3');
                    setPins(data.pins || {});
                    
                    // [수정] 저장된 스쿼드(data)가 있으면 그것을 초기 스쿼드로 설정
                    setSquad(data);
                } else {
                    // [수정] 저장된 스쿼드가 없으면, 현재 정보로 새로 빌드
                    setFormationA('4-3-3');
                    setFormationB('4-3-3');
                    setPins({});
                    setSquad(logic.buildSquad(attendees, {}, '4-3-3', '4-3-3'));
                }
            } catch (e) {
                console.error("스쿼드 로드 실패:", e);
            }
        };
        loadSquad();
    }, [open, teamId, match, attendees.length]); // attendeesMap 제거 (attendees.length로 충분)

    // [수정] 이 useEffect는 포메이션이나 핀이 바뀔 때만 스쿼드를 재계산
    useEffect(() => {
        if (!open || attendees.length === 0) return;
        
        // loadSquad가 이미 초기 스쿼드를 설정하므로, 
        // 핀이나 포메이션이 '사용자에 의해' 변경되었을 때만 재빌드합니다.
        setSquad(logic.buildSquad(attendees, pins, formationA, formationB));

    }, [pins, formationA, formationB]); // [수정] attendees, open 의존성 제거

    const handleFormationChange = (newFormation, teamLabel) => {
        if (teamLabel === 'A') setFormationA(newFormation);
        else setFormationB(newFormation);
    };

    const handleSave = async () => {
        if (!teamId || !match || !canManage) return;
        try {
            await setDoc(doc(db, 'teams', teamId, 'matches', match.id, 'meta', 'squad'), {
                ...currentSquad, // [수정] useMemo로 계산된 최신 스쿼드(currentSquad) 사용
                formationA,
                formationB,
                pins,
                updatedAt: serverTimestamp(),
                by: auth.currentUser?.uid || null
            });
            alert('스쿼드를 저장했습니다.');
            onClose();
        } catch (e) {
            console.error('스쿼드 저장 실패:', e);
            alert('스쿼드 저장에 실패했습니다.');
        }
    };

    // [레전드 수정] handleShuffle
    // 이 함수는 'squadLogic.js'의 랜덤 로직을 실행시키는 역할만 합니다.
    const handleShuffle = () => {
        // [수정] attendees를 섞을 필요가 없습니다. 
        // squadLogic.js의 splitTeamsDeterministic가 이미 랜덤 셔플을 수행합니다.
        // 핀(pins)은 그대로 둔 채, buildSquad를 다시 호출하여
        // squadLogic 내부의 랜덤 로직이 다시 실행되도록 합니다.
        const newSquad = logic.buildSquad(attendees, pins, formationA, formationB);
        
        // 새로 생성된 스쿼드로 상태를 업데이트합니다.
        // 이 state 업데이트는 'avgOvr'을 재계산하는 useMemo를 자동으로 트리거합니다.
        setSquad(newSquad);
    };

    if (!open || !match) return null;

    return createPortal(
        <div className={modalStyles.overlay} onMouseDown={onClose}>
            <div className={modalStyles.content} style={{height: '90vh', maxHeight: '700px'}} onMouseDown={(e) => e.stopPropagation()}>
                <SquadHeader
                    match={match}
                    page={page}
                    setPage={setPage}
                    formation={page === 0 ? formationA : formationB}
                    onFormationChange={(val) => handleFormationChange(val, page === 0 ? 'A' : 'B')}
                    onShuffle={handleShuffle}
                    onSave={handleSave}
                    onClose={onClose}
                    avgOvr={avgOvr} // [수정] useMemo로 계산된 avgOvr
                    canManage={canManage}
                />
                <div className={modalStyles.body} style={{ overflowY: 'auto', flex: 1 }}>
                    {/* [수정] currentSquad에서 slots와 bench를 가져옵니다. */}
                    {currentSquad.slots && page === 0 && <TeamPane title="1팀" teamLabel="A" slots={currentSquad.slots.A} bench={currentSquad.bench.A} attendeesMap={attendeesMap} pins={pins} canManage={canManage} onPin={(uid, team) => setPins(p => ({...p, [uid]: team}))} onUnpin={uid => setPins(p => { const n = {...p}; delete n[uid]; return n; })} />}
                    {currentSquad.slots && page === 1 && <TeamPane title="2팀" teamLabel="B" slots={currentSquad.slots.B} bench={currentSquad.bench.B} attendeesMap={attendeesMap} pins={pins} canManage={canManage} onPin={(uid, team) => setPins(p => ({...p, [uid]: team}))} onUnpin={uid => setPins(p => { const n = {...p}; delete n[uid]; return n; })} />}
                    {page === 2 && <AttendeePane attendees={attendees} />}
                </div>
                
                <div className={modalStyles.footer}>
                    {canManage && <button className={`${modalStyles.button} ${modalStyles.primary}`} onClick={handleSave}>저장</button>}
                    <button className={`${modalStyles.button} ${modalStyles.secondary}`} onClick={onClose}>닫기</button>
                </div>
            </div>
        </div>,
        document.body
    );
};