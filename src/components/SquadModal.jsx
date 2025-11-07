/**
 * @file SquadModal.jsx
 * @description 경기 스쿼드 관리 및 팀 밸런싱을 위한 모달 컴포넌트
 * [수정]
 * - squadLogic.js의 import 경로 오류를 수정했습니다.
 * - handleShuffle 로직을 명확하게 변경했습니다.
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

      {/* [수정] 아래 블록 전체를 page가 2가 아닐 때만 렌더링하도록 변경 */}
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
            <span>평균 {logic.getAverageOvr(slots.map(s => s.uid).filter(Boolean), attendeesMap)}</span>
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
                } else {
                    setFormationA('4-3-3');
                    setFormationB('4-3-3');
                    setPins({});
                }
            } catch (e) {
                console.error("스쿼드 로드 실패:", e);
            }
        };
        loadSquad();
    }, [open, teamId, match, attendees.length]);

    useEffect(() => {
        if (!open || attendees.length === 0) return;
        setSquad(logic.buildSquad(attendees, pins, formationA, formationB));
    }, [attendees, pins, formationA, formationB, open]);

    const handleFormationChange = (newFormation, teamLabel) => {
        if (teamLabel === 'A') setFormationA(newFormation);
        else setFormationB(newFormation);
    };

    const handleSave = async () => {
        if (!teamId || !match || !canManage) return;
        try {
            await setDoc(doc(db, 'teams', teamId, 'matches', match.id, 'meta', 'squad'), {
                ...squad,
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

    // [수정] 랜덤 편성 버튼은 모든 '핀'을 초기화하여 팀을 재분배하도록 합니다.
    const handleShuffle = () => {
      // buildSquad를 직접 호출하여 새로운 랜덤 조합을 생성합니다.
      const newSquad = logic.buildSquad(attendees, pins, formationA, formationB);
      setSquad(newSquad);
    };

    if (!open || !match) return null;
    
    const { teams } = squad;

    const avgOvr = {
        A: logic.getAverageOvr(teams.A, attendeesMap),
        B: logic.getAverageOvr(teams.B, attendeesMap)
    };

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
                    avgOvr={avgOvr}
                    canManage={canManage}
                />
                <div className={modalStyles.body} style={{ overflowY: 'auto', flex: 1 }}>
                    {squad.slots && page === 0 && <TeamPane title="1팀" teamLabel="A" slots={squad.slots.A} bench={squad.bench.A} attendeesMap={attendeesMap} pins={pins} canManage={canManage} onPin={(uid, team) => setPins(p => ({...p, [uid]: team}))} onUnpin={uid => setPins(p => { const n = {...p}; delete n[uid]; return n; })} />}
                    {squad.slots && page === 1 && <TeamPane title="2팀" teamLabel="B" slots={squad.slots.B} bench={squad.bench.B} attendeesMap={attendeesMap} pins={pins} canManage={canManage} onPin={(uid, team) => setPins(p => ({...p, [uid]: team}))} onUnpin={uid => setPins(p => { const n = {...p}; delete n[uid]; return n; })} />}
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