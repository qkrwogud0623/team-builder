/**
 * 경기 상세 모달로 참석 현황과 관리 동작을 제어한다.
 */
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

import modalStyles from "./CreateMatchModal.module.css";
import styles from "./MatchDetailModal.module.css";

// 참석 상태를 시각적으로 표시한다.
const AttendanceBadge = ({ status }) => {
  const statusMap = {
    yes: { text: "참석", className: styles.badgeYes },
    no: { text: "불참", className: styles.badgeNo },
    maybe: { text: "미정", className: styles.badgeMaybe },
    default: { text: "미응답", className: styles.badgeNone },
  };
  const { text, className } = statusMap[status] || statusMap.default;
  return <span className={`${styles.badge} ${className}`}>{text}</span>;
};
// 경기별 참석 현황을 보고 수정하는 모달이다.
export const MatchDetailModal = ({ teamId, match, onClose, canManage }) => {
  const [attendance, setAttendance] = useState([]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!teamId || !match?.id) return;

    const membersCollection = collection(db, "teams", teamId, "members");
    const unsubscribeMembers = onSnapshot(
      membersCollection,
      (membersSnapshot) => {
        const members = membersSnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const attendanceCollection = collection(
          db,
          "teams",
          teamId,
          "matches",
          match.id,
          "attendance",
        );
        const unsubscribeAttendance = onSnapshot(
          attendanceCollection,
          (attendanceSnapshot) => {
            const attendanceMap = new Map(
              attendanceSnapshot.docs.map((d) => [d.id, d.data().status]),
            );

            const combinedList = members.map((member) => ({
              ...member,
              status: attendanceMap.get(member.id) || "none",
            }));
            setAttendance(combinedList);
          },
        );

        return () => unsubscribeAttendance();
      },
    );

    return () => unsubscribeMembers();
  }, [teamId, match?.id]);

  const handleSetMyStatus = async (status) => {
    const user = auth.currentUser;
    if (!user) {
      setError("로그인이 필요합니다.");
      return;
    }
    setError("");
    setIsSaving(true);
    try {
      const attendanceDocRef = doc(
        db,
        "teams",
        teamId,
        "matches",
        match.id,
        "attendance",
        user.uid,
      );
      await setDoc(
        attendanceDocRef,
        { status, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } catch (e) {
      console.error("Failed to set attendance:", e);
      setError("상태 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMatch = async () => {
    if (
      !window.confirm("경기를 삭제하시겠습니까? 모든 참석 정보가 사라집니다.")
    )
      return;

    setError("");
    try {
      const attendanceCol = collection(
        db,
        "teams",
        teamId,
        "matches",
        match.id,
        "attendance",
      );
      const attendanceSnap = await getDocs(attendanceCol);
      await Promise.all(attendanceSnap.docs.map((d) => deleteDoc(d.ref)));

      await deleteDoc(doc(db, "teams", teamId, "matches", match.id));
      onClose();
    } catch (e) {
      console.error("Failed to delete match:", e);
      setError("경기 삭제에 실패했습니다.");
    }
  };

  const myStatus =
    attendance.find((att) => att.id === auth.currentUser?.uid)?.status ||
    "none";
  const counts = attendance.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    { yes: 0, no: 0, maybe: 0, none: 0 },
  );
  const whenStr = match.when?.toDate
    ? format(match.when.toDate(), "yyyy.MM.dd (EEE) HH:mm", { locale: ko })
    : "날짜 미정";

  return createPortal(
    <div className={modalStyles.overlay} onMouseDown={onClose}>
      <div
        className={modalStyles.content}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={modalStyles.header}>
          <h2 className={modalStyles.title}>경기 참석 현황</h2>
          <button className={modalStyles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={modalStyles.body}>
          <div className={styles.matchInfo}>
            <strong>{whenStr}</strong> · {match.location}
          </div>

          <div className={styles.myActions}>
            <button
              className={myStatus === "yes" ? styles.active : ""}
              onClick={() => handleSetMyStatus("yes")}
              disabled={isSaving}
            >
              참석
            </button>
            <button
              className={myStatus === "maybe" ? styles.active : ""}
              onClick={() => handleSetMyStatus("maybe")}
              disabled={isSaving}
            >
              미정
            </button>
            <button
              className={myStatus === "no" ? styles.active : ""}
              onClick={() => handleSetMyStatus("no")}
              disabled={isSaving}
            >
              불참
            </button>
          </div>

          <div className={styles.summary}>
            <span>참석 {counts.yes}</span>·<span>불참 {counts.no}</span>·
            <span>미정 {counts.maybe}</span>·<span>미응답 {counts.none}</span>
          </div>

          <div className={styles.attendanceList}>
            {attendance.map((person) => (
              <div key={person.id} className={styles.attendanceRow}>
                <div>
                  <div className={styles.name}>{person.realName}</div>
                  <div className={styles.role}>
                    {person.position} ({person.role})
                  </div>
                </div>
                <AttendanceBadge status={person.status} />
              </div>
            ))}
          </div>
        </div>

        <div className={modalStyles.footer}>
          {error && <p className={modalStyles.errorMessage}>{error}</p>}
          <div className={modalStyles.buttonGroup}>
            {canManage && (
              <button
                className={`${modalStyles.button} ${modalStyles.secondary}`}
                onClick={handleDeleteMatch}
              >
                경기 삭제
              </button>
            )}
            <button
              className={`${modalStyles.button} ${modalStyles.primary}`}
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
