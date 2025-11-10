/**
 * 팀 생성을 위한 페이지로 팀 정보 입력과 Firestore 초기 구성을 담당한다.
 */
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";

import styles from "./TeamCreatePage.module.css";

// 팀명을 입력받아 새 팀과 사용자 정보를 갱신한다.
function TeamCreatePage() {
  const [teamName, setTeamName] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // 사용자 프로필을 미리 불러와 가입 가능 여부를 확인한다.
  useEffect(() => {
    const fetchUserProfile = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        }
      }
      setIsLoading(false);
    };
    fetchUserProfile();
  }, []);

  // 팀 생성 버튼 클릭 시 중복 여부를 확인하고 팀을 만든다.
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedTeamName = teamName.trim();
    if (isLoading || !userProfile) {
      setError("프로필 정보를 불러오는 중입니다.");
      return;
    }
    if (!trimmedTeamName) {
      setError("팀 이름을 입력해주세요.");
      return;
    }
    if (userProfile.teamId) {
      setError("이미 다른 팀에 소속되어 있습니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      const user = auth.currentUser;
      const teamsRef = collection(db, "teams");

      const normalizedTeamName = trimmedTeamName.toLowerCase();
      const q = query(
        teamsRef,
        where("teamNameLower", "==", normalizedTeamName),
        limit(1),
      );
      const duplicateSnapshot = await getDocs(q);

      if (!duplicateSnapshot.empty) {
        throw new Error("이미 존재하는 팀 이름입니다.");
      }

      const inviteCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      const teamDocRef = await addDoc(teamsRef, {
        teamName: trimmedTeamName,
        teamNameLower: normalizedTeamName,
        captainId: user.uid,
        inviteCode: inviteCode,
        createdAt: serverTimestamp(),
      });
      const newTeamId = teamDocRef.id;

      const memberDocRef = doc(db, "teams", newTeamId, "members", user.uid);
      await setDoc(memberDocRef, {
        realName: userProfile.realName || "이름없음",
        position: userProfile.preferredPosition || "CM",
        role: "captain",
        joinedAt: serverTimestamp(),
      });

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        teamId: newTeamId,
        teamRole: "captain",
      });

      navigate(`/team/${newTeamId}`);
    } catch (err) {
      console.error("Team Creation Error:", err);
      setError(err.message || "팀 생성 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>프로필 정보를 확인 중...</div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <Link to="/" className={styles.backButton}>
          ←
        </Link>
      </header>
      <div className={styles.content}>
        <form onSubmit={handleCreateTeam}>
          <h2 className={styles.title}>새로운 팀 만들기</h2>
          <input
            className={styles.input}
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="팀 이름을 입력하세요"
            aria-label="팀 이름"
            maxLength={40}
          />
        </form>
      </div>
      <div className={styles.footer}>
        {error && <p className={styles.errorMessage}>{error}</p>}
        <button
          type="submit"
          className={styles.button}
          onClick={handleCreateTeam}
          disabled={isSubmitting}
        >
          {isSubmitting ? "생성 중..." : "팀 생성하기"}
        </button>
      </div>
    </div>
  );
}

export default TeamCreatePage;
