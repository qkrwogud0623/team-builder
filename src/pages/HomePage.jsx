/**
 * 홈 화면으로 사용자 프로필, 추천 선수, 팀 관련 작업을 안내한다.
 */
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import {
  updateDoc,
  setDoc,
  doc,
  deleteField,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  limit,
} from "firebase/firestore";
import { auth, db } from "../firebase";

import { PostMatchSurveyModal } from "../components/PostMatchSurveyModal";
import ConfirmModal from "../components/ConfirmModal";
import styles from "./HomePage.module.css";

// 추천 선수 카드 영역을 노출한다.
const PlayerSelection = ({ recommendedPlayers, onSelectPlayer }) => (
  <div className={styles.choiceContainer}>
    <div className={styles.choiceContent}>
      <h2 className={styles.choiceTitle}>분석 완료!</h2>
      <p className={styles.choiceSubtitle}>
        당신과 가장 유사한 선수를 선택해 프로필을 생성하세요.
      </p>
      <div className={styles.choiceListContainer}>
        {recommendedPlayers?.map((player, index) => (
          <button
            key={index}
            className={styles.playerChoiceCard}
            onClick={() => onSelectPlayer(player)}
          >
            <div className={styles.playerInfo}>
              <span className={styles.playerName}>{player.name}</span>
              <span className={styles.playerTeam}>{player.team}</span>
            </div>
            <div className={styles.playerOvr}>
              <span>OVR</span>
              <span>{player.ovr}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  </div>
);

// 가입자 정보를 보여주고 설문 다시 하기, 로그아웃 등을 제공한다.
const UserProfile = ({ profile, myOvr, onLogout, onRedoSurvey }) => {
  const navigate = useNavigate();
  const hasTeam = !!profile?.teamId;

  return (
    <div className={styles.mainContainer}>
      <header className={styles.mainHeader}>
        <h2>마이 프로필</h2>
        <button onClick={onLogout} className={styles.logoutButton}>
          로그아웃
        </button>
      </header>
      <div className={styles.profileContent}>
        <div className={`${styles.profileCard} ${styles.mainProfileCard}`}>
          <div className={styles.playerInfo}>
            <span className={styles.profileName}>{profile.realName}</span>
            <span className={styles.playerTeam}>
              대표 선수: {profile.selectedPlayer.name}
            </span>
          </div>
          <div className={styles.playerOvr}>
            <span>MY OVR</span>
            <span>{myOvr}</span>
          </div>
        </div>
        <div className={styles.statsGrid}>
          {profile.stats &&
            ["DRI", "PAC", "PAS", "PHY", "SHO", "DEF"].map((stat) => (
              <div key={stat} className={styles.statItem}>
                {}
                <span className={styles.statValue}>
                  {profile.stats[stat] || 60}
                </span>
                <span className={styles.statName}>{stat.toUpperCase()}</span>
              </div>
            ))}
        </div>
        <div className={styles.menuContainer}>
          <h3>팀 활동</h3>
          {hasTeam ? (
            <button
              className={styles.menuCard}
              onClick={() => navigate(`/team/${profile.teamId}`)}
            >
              <h4>나의 팀</h4>
              <p>팀 페이지로 이동하여 팀원과 경기 일정을 확인하세요.</p>
            </button>
          ) : (
            <>
              <Link to="/create-team" className={styles.menuCard}>
                <h4>팀 생성하기</h4>
                <p>새로운 팀을 만들고 팀원들을 초대하세요.</p>
              </Link>
              <Link to="/join-team" className={styles.menuCard}>
                <h4>팀 참가하기</h4>
                <p>초대 코드를 입력하여 기존 팀에 합류하세요.</p>
              </Link>
            </>
          )}
        </div>
        <div className={styles.menuContainer}>
          <h3>프로필 관리</h3>
          <button className={styles.menuCard} onClick={onRedoSurvey}>
            <h4>설문조사 다시하기</h4>
            <p>나의 플레이 스타일을 다시 분석하고 새로운 프로필을 받습니다.</p>
          </button>
        </div>
      </div>
    </div>
  );
};

// 사용자 상태를 기반으로 홈 화면의 전반적인 흐름을 제어한다.
function HomePage({ userProfile }) {
  const navigate = useNavigate();
  const [surveyData, setSurveyData] = useState(null);
  const [isRedoModalOpen, setRedoModalOpen] = useState(false);

  const myOvr = useMemo(() => {
    if (!userProfile) return 60;
    if (typeof userProfile.playerOvr === "number") return userProfile.playerOvr;
    if (userProfile.stats) {
      const values = Object.values(userProfile.stats)
        .map(Number)
        .filter((n) => !isNaN(n));
      if (values.length > 0)
        return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }
    return 60;
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile) return;
    const hasSelectedPlayer = !!userProfile.selectedPlayer;
    const hasRecommendations =
      Array.isArray(userProfile.recommendedPlayers) &&
      userProfile.recommendedPlayers.length > 0;
    if (!hasSelectedPlayer && !hasRecommendations) {
      navigate("/survey");
    }
  }, [userProfile, navigate]);

  useEffect(() => {
    const checkForPendingSurveys = async () => {
      const uid = auth.currentUser?.uid;
      const teamId = userProfile?.teamId;
      if (!uid || !teamId) return;

      const matchesRef = collection(db, "teams", teamId, "matches");
      const q = query(
        matchesRef,
        where("pendingSurveyParticipants", "array-contains", uid),
        limit(1),
      );

      const matchesSnapshot = await getDocs(q);

      if (!matchesSnapshot.empty) {
        const matchDoc = matchesSnapshot.docs[0];
        const pendingMatch = { id: matchDoc.id, ...matchDoc.data() };

        const surveyDocRef = doc(
          db,
          "teams",
          teamId,
          "matches",
          pendingMatch.id,
          "surveys",
          uid,
        );
        const surveySnap = await getDoc(surveyDocRef);

        if (!surveySnap.exists()) {
          const attRef = collection(
            db,
            "teams",
            teamId,
            "matches",
            pendingMatch.id,
            "attendance",
          );
          const qYes = query(attRef, where("status", "==", "yes"));
          const attSnap = await getDocs(qYes);
          const yesUids = attSnap.docs.map((d) => d.id);

          if (yesUids.length === 0) return;

          const userDocs = await Promise.all(
            yesUids.map((id) => getDoc(doc(db, "users", id))),
          );

          const attendees = userDocs
            .map((userSnap) => {
              if (!userSnap.exists()) return null;
              const u = userSnap.data();

              let ovr = 60;
              if (typeof u.playerOvr === "number") ovr = u.playerOvr;
              else if (u.stats) {
                const vals = Object.values(u.stats).filter(
                  (v) => typeof v === "number",
                );
                if (vals.length > 0)
                  ovr = Math.round(
                    vals.reduce((a, b) => a + b, 0) / vals.length,
                  );
              }
              return {
                uid: userSnap.id,
                name: u.realName,
                pos: u.position || "CM",
                ovr: ovr,
              };
            })
            .filter(Boolean);

          setSurveyData({ match: pendingMatch, attendees: attendees });
        }
      }
    };

    if (userProfile?.teamId) {
      checkForPendingSurveys();
    }
  }, [userProfile]);

  const handleLogout = () => {
    signOut(auth).catch((error) => console.error("Logout Error:", error));
  };

  const handlePlayerSelection = async (player) => {
    const user = auth.currentUser;
    if (!user || !player) return;

    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { selectedPlayer: player });

      const teamId = userProfile?.teamId;
      const newPos = player?.position || player?.pos || null;
      if (teamId && newPos) {
        const memberRef = doc(db, "teams", teamId, "members", user.uid);
        await setDoc(memberRef, { position: newPos }, { merge: true });
      }
    } catch (error) {
      console.error("Player selection failed:", error);
      alert("선수 선택 중 오류가 발생했습니다.");
    }
  };

  const handleConfirmRedoSurvey = async () => {
    setRedoModalOpen(false);
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        surveyCompleted: false,
        stats: deleteField(),
        recommendedPlayers: deleteField(),
        selectedPlayer: deleteField(),
      });
      navigate("/survey");
    } catch (error) {
      console.error("Redo survey failed:", error);
      alert("프로필 초기화 중 오류가 발생했습니다.");
    }
  };

  if (!userProfile) {
    return (
      <div className={styles.loadingContainer}>
        프로필 정보를 불러오는 중...
      </div>
    );
  }

  return (
    <>
      {}
      {surveyData && (
        <PostMatchSurveyModal
          teamId={userProfile.teamId}
          match={surveyData.match}
          attendees={surveyData.attendees}
          userProfile={userProfile}
          onClose={() => setSurveyData(null)}
        />
      )}

      {}
      {isRedoModalOpen && (
        <ConfirmModal
          title="설문조사 다시하기"
          message="정말로 다시 진행하시겠습니까? 스탯과 추천 선수 정보가 초기화됩니다."
          onConfirm={handleConfirmRedoSurvey}
          onClose={() => setRedoModalOpen(false)}
        />
      )}

      {}
      {userProfile.selectedPlayer ? (
        <UserProfile
          profile={userProfile}
          myOvr={myOvr}
          onLogout={handleLogout}
          onRedoSurvey={() => setRedoModalOpen(true)}
        />
      ) : (
        <PlayerSelection
          recommendedPlayers={userProfile.recommendedPlayers}
          onSelectPlayer={handlePlayerSelection}
        />
      )}
    </>
  );
}

export default HomePage;