/**
 * 능력치 설문을 통해 사용자 맞춤 추천 선수를 결정하는 설문 페이지다.
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { QUESTION_BANK } from "../data/surveyQuestions";
import { findTopMatchingPlayers } from "../utils/surveyAnalytics";

import styles from "./SurveyPage.module.css";

const POSITIONS_FOR_UI = [
  ["LW", "ST", "RW"],
  ["CAM", "CM", "CDM"],
  ["LB", "CB", "RB"],
  ["GK"],
];
const BASE_STAT = 60;

// 설문 첫 단계에서 포지션 버튼을 제공한다.
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
            {line.map((pos) => (
              <button
                key={pos}
                className={styles.positionCard}
                onClick={() => onSelect(pos)}
              >
                {pos}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  </>
);

// 현재 질문과 선택지를 버튼으로 보여준다.
const Questionnaire = ({ question, onAnswer, questionNumber }) => (
  <>
    <div className={styles.questionContent}>
      <p>Q{questionNumber}.</p>
      <h2 className={styles.questionText}>{question.text}</h2>
    </div>
    <div className={styles.answerFooter}>
      {question.answers.map((answer, index) => (
        <button
          key={index}
          className={styles.answerButton}
          onClick={() => onAnswer(answer.effects)}
        >
          {answer.text}
        </button>
      ))}
    </div>
  </>
);

// 통계 계산 중임을 알리는 로딩 레이아웃이다.
const AnalysisLoader = () => (
  <div className={styles.centeredContainer}>
    <h2 className={styles.analysisTitle}>분석 중...</h2>
    <p className={styles.analysisSubtitle}>
      당신에게 꼭 맞는 선수를 찾고 있습니다.
    </p>
  </div>
);

// 설문 단계를 관리하고 결과를 저장한다.
function SurveyPage({ userProfile }) {
  const [step, setStep] = useState("position");
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userStats, setUserStats] = useState({
    PAC: 0,
    SHO: 0,
    PAS: 0,
    DRI: 0,
    DEF: 0,
    PHY: 0,
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (step !== "answering" || !selectedPosition) return;

    if (selectedPosition === "GK") {
      const gkQuestions = QUESTION_BANK["GK"] || [];
      setQuestions(gkQuestions.sort(() => 0.5 - Math.random()).slice(0, 5));
      return;
    }

    let positionKey = ["RW", "RB"].includes(selectedPosition)
      ? selectedPosition.replace("R", "L")
      : selectedPosition;

    const positionQuestions = QUESTION_BANK[positionKey] || [];
    let otherQuestions = [];
    for (const pos in QUESTION_BANK) {
      if (pos !== positionKey && pos !== "GK") {
        otherQuestions.push(...QUESTION_BANK[pos]);
      }
    }

    const randomQuestions = otherQuestions
      .sort(() => 0.5 - Math.random())
      .slice(0, 6);
    setQuestions(
      [...positionQuestions, ...randomQuestions].sort(
        () => 0.5 - Math.random(),
      ),
    );
  }, [step, selectedPosition]);

  useEffect(() => {
    if (questions.length > 0 && currentIndex === questions.length) {
      processAndSaveSurvey();
    }
  }, [currentIndex, questions]);

  // 포지션 선택 후 다음 단계로 넘긴다.
  const handlePositionSelect = (position) => {
    setSelectedPosition(position);
    setStep("answering");
  };

  // 답변이 가진 능력치 변화를 누적한다.
  const handleAnswer = (effects) => {
    const newStats = { ...userStats };
    for (const stat in effects) {
      if (stat in newStats) {
        newStats[stat] += effects[stat];
      }
    }
    setUserStats(newStats);
    setCurrentIndex((prev) => prev + 1);
  };

  // 설문 완료 시 능력치와 추천 선수를 저장한다.
  const processAndSaveSurvey = async () => {
    setStep("analyzing");
    setError("");

    const user = auth.currentUser;
    if (!user) {
      setError("사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
      setStep("position");
      return;
    }

    try {
      const finalStats = Object.keys(userStats).reduce((acc, key) => {
        acc[key] = BASE_STAT + Math.round(userStats[key]);
        return acc;
      }, {});

      const playersRef = collection(db, "players");
      const q = query(playersRef, where("Position", "==", selectedPosition));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty)
        throw new Error(
          `'${selectedPosition}' 포지션의 선수를 찾을 수 없습니다.`,
        );
      const positionPlayers = querySnapshot.docs.map((d) => d.data());

      const topPlayers = findTopMatchingPlayers(
        finalStats,
        positionPlayers,
        selectedPosition,
      );

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        surveyCompleted: true,
        stats: finalStats,
        preferredPosition: selectedPosition,
        recommendedPlayers: topPlayers,
      });

      if (userProfile?.teamId) {
        const teamMemberRef = doc(
          db,
          "teams",
          userProfile.teamId,
          "members",
          user.uid,
        );
        await setDoc(
          teamMemberRef,
          { position: selectedPosition },
          { merge: true },
        );
      }

      navigate("/");
    } catch (err) {
      console.error("Survey Processing Error:", err);
      setError(`분석 중 오류가 발생했습니다: ${err.message}`);
      setStep("position");
    }
  };

  const totalQuestions =
    questions.length || (selectedPosition === "GK" ? 5 : 10);
  const progress = (currentIndex / totalQuestions) * 100;

  const renderStep = () => {
    switch (step) {
      case "answering": {
        const currentQuestion = questions[currentIndex];
        return currentQuestion ? (
          <Questionnaire
            question={currentQuestion}
            onAnswer={handleAnswer}
            questionNumber={currentIndex + 1}
          />
        ) : null;
      }

      case "analyzing":
        return <AnalysisLoader />;
      case "position":
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
