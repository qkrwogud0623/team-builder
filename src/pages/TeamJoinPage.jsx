/**
 * 초대 코드를 확인해 기존 팀에 합류하는 페이지다.
 */
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import styles from "./TeamJoinPage.module.css";

// 초대 코드 제출 흐름을 담당한다.
function TeamJoinPage() {
  const [inviteCode, setInviteCode] = useState("");

  const [userProfile, setUserProfile] = useState(null);

  const [isLoading, setIsLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState("");

  const navigate = useNavigate();

  // 로그인 사용자의 프로필을 불러온다.
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

  // 초대 코드 검증 후 팀 정보를 업데이트한다.
  const handleJoinTeam = async (e) => {
    e.preventDefault();

    setError("");

    if (isLoading || !userProfile) {
      setError("프로필 정보를 불러오는 중입니다.");

      return;
    }

    if (!inviteCode.trim()) {
      setError("초대 코드를 입력해주세요.");

      return;
    }

    if (userProfile.teamId) {
      setError("이미 다른 팀에 소속되어 있습니다.");

      return;
    }

    setIsSubmitting(true);

    const user = auth.currentUser;

    try {
      const teamsRef = collection(db, "teams");

      const q = query(
        teamsRef,
        where("inviteCode", "==", inviteCode.trim().toUpperCase()),
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("유효하지 않은 초대 코드입니다.");
      }

      const teamDoc = querySnapshot.docs[0];

      const teamId = teamDoc.id;

      const memberDocRef = doc(db, "teams", teamId, "members", user.uid);

      await setDoc(memberDocRef, {
        realName: userProfile.realName,

        position: userProfile.preferredPosition || "CM",

        role: "member",
      });

      const userDocRef = doc(db, "users", user.uid);

      await updateDoc(userDocRef, {
        teamId: teamId,

        teamRole: "member",
      });

      navigate(`/team/${teamId}`);
    } catch (err) {
      console.error("Team Join Error:", err);

      setError(err.message || "팀 참가 중 오류가 발생했습니다.");
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
        <form onSubmit={handleJoinTeam}>
          <h2 className={styles.title}>팀에 참가하기</h2>

          <input
            className={styles.input}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="초대 코드를 입력하세요"
            aria-label="초대 코드"
          />
        </form>
      </div>

      <div className={styles.footer}>
        {error && <p className={styles.errorMessage}>{error}</p>}

        <button
          className={styles.button}
          onClick={handleJoinTeam}
          disabled={isSubmitting}
        >
          {isSubmitting ? "참가하는 중..." : "참가하기"}
        </button>
      </div>
    </div>
  );
}

export default TeamJoinPage;
