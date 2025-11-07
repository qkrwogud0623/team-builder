/**
 * @file SurveyPage.jsx
 * @description
 * 신규 사용자의 능력치 설문조사를 진행하는 페이지 컴포넌트입니다.
 * 1. 포지션 선택 -> 2. 질문 답변 -> 3. 결과 분석 및 저장의 흐름을 관리합니다.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, collection, query, where, getDocs, setDoc } from "firebase/firestore";
import { auth, db } from '../firebase';
import { QUESTION_BANK } from '../data/surveyQuestions'; // 경로 수정 가정
import { findTopMatchingPlayers } from '../utils/surveyAnalytics'; // [리팩토링] 분석 로직 import

import styles from './SurveyPage.module.css'; // [리팩토링] 전용 CSS 모듈 import

// --- Constants ---
const POSITIONS_FOR_UI = [['LW', 'ST', 'RW'], ['CAM', 'CM', 'CDM'], ['LB', 'CB', 'RB'], ['GK']];
const BASE_STAT = 60; // 모든 스탯의 기본 시작 점수

// --- Sub-Components (가독성을 위한 하위 컴포넌트 분리) ---

// 1. 포지션 선택 화면
const PositionSelector = ({ onSelect }) => (
  <>
    <div className={styles.questionContent}>
      <p>Q0.</p>
      <h2 className={styles.questionText}>당신의 주 포지션은 무엇인가요?</h2>
    </div>
    <div className={styles.answerFooter}>
      <div className={styles.positionFormation}>
        {POSITIONS_FOR_UI.map((line, lineIndex) => (
          <div key={lineIndex} className={styles.positionLine}>
            {line.map(pos => (
              <button key={pos} className={styles.positionCard} onClick={() => onSelect(pos)}>{pos}</button>
            ))}
          </div>
        ))}
      </div>
    </div>
  </>
);

// 2. 질문 답변 화면
const Questionnaire = ({ question, onAnswer, questionNumber, totalQuestions }) => (
  <>
    <div className={styles.questionContent}>
      <p>Q{questionNumber}.</p>
      <h2 className={styles.questionText}>{question.text}</h2>
    </div>
    <div className={styles.answerFooter}>
      {question.answers.map((answer, index) => (
        <button key={index} className={styles.answerButton} onClick={() => onAnswer(answer.effects)}>
          {answer.text}
        </button>
      ))}
    </div>
  </>
);

// 3. 분석 중 로딩 화면
const AnalysisLoader = () => (
  <div className={styles.centeredContainer}>
    <h2 className={styles.analysisTitle}>분석 중...</h2>
    <p className={styles.analysisSubtitle}>당신에게 꼭 맞는 선수를 찾고 있습니다.</p>
  </div>
);


// --- Main Component (메인 서베이 페이지) ---

function SurveyPage({ userProfile }) {
  // --- 상태 관리 ---
  const [step, setStep] = useState('position'); // 'position', 'answering', 'analyzing'
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userStats, setUserStats] = useState({ PAC: 0, SHO: 0, PAS: 0, DRI: 0, DEF: 0, PHY: 0 });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // --- 로직 (Hooks) ---

  // 1. 포지션이 선택되면, 그에 맞는 질문 목록을 생성하는 Hook
  useEffect(() => {
    if (step !== 'answering' || !selectedPosition) return;

    // GK는 전용 질문만 사용
    if (selectedPosition === 'GK') {
      const gkQuestions = QUESTION_BANK['GK'] || [];
      setQuestions(gkQuestions.sort(() => 0.5 - Math.random()).slice(0, 5));
      return;
    }
    
    // 포지션 키 정규화 (RW -> LW, RB -> LB)
    let positionKey = ['RW', 'RB'].includes(selectedPosition) ? selectedPosition.replace('R','L') : selectedPosition;
    
    const positionQuestions = QUESTION_BANK[positionKey] || [];
    let otherQuestions = [];
    // 해당 포지션과 GK를 제외한 모든 질문을 가져옴
    for (const pos in QUESTION_BANK) {
      if (pos !== positionKey && pos !== 'GK') {
        otherQuestions.push(...QUESTION_BANK[pos]);
      }
    }
    
    // 다른 포지션 질문 중 랜덤으로 6개 선택
    const randomQuestions = otherQuestions.sort(() => 0.5 - Math.random()).slice(0, 6);
    // 최종 질문 목록 (포지션 + 랜덤)을 다시 섞어서 설정
    setQuestions([...positionQuestions, ...randomQuestions].sort(() => 0.5 - Math.random()));

  }, [step, selectedPosition]);


  // 2. 마지막 질문에 답변하면, 자동으로 분석을 시작하는 Hook
  useEffect(() => {
    if (questions.length > 0 && currentIndex === questions.length) {
      processAndSaveSurvey();
    }
  }, [currentIndex, questions]);

  // --- 이벤트 핸들러 ---

  const handlePositionSelect = (position) => {
    setSelectedPosition(position);
    setStep('answering');
  };

  const handleAnswer = (effects) => {
    // 기존 스탯에 답변 효과를 누적
    const newStats = { ...userStats };
    for (const stat in effects) {
      if (stat in newStats) {
        newStats[stat] += effects[stat];
      }
    }
    setUserStats(newStats);
    setCurrentIndex(prev => prev + 1); // 다음 질문으로
  };

  // --- 데이터 처리 및 저장 ---
  const processAndSaveSurvey = async () => {
    setStep('analyzing');
    setError('');

    const user = auth.currentUser;
    if (!user) {
      setError("사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
      setStep('position'); // 오류 발생 시 처음으로
      return;
    }

    try {
      // 1. 최종 스탯 계산 (기본 점수 + 누적 점수)
      const finalStats = Object.keys(userStats).reduce((acc, key) => {
        acc[key] = BASE_STAT + Math.round(userStats[key]);
        return acc;
      }, {});
      
      // 2. DB에서 비교할 선수 데이터 가져오기
      const playersRef = collection(db, "players");
      const q = query(playersRef, where("Position", "==", selectedPosition));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) throw new Error(`'${selectedPosition}' 포지션의 선수를 찾을 수 없습니다.`);
      const positionPlayers = querySnapshot.docs.map(d => d.data());

      // 3. [리팩토링] 분리된 분석 함수를 호출하여 결과 얻기
      const topPlayers = findTopMatchingPlayers(finalStats, positionPlayers, selectedPosition);

      // 4. Firestore에 사용자 데이터 업데이트
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        surveyCompleted: true,
        stats: finalStats,
        preferredPosition: selectedPosition,
        recommendedPlayers: topPlayers
      });

      // 5. 사용자의 팀 정보가 있다면, 멤버 문서에도 포지션 정보 업데이트
      if (userProfile?.teamId) {
        const teamMemberRef = doc(db, "teams", userProfile.teamId, "members", user.uid);
        await setDoc(teamMemberRef, { position: selectedPosition }, { merge: true });
      }

      // 6. 설문 완료 후 메인 페이지로 이동
      navigate("/"); // App.jsx에서 '/'가 메인 화면(HomePage)임

    } catch (err) {
      console.error("Survey Processing Error:", err);
      setError(`분석 중 오류가 발생했습니다: ${err.message}`);
      setStep('position'); // 오류 시 처음 단계로 리셋
    }
  };

  // --- UI 렌더링 로직 ---
  
  // 프로그레스 바 계산
  const totalQuestions = questions.length || (selectedPosition === 'GK' ? 5 : 10);
  const progress = (currentIndex / totalQuestions) * 100;

  const renderStep = () => {
    switch (step) {
      case 'answering':
        const currentQuestion = questions[currentIndex];
        return currentQuestion ? (
          <Questionnaire 
            question={currentQuestion} 
            onAnswer={handleAnswer}
            questionNumber={currentIndex + 1}
            totalQuestions={totalQuestions}
          />
        ) : null; // 질문이 아직 로드되지 않았을 경우
      case 'analyzing':
        return <AnalysisLoader />;
      case 'position':
      default:
        return <PositionSelector onSelect={handlePositionSelect} />;
    }
  };

  return (
    <div className={styles.surveyContainer}>
      <div className={styles.progressBarContainer}>
        <div className={styles.progressBar} style={{ width: `${progress}%` }} />
      </div>
      {error && <p className={styles.errorMessage}>{error}</p>}
      {renderStep()}
    </div>
  );
}

export default SurveyPage;
