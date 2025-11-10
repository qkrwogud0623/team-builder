/**
 * 경기 후 투표를 받고 결과를 스탯에 반영하는 모달이다.
 */
import React, { useState, useMemo } from "react";
import {
  doc,
  getDocs,
  getDoc,
  collection,
  writeBatch,
} from "firebase/firestore";

import { db, auth } from "../firebase";
import styles from "./PostMatchSurveyModal.module.css";
import { Dropdown } from "./Dropdown.jsx";

const VOTE_THRESHOLD = 1;

const VOTE_CATEGORIES = [
  { id: "bomber", text: "✈️ 폭격기 (Best Attacker)", stat: "SHO" },
  { id: "midfielder", text: "🧠 중원의 지배자 (MVP)", stat: "PAS" },
  { id: "defender", text: "🔒 빗장수비 (Best Defender)", stat: "DEF" },
  { id: "goalkeeper", text: "🧤 거미손 (Best Goalkeeper)", stat: "PHY" },
];

// 경기별 투표와 스탯 갱신을 담당한다.
export const PostMatchSurveyModal = ({
  teamId,
  match,
  attendees = [],
  onClose,
}) => {
  const [votes, setVotes] = useState({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { playerOptionsList, uidToNameMap, nameToUidMap } = useMemo(() => {
    const optionsList = [];
    const uidMap = new Map();
    const nameMap = new Map();
    for (const player of attendees) {
      const displayName = `${player.name} (${player.pos || "N/A"})`;
      optionsList.push(displayName);
      uidMap.set(player.uid, displayName);
      nameMap.set(displayName, player.uid);
    }
    optionsList.sort();
    return {
      playerOptionsList: optionsList,
      uidToNameMap: uidMap,
      nameToUidMap: nameMap,
    };
  }, [attendees]);

  const handleVoteSelect = (category, displayName) => {
    const uid = nameToUidMap.get(displayName);
    if (uid) {
      setVotes((prev) => ({ ...prev, [category]: uid }));
    }
  };

  // 투표 결과를 정리해 스탯 증가 값을 계산한다.
  const runStatAggregation = async (batch, allVotes, userStatsMap) => {
    try {
      const tally = {};
      VOTE_CATEGORIES.forEach((cat) => {
        tally[cat.id] = {};
      });
      for (const survey of allVotes) {
        VOTE_CATEGORIES.forEach((cat) => {
          const votedUid = survey[cat.id];
          if (votedUid) {
            tally[cat.id][votedUid] = (tally[cat.id][votedUid] || 0) + 1;
          }
        });
      }

      const statBoosts = {};

      const addBoost = (uid, stat) => {
        const currentStats = userStatsMap.get(uid) || {};
        const currentValue = currentStats[stat] || 60;

        if (!statBoosts[uid]) statBoosts[uid] = {};
        statBoosts[uid][`stats.${stat}`] = currentValue + 1;
      };

      VOTE_CATEGORIES.forEach((cat) => {
        const categoryTally = tally[cat.id];
        for (const uid in categoryTally) {
          if (categoryTally[uid] >= VOTE_THRESHOLD) {
            addBoost(uid, cat.stat);
          }
        }
      });

      for (const uid in statBoosts) {
        const userRef = doc(db, "users", uid);
        batch.update(userRef, statBoosts[uid]);
      }

      const matchRef = doc(db, "teams", teamId, "matches", match.id);
      batch.update(matchRef, { statsCalculated: true });
    } catch (err) {
      console.error("스탯 집계 중 심각한 오류:", err);
      throw new Error("스탯 집계 실패");
    }
  };

  // 투표 제출 후 필요 시 스탯을 갱신한다.
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (Object.keys(votes).length < VOTE_CATEGORIES.length) {
      setError("모든 항목에 투표해주세요.");
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid || !teamId || !match?.id) return;

    setIsSubmitting(true);
    setError("");

    try {
      const batch = writeBatch(db);
      const surveyColRef = collection(
        db,
        "teams",
        teamId,
        "matches",
        match.id,
        "surveys",
      );

      const surveyRef = doc(surveyColRef, uid);
      batch.set(surveyRef, {
        ...votes,
        submittedAt: new Date(),
      });

      const matchRef = doc(db, "teams", teamId, "matches", match.id);
      const updatedParticipants = (
        match.pendingSurveyParticipants || []
      ).filter((id) => id !== uid);
      batch.update(matchRef, {
        pendingSurveyParticipants: updatedParticipants,
      });

      const allSurveysSnap = await getDocs(surveyColRef);
      const totalAttendees = attendees.length;
      const amILast = allSurveysSnap.docs.length + 1 >= totalAttendees;

      if (amILast) {
        const allVotes = [...allSurveysSnap.docs.map((d) => d.data()), votes];
        const uidsToUpdate = new Set(
          allVotes.flatMap((vote) => Object.values(vote)),
        );

        const userDocs = await Promise.all(
          Array.from(uidsToUpdate).map((id) => getDoc(doc(db, "users", id))),
        );
        const userStatsMap = new Map(
          userDocs.map((doc) => [doc.id, doc.data()?.stats || {}]),
        );

        await runStatAggregation(batch, allVotes, userStatsMap);
      }

      await batch.commit();

      if (amILast) {
        alert(
          "설문이 제출되었습니다. 모든 선수가 투표를 완료하여 스탯이 자동 반영되었습니다!",
        );
      } else {
        alert("설문이 제출되었습니다. 감사합니다.");
      }
      onClose();
    } catch (err) {
      console.error("설문 제출 오류:", err);
      setError("제출 중 오류가 발생했습니다. 다시 시도해주세요.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>경기 결과 투표</h3>
          <button
            onClick={onClose}
            className={styles.closeButton}
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <p className={styles.description}>
            각 항목별로 가장 뛰어난 활약을 펼친 선수 1명을 선택해주세요.
            <br />
            모든 선수가 투표를 완료하면 <strong>{VOTE_THRESHOLD}표 이상</strong>
            을 받은 선수의 스탯이 상승합니다.
          </p>

          {}
          {VOTE_CATEGORIES.map((category) => {
            const selectedDisplayName = uidToNameMap.get(votes[category.id]);

            return (
              <div key={category.id} className={styles.questionBlock}>
                <label>{category.text}</label>
                <Dropdown
                  placeholder="선수를 선택하세요"
                  options={playerOptionsList}
                  value={selectedDisplayName}
                  onChange={(displayName) =>
                    handleVoteSelect(category.id, displayName)
                  }
                />
              </div>
            );
          })}

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? "제출 중..." : "투표 완료"}
          </button>
        </form>
      </div>
    </div>
  );
};
