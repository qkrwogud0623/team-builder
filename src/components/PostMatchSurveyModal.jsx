/**
 * @file PostMatchSurveyModal.jsx
 * @description 경기 후 "MOM" 투표 모달 (간소화 버전)
 * [레전드 최종 수정]
 * - 스탯이 1로 초기화되는 버그(increment() 문제)를 "완전히" 해결했습니다.
 * - handleSubmit이 선수의 현재 스탯을 '읽은 후', +1을 하여 '덮어쓰는' 방식으로 수정.
 */
import React, { useState, useMemo } from 'react';
import {
  doc, setDoc, updateDoc, getDocs, getDoc, // getDoc 추가
  collection, writeBatch, increment
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import styles from './PostMatchSurveyModal.module.css';
import { Dropdown } from './Dropdown.jsx';

// 스탯 집계에 필요한 최소 투표 수
const VOTE_THRESHOLD = 1; // (테스트용)

// 투표 카테고리 정의
const VOTE_CATEGORIES = [
  { id: 'bomber', text: '✈️ 폭격기 (Best Attacker)', stat: 'SHO' },
  { id: 'midfielder', text: '🧠 중원의 지배자 (MVP)', stat: 'PAS' },
  { id: 'defender', text: '🔒 빗장수비 (Best Defender)', stat: 'DEF' },
  { id: 'goalkeeper', text: '🧤 거미손 (Best Goalkeeper)', stat: 'PHY' },
];

export const PostMatchSurveyModal = ({ teamId, match, attendees = [], onClose }) => {
  const [votes, setVotes] = useState({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // [변경 없음] Dropdown 데이터 가공
  const { playerOptionsList, uidToNameMap, nameToUidMap } = useMemo(() => {
    const optionsList = [];
    const uidMap = new Map();
    const nameMap = new Map();
    for (const player of attendees) {
      const displayName = `${player.name} (${player.pos || 'N/A'})`;
      optionsList.push(displayName);
      uidMap.set(player.uid, displayName);
      nameMap.set(displayName, player.uid);
    }
    optionsList.sort();
    return { playerOptionsList: optionsList, uidToNameMap: uidMap, nameToUidMap: nameMap };
  }, [attendees]);

  // [변경 없음] Dropdown 핸들러
  const handleVoteSelect = (category, displayName) => {
    const uid = nameToUidMap.get(displayName);
    if (uid) {
      setVotes(prev => ({ ...prev, [category]: uid }));
    }
  };

  /**
   * [레전드 수정] 스탯 집계 로직
   * - 'allVotes' (모든 투표 목록)와 'userStatsMap' (선수들 현재 스탯)을 인자로 받습니다.
   */
  const runStatAggregation = async (batch, allVotes, userStatsMap) => {
    try {
      // 2. 카테고리별 득표 집계 (변경 없음)
      const tally = {};
      VOTE_CATEGORIES.forEach(cat => {
        tally[cat.id] = {};
      });
      for (const survey of allVotes) {
        VOTE_CATEGORIES.forEach(cat => {
          const votedUid = survey[cat.id];
          if (votedUid) {
            tally[cat.id][votedUid] = (tally[cat.id][votedUid] || 0) + 1;
          }
        });
      }

      // 3. [레전드 수정] N표 이상 받은 선수들에게 스탯 +1 적용
      const statBoosts = {}; // { uid: { 'stats.sho': 61, 'stats.pas': 63 }, ... }

      const addBoost = (uid, stat) => {
        // (1) 선수의 현재 스탯 객체를 가져옴 (없으면 빈 객체)
        const currentStats = userStatsMap.get(uid) || {};
        // (2) 스탯 객체에서 "해당 스탯"의 "현재 값"을 가져옴 (없으면 60으로 간주)
        const currentValue = currentStats[stat] || 60; 
        
        if (!statBoosts[uid]) statBoosts[uid] = {};
        // (3) increment(1) 대신, (현재 값 + 1)이라는 "숫자"를 저장
        statBoosts[uid][`stats.${stat}`] = currentValue + 1;
      };

      VOTE_CATEGORIES.forEach(cat => {
        const categoryTally = tally[cat.id];
        for (const uid in categoryTally) {
          if (categoryTally[uid] >= VOTE_THRESHOLD) {
            addBoost(uid, cat.stat);
          }
        }
      });

      // 4. Batch에 스탯 업데이트 작업 추가 (변경 없음)
      for (const uid in statBoosts) {
        const userRef = doc(db, 'users', uid);
        // statBoosts[uid]는 이제 { 'stats.sho': 61 } 같은 객체임
        batch.update(userRef, statBoosts[uid]);
      }

      // 5. 'statsCalculated' 플래그 업데이트 (변경 없음)
      const matchRef = doc(db, 'teams', teamId, 'matches', match.id);
      batch.update(matchRef, { statsCalculated: true });
      
    } catch (err) {
      console.error("스탯 집계 중 심각한 오류:", err);
      throw new Error("스탯 집계 실패");
    }
  };


  /**
   * [레전드 수정] 설문(투표) 제출 핸들러
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (Object.keys(votes).length < VOTE_CATEGORIES.length) {
      setError('모든 항목에 투표해주세요.');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid || !teamId || !match?.id) return;

    setIsSubmitting(true);
    setError('');

    try {
      const batch = writeBatch(db);
      const surveyColRef = collection(db, 'teams', teamId, 'matches', match.id, 'surveys');

      // 1. 내 투표 결과 저장 (변경 없음)
      const surveyRef = doc(surveyColRef, uid);
      batch.set(surveyRef, {
        ...votes,
        submittedAt: new Date(),
      });

      // 2. 설문 대기자 명단에서 나를 제거 (변경 없음)
      const matchRef = doc(db, 'teams', teamId, 'matches', match.id);
      const updatedParticipants = (match.pendingSurveyParticipants || []).filter(id => id !== uid);
      batch.update(matchRef, { pendingSurveyParticipants: updatedParticipants });

      // [레전드 수정] 'amILast' 로직 수정 (변경 없음 - 이전과 동일)
      const allSurveysSnap = await getDocs(surveyColRef);
      const totalAttendees = attendees.length;
      const amILast = (allSurveysSnap.docs.length + 1) >= totalAttendees;

      if (amILast) {
        // [레전드 수정] 6a. 집계 전, 스탯을 받을 "모든 선수"의 "현재 스탯"을 DB에서 읽어옴
        const allVotes = [...allSurveysSnap.docs.map(d => d.data()), votes];
        // 득표한 모든 선수 uid (중복 제거)
        const uidsToUpdate = new Set(allVotes.flatMap(vote => Object.values(vote)));

        // 선수들의 'stats' 객체를 미리 불러와서 Map을 만듦
        const userDocs = await Promise.all(
            Array.from(uidsToUpdate).map(id => getDoc(doc(db, 'users', id)))
        );
        const userStatsMap = new Map(
            userDocs.map(doc => [doc.id, doc.data()?.stats || {}]) // { uid => {sho: 60, ...} }
        );

        // 6b. "완성된 전체 투표 목록"과 "선수들 현재 스탯 Map"을 집계 함수로 넘김
        await runStatAggregation(batch, allVotes, userStatsMap);
      }

      // 7. 모든 작업을 한 번에 커밋
      await batch.commit();

      // 8. 완료 알림
      if (amILast) {
        alert("설문이 제출되었습니다. 모든 선수가 투표를 완료하여 스탯이 자동 반영되었습니다!");
      } else {
        alert("설문이 제출되었습니다. 감사합니다.");
      }
      onClose();

    } catch (err) {
      console.error("설문 제출 오류:", err);
      setError('제출 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsSubmitting(false);
    }
  };


  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>경기 결과 투표</h3>
          <button onClick={onClose} className={styles.closeButton} disabled={isSubmitting}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <p className={styles.description}>
            각 항목별로 가장 뛰어난 활약을 펼친 선수 1명을 선택해주세요.
            <br />
            모든 선수가 투표를 완료하면 <strong>{VOTE_THRESHOLD}표 이상</strong>을 받은 선수의 스탯이 상승합니다.
          </p>

          {/* 4개의 카테고리 렌더링 (변경 없음) */}
          {VOTE_CATEGORIES.map(category => {
            const selectedDisplayName = uidToNameMap.get(votes[category.id]);
            
            return (
              <div key={category.id} className={styles.questionBlock}>
                <label>{category.text}</label>
                <Dropdown
                  placeholder="선수를 선택하세요"
                  options={playerOptionsList}
                  value={selectedDisplayName}
                  onChange={(displayName) => handleVoteSelect(category.id, displayName)}
                />
              </div>
            );
          })}
          
          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
            {isSubmitting ? '제출 중...' : '투표 완료'}
          </button>
        </form>
      </div>
    </div>
  );
};