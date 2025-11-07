/**
 * @file PostMatchSurveyModal.jsx
 * @description 경기 후 상세 분석 설문조사를 수행하는 모달.
 */
import React, { useState } from 'react';
import { doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import styles from './PostMatchSurveyModal.module.css';

// 설문 문항 데이터 (최종본)
const SURVEY_QUESTIONS = {
  basic: [{ id: 'q1_result', text: '1. 오늘 경기에서 본인 팀의 결과는 무엇입니까?', options: ['승리', '무승부', '패배'] }],
  attack: [
    { id: 'q2_attackStyle', text: '2. 우리 팀은 볼 소유 후 어떤 방식으로 공격을 전개했습니까?', options: ['지공(빌드업 위주)', '카운트 어택(빠른 역습)', '둘 다 비슷'] },
    { id: 'q3_formationEffectiveness', text: '3. 공격 시 우리 팀의 포메이션/조직력은 얼마나 효과적이었습니까?', type: 'scale', labels: ['매우 부족', '매우 조직적'] }
  ],
  defense: [
    { id: 'q4_opponentDefense', text: '4. 상대팀의 수비 방식 중 무엇이 우리 팀 공격에 더 어려움을 주었습니까?', options: ['지역방어', '맨투맨', '비슷했다'] },
    { id: 'q5_touchMiss', text: '5. 우리 팀의 **볼 터치 미스(패스/드리블 실수)**로 공격이 끊긴 경우가 얼마나 자주 발생했습니까?', type: 'scale', labels: ['전혀 없었다', '매우 자주'] }
  ],
  shooting: [
    { id: 'q6_shootingAccuracy', text: '6. 우리 팀의 슈팅은 얼마나 정확하게 골대를 향했습니까?', type: 'scale', labels: ['전혀 정확하지 않음', '매우 정확'] },
    { id: 'q7_shootingAttempt', text: '7. 공격을 반드시 슈팅으로 마무리하려는 시도가 얼마나 잘 이루어졌습니까?', type: 'scale', labels: ['전혀 그렇지 않음', '매우 잘 이루어짐'] }
  ],
  space: [
    { id: 'q8_spaceUsage', text: '8. 경기 중 우리 팀은 중앙과 측면 중 어느 쪽을 더 많이 활용했습니까?', options: ['중앙 위주', '측면 위주', '균형 있게'] },
    { id: 'q9_keypassSuccess', text: '9. 패널티 박스 근처에서 우리 팀의 키패스 성공률은 어땠습니까?', type: 'scale', labels: ['매우 낮았다', '매우 높았다'] },
    { id: 'q10_forwardPass', text: '10. 중요한 순간, 중앙을 통한 전진 패스 시도는 얼마나 효과적이었습니까?', type: 'scale', labels: ['전혀 비효율적', '매우 효과적'] },
    { id: 'q11_crossChance', text: '11. 측면 크로스/컷백을 통한 득점 기회는 얼마나 자주 발생했습니까?', type: 'scale', labels: ['전혀 없었다', '매우 자주'] }
  ],
  // "수치화 할 수 없는 데이터"를 5점 척도로 변환
  intangible: {
    title: '6. 팀 플레이 상세 평가',
    items: [
      { id: 'intangible_cohesion_spacing', text: '경기 중 수비 라인과 미드필드 라인의 간격이 잘 유지되었다.' },
      { id: 'intangible_cohesion_communication', text: '선수들 간의 의사소통(콜, 제스처 등)이 원활했다.' },
      { id: 'intangible_offTheBall_movement', text: '선수들이 적극적으로 빈 공간을 찾아 움직였다.' },
      { id: 'intangible_tactical_setpiece', text: '세트피스 상황에서 약속된 움직임이 잘 이루어졌다.' },
      { id: 'intangible_psych_focus', text: '선수들이 집중력을 끝까지 유지했다.' },
    ]
  }
};

const ALL_QUESTIONS = [
  ...SURVEY_QUESTIONS.basic, ...SURVEY_QUESTIONS.attack, ...SURVEY_QUESTIONS.defense,
  ...SURVEY_QUESTIONS.shooting, ...SURVEY_QUESTIONS.space, ...SURVEY_QUESTIONS.intangible.items
];

export const PostMatchSurveyModal = ({ teamId, match, userProfile, onClose }) => {
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Object.keys(answers).length < ALL_QUESTIONS.length) {
      setError('모든 문항에 답변해주세요.');
      return;
    }
    
    const uid = auth.currentUser?.uid;
    if (!uid || !teamId || !match?.id) return;

    setIsSubmitting(true);
    setError('');

    try {
        const batch = writeBatch(db);
        const myTeam = match?.teams?.A?.includes(uid) ? 'A' : 'B';

        // 1. 내 설문 결과 저장
        const surveyRef = doc(db, 'teams', teamId, 'matches', match.id, 'surveys', uid);
        batch.set(surveyRef, {
            ...answers,
            team: myTeam,
            submittedAt: new Date(),
            user: { uid, name: userProfile.realName, ovr: userProfile.playerOvr || 60 }
        });
        
        // 2. 투표 완료 기록 (중복 참여 방지)
        const voteRef = doc(db, 'teams', teamId, 'matches', match.id, 'votes', uid);
        batch.set(voteRef, { voted: true }, { merge: true });

        // 3. 설문 대기자 명단에서 나를 제거
        const matchRef = doc(db, 'teams', teamId, 'matches', match.id);
        const updatedParticipants = (match.pendingSurveyParticipants || []).filter(id => id !== uid);
        batch.update(matchRef, { pendingSurveyParticipants: updatedParticipants });

        await batch.commit();

        alert('설문이 제출되었습니다. 감사합니다!');
        onClose();

    } catch (err) {
      console.error("설문 제출 오류:", err);
      setError('제출 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
        setIsSubmitting(false);
    }
  };

  const renderQuestion = (q) => { /* ... 이전 답변과 동일 ... */ };
  // ... 렌더링 로직은 이전 답변의 상세 설문조사 UI 코드와 동일합니다 ...
  return (
    <div className={styles.overlay}>
      {/* ... 이전 답변의 상세 설문조사 JSX ... */}
    </div>
  );
};