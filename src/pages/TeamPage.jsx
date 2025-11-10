/**
 * 팀 상세 페이지로 구성원 관리, 경기 일정, 설문 모달을 모두 제어한다.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  updateDoc,
  deleteField,
  setDoc,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CreateMatchModal } from "../components/CreateMatchModal.jsx";
import { SquadModal } from "../components/SquadModal.jsx";
import { PostMatchSurveyModal } from "../components/PostMatchSurveyModal.jsx";
import { ResultsModal } from "../components/ResultsModal.jsx";
import styles from "./TeamPage.module.css";

// 팀 정보, 경기, 모달 상태를 총괄한다.
function TeamPage({ userProfile }) {
  const { teamId } = useParams();

  const navigate = useNavigate();

  const [teamInfo, setTeamInfo] = useState(null);

  const [members, setMembers] = useState([]);

  const [matches, setMatches] = useState([]);

  const [myAttMap, setMyAttMap] = useState({});

  const [loading, setLoading] = useState(true);

  const [isLeaving, setIsLeaving] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [squadState, setSquadState] = useState({
    open: false,
    match: null,
    attendees: [],
  });

  const [surveyState, setSurveyState] = useState({
    open: false,
    match: null,
    attendees: [],
  });

  const [resultsState, setResultsState] = useState({
    open: false,
    match: null,
    data: null,
  });

  const role = useMemo(
    () =>
      userProfile?.teamId === teamId
        ? (userProfile?.teamRole || "member").toLowerCase()
        : "",

    [userProfile, teamId],
  );

  const isCaptain = role === "captain";

  const isVice = role.includes("vice");

  const canManage = isCaptain || isVice;

  useEffect(() => {
    if (!teamId) return;

    setLoading(true);

    const teamDocRef = doc(db, "teams", teamId);

    const unsubscribeTeam = onSnapshot(teamDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setTeamInfo(docSnap.data());
      } else {
        navigate("/");
      }
    });

    const membersQuery = query(collection(db, "teams", teamId, "members"));

    const unsubscribeMembers = onSnapshot(membersQuery, async (snapshot) => {
      const baseMembers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      const userDocs = await Promise.all(
        baseMembers.map((m) =>
          getDoc(doc(db, "users", m.id)).catch(() => null),
        ),
      );

      const usersMap = new Map(
        userDocs.filter(Boolean).map((snap) => [snap.id, snap.data()]),
      );

      const confirmed = [];

      for (const m of baseMembers) {
        const u = usersMap.get(m.id);

        if (!u || u.teamId !== teamId) {
          if (canManage) deleteDoc(doc(db, "teams", teamId, "members", m.id));

          continue;
        }

        let displayOvr = 60;

        if (typeof u.playerOvr === "number") {
          displayOvr = u.playerOvr;
        } else if (u.stats) {
          const vals = Object.values(u.stats).filter(
            (v) => typeof v === "number",
          );

          if (vals.length > 0) {
            displayOvr = Math.round(
              vals.reduce((a, b) => a + b, 0) / vals.length,
            );
          }
        }

        confirmed.push({
          ...m,

          selectedPlayerName: u.selectedPlayer?.name || null,

          position: u.position || m.position,

          displayOvr,
        });
      }

      const roleRank = (r) => {
        const s = String(r || "member").toLowerCase();

        if (s === "captain") return 0;

        if (s.includes("vice")) return 1;

        return 2;
      };

      const sortedMembers = [...confirmed].sort((a, b) => {
        const roleA = roleRank(a.role);

        const roleB = roleRank(b.role);

        if (roleA !== roleB) return roleA - roleB;

        const ovrA = a.displayOvr || 0;

        const ovrB = b.displayOvr || 0;

        if (ovrB !== ovrA) return ovrB - ovrA;

        return (a.realName || "").localeCompare(b.realName || "", "ko");
      });

      setMembers(sortedMembers);

      setLoading(false);
    });

    const matchesQuery = query(
      collection(db, "teams", teamId, "matches"),
      orderBy("when", "desc"),
    );

    const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
      setMatches(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));

      setLoading(false);
    });

    return () => {
      unsubscribeTeam();

      unsubscribeMembers();

      unsubscribeMatches();
    };
  }, [teamId, navigate, canManage]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;

    if (!teamId || !uid || matches.length === 0) {
      setMyAttMap({});

      return;
    }

    const unsubs = matches.map((m) =>
      onSnapshot(
        doc(db, "teams", teamId, "matches", m.id, "attendance", uid),
        (snap) => {
          setMyAttMap((prev) => ({
            ...prev,
            [m.id]: snap.exists() ? snap.data().status : "none",
          }));
        },
      ),
    );

    return () => unsubs.forEach((u) => u());
  }, [teamId, matches]);

  const buildAttendeesForMatch = useCallback(
    async (match) => {
      if (!teamId || !match?.id) return [];

      const attendanceRef = collection(
        db,
        "teams",
        teamId,
        "matches",
        match.id,
        "attendance",
      );

      const qYes = query(attendanceRef, where("status", "==", "yes"));

      const attSnap = await getDocs(qYes);

      const yesUids = attSnap.docs.map((d) => d.id);

      if (yesUids.length === 0) return [];

      const userDocs = await Promise.all(
        yesUids.map((uid) => getDoc(doc(db, "users", uid))),
      );

      return userDocs
        .map((userSnap) => {
          if (!userSnap.exists()) return null;

          const u = userSnap.data();

          const name = u.realName;

          let ovr = 60;

          if (typeof u.playerOvr === "number") ovr = u.playerOvr;
          else if (u.stats) {
            const vals = Object.values(u.stats).filter(
              (v) => typeof v === "number",
            );

            if (vals.length > 0)
              ovr = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
          }

          return { uid: userSnap.id, name, pos: u.position || "CM", ovr };
        })
        .filter(Boolean);
    },
    [teamId],
  );

  const handleMatchCardClick = useCallback(
    async (match) => {
      try {
        const attendees = await buildAttendeesForMatch(match);

        if (match.status === "completed") {
          const nameMap = new Map(attendees.map((p) => [p.uid, p.name]));

          const sCol = collection(
            db,
            "teams",
            teamId,
            "matches",
            match.id,
            "surveys",
          );

          const sSnap = await getDocs(sCol);

          const counts = {
            attack: new Map(),
            defense: new Map(),
            mvp: new Map(),
          };

          sSnap.docs.forEach((d) => {
            const v = d.data() || {};

            (v.attack || []).forEach((uid) =>
              counts.attack.set(uid, (counts.attack.get(uid) || 0) + 1),
            );

            (v.defense || []).forEach((uid) =>
              counts.defense.set(uid, (counts.defense.get(uid) || 0) + 1),
            );

            if (v.mvp) counts.mvp.set(v.mvp, (counts.mvp.get(v.mvp) || 0) + 1);
          });

          const toSortedArr = (mp) =>
            [...mp.entries()]

              .map(([uid, cnt]) => ({
                uid,
                cnt,
                name: nameMap.get(uid) || `(탈퇴)`,
              }))

              .sort((a, b) => b.cnt - a.cnt);

          setResultsState({
            open: true,

            match,

            data: {
              attack: toSortedArr(counts.attack),

              defense: toSortedArr(counts.defense),

              mvp: toSortedArr(counts.mvp),
            },
          });
        } else {
          setSquadState({ open: true, match, attendees });
        }
      } catch (error) {
        console.error("카드 클릭 핸들러 에러:", error);

        alert("데이터를 불러오는 중 오류가 발생했습니다.");
      }
    },
    [teamId, buildAttendeesForMatch],
  );

  const handleSetVice = async (memberToUpdate) => {
    if (!teamId) return;

    const isAlreadyVice = (memberToUpdate.role || "")
      .toLowerCase()
      .includes("vice");

    const newRole = isAlreadyVice ? "member" : "vice-captain";

    try {
      const batch = writeBatch(db);

      const memberDocRef = doc(
        db,
        "teams",
        teamId,
        "members",
        memberToUpdate.id,
      );

      batch.update(memberDocRef, { role: newRole });

      const userDocRef = doc(db, "users", memberToUpdate.id);

      batch.update(userDocRef, { teamRole: newRole });

      await batch.commit();
    } catch (error) {
      console.error("부주장 임명/해제 실패:", error);

      alert("역할 변경 중 오류가 발생했습니다.");
    }
  };

  const handleLeaveTeam = async () => {
    const uid = auth.currentUser?.uid;

    if (!uid || !teamId) {
      alert("오류: 사용자 정보가 없거나 팀 정보가 없습니다.");

      return;
    }

    if (
      !window.confirm(
        "정말로 이 팀을 나가시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      )
    ) {
      return;
    }

    setIsLeaving(true);

    try {
      const batch = writeBatch(db);

      const memberDocRef = doc(db, "teams", teamId, "members", uid);

      batch.delete(memberDocRef);

      const userDocRef = doc(db, "users", uid);

      batch.update(userDocRef, {
        teamId: deleteField(),

        teamRole: deleteField(),
      });

      await batch.commit();

      navigate("/");
    } catch (error) {
      console.error("팀 나가기 실패:", error);

      alert("팀을 나가는 중 오류가 발생했습니다.");

      setIsLeaving(false);
    }
  };

  const handleDelegateCaptain = async (newCaptain) => {
    const currentCaptainId = auth.currentUser?.uid;

    if (
      !teamId ||
      !currentCaptainId ||
      !newCaptain.id ||
      currentCaptainId === newCaptain.id
    ) {
      return;
    }

    if (
      !window.confirm(
        `${newCaptain.realName}님에게 주장을 위임하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }

    try {
      const batch = writeBatch(db);

      const newCaptainMemberRef = doc(
        db,
        "teams",
        teamId,
        "members",
        newCaptain.id,
      );

      const newCaptainUserRef = doc(db, "users", newCaptain.id);

      batch.update(newCaptainMemberRef, { role: "captain" });

      batch.update(newCaptainUserRef, { teamRole: "captain" });

      const oldCaptainMemberRef = doc(
        db,
        "teams",
        teamId,
        "members",
        currentCaptainId,
      );

      const oldCaptainUserRef = doc(db, "users", currentCaptainId);

      batch.update(oldCaptainMemberRef, { role: "member" });

      batch.update(oldCaptainUserRef, { teamRole: "member" });

      await batch.commit();
    } catch (error) {
      console.error("주장 위임 실패:", error);

      alert("주장 위임 중 오류가 발생했습니다.");
    }
  };

  const handleSetAttendance = async (matchId, status) => {
    const uid = auth.currentUser?.uid;

    if (!uid || !teamId || !matchId) {
      console.error("사용자 정보 또는 팀/매치 정보가 없습니다.");

      return;
    }

    try {
      const attendanceDocRef = doc(
        db,
        "teams",
        teamId,
        "matches",
        matchId,
        "attendance",
        uid,
      );

      await setDoc(attendanceDocRef, { status: status });
    } catch (error) {
      console.error("참석 여부 설정 실패:", error);

      alert("참석 여부를 변경하는 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteMatch = async (match) => {
    if (!teamId || !match?.id) return;

    if (
      !window.confirm(
        "정말로 이 경기를 삭제하시겠습니까? 모든 경기 기록과 설문 결과가 영구적으로 삭제됩니다.",
      )
    ) {
      return;
    }

    try {
      const batch = writeBatch(db);

      const attColRef = collection(
        db,
        "teams",
        teamId,
        "matches",
        match.id,
        "attendance",
      );

      const attSnapshot = await getDocs(attColRef);

      attSnapshot.docs.forEach((d) => batch.delete(d.ref));

      const surveyColRef = collection(
        db,
        "teams",
        teamId,
        "matches",
        match.id,
        "surveys",
      );

      const surveySnapshot = await getDocs(surveyColRef);

      surveySnapshot.docs.forEach((d) => batch.delete(d.ref));

      const matchDocRef = doc(db, "teams", teamId, "matches", match.id);

      batch.delete(matchDocRef);

      await batch.commit();
    } catch (error) {
      console.error("경기 삭제 실패:", error);

      alert("경기를 삭제하는 중 오류가 발생했습니다.");
    }
  };

  const handleCompleteMatch = async (match) => {
    if (!teamId || !match?.id) return;

    try {
      const attendees = await buildAttendeesForMatch(match);

      if (!attendees || attendees.length === 0) {
        alert(
          "참석자가 0명인 경기는 완료할 수 없습니다.\n먼저 '참석' 버튼을 눌러주세요.",
        );

        return;
      }

      const participantUids = attendees.map((p) => p.uid);

      const matchDocRef = doc(db, "teams", teamId, "matches", match.id);

      await updateDoc(matchDocRef, {
        status: "completed",

        pendingSurveyParticipants: participantUids,
      });

      const currentUid = auth.currentUser?.uid;

      const didCurrentUserAttend = participantUids.includes(currentUid);

      if (didCurrentUserAttend) {
        setSurveyState({ open: true, match: match, attendees: attendees });
      } else {
        alert("경기를 완료 처리했습니다.");
      }
    } catch (error) {
      console.error("경기 완료 처리 실패:", error);

      alert("경기를 완료하는 중 오류가 발생했습니다.");
    }
  };

  if (loading && !teamInfo) {
    return (
      <div className={styles.loadingContainer}>팀 정보를 불러오는 중...</div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <TeamHeader
        teamInfo={teamInfo}
        isCaptain={isCaptain}
        onLeaveTeam={handleLeaveTeam}
        isLeaving={isLeaving}
      />

      <main className={styles.content}>
        <section className={styles.section}>
          <h3>경기 일정 ({matches.length})</h3>

          {matches.length === 0 ? (
            <div className={styles.emptyState}>등록된 경기가 없습니다.</div>
          ) : (
            matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                myStatus={myAttMap[match.id] || "none"}
                canManage={canManage}
                onCardClick={() => handleMatchCardClick(match)}
                onSetAttendance={(status) =>
                  handleSetAttendance(match.id, status)
                }
                onComplete={() => handleCompleteMatch(match)}
                onCancel={() => handleDeleteMatch(match)}
                onDelete={() => handleDeleteMatch(match)}
              />
            ))
          )}
        </section>

        {canManage && (
          <section className={styles.section}>
            <button
              className={styles.createMatchButton}
              onClick={() => setIsCreateModalOpen(true)}
            >
              <h4>새로운 경기 만들기</h4>

              <p>경기 일정을 잡고 참석 여부를 투표하세요.</p>
            </button>
          </section>
        )}

        <section className={styles.section}>
          <h3>팀원 목록 ({members.length})</h3>

          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              isMyCard={auth.currentUser?.uid === member.id}
              isCaptainView={isCaptain}
              onDelegateCaptain={() => handleDelegateCaptain(member)}
              onSetVice={() => handleSetVice(member)}
            />
          ))}
        </section>
      </main>

      {}

      {isCreateModalOpen && (
        <CreateMatchModal
          teamId={teamId}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}

      {}

      {squadState.open && (
        <SquadModal
          {...squadState}
          onClose={() => setSquadState((p) => ({ ...p, open: false }))}
          teamId={teamId}
          canManage={canManage}
        />
      )}

      {surveyState.open && (
        <PostMatchSurveyModal
          {...surveyState}
          onClose={() => setSurveyState((p) => ({ ...p, open: false }))}
          teamId={teamId}
          userProfile={userProfile}
        />
      )}

      {resultsState.open && (
        <ResultsModal
          {...resultsState}
          onClose={() => setResultsState((p) => ({ ...p, open: false }))}
        />
      )}

      {}
    </div>
  );
}

export default TeamPage;

// 팀 요약과 상단 액션을 묶는 헤더 컴포넌트다.
const TeamHeader = ({ teamInfo, isCaptain, onLeaveTeam, isLeaving }) => (
  <header className={styles.header}>
    <div className={styles.headerMain}>
      <h2 className={styles.headerTitle}>{teamInfo?.teamName || "팀 정보"}</h2>

      <div className={styles.headerActions}>
        {!isCaptain && (
          <button
            className={styles.actionButton}
            onClick={onLeaveTeam}
            disabled={isLeaving}
          >
            {isLeaving ? "나가는 중…" : "팀 나가기"}
          </button>
        )}

        <Link to="/" className={styles.actionLink}>
          마이 프로필
        </Link>
      </div>
    </div>

    <div className={styles.inviteCode}>
      초대 코드: <strong>{teamInfo?.inviteCode || "-"}</strong>
    </div>
  </header>
);

// 경기 카드로 출석, 결과, 관리 버튼을 표시한다.
const MatchCard = ({
  match,
  myStatus,
  canManage,
  onCardClick,
  onSetAttendance,
  onComplete,
  onCancel,
  onDelete,
}) => {
  const whenStr = match.when?.toDate
    ? format(match.when.toDate(), "yyyy.MM.dd (EEE) HH:mm", { locale: ko })
    : "-";

  const isPending = !match.status || match.status === "pending";

  const isCompleted = match.status === "completed";

  return (
    <div
      className={`${styles.card} ${isCompleted ? styles.cardCompleted : ""}`}
    >
      {canManage && (
        <div className={styles.topRightActions}>
          {isCompleted && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="경기 삭제"
              className={styles.deleteButton}
            >
              ×
            </button>
          )}
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        className={styles.cardClickableArea}
        onClick={onCardClick}
        onKeyDown={(e) => e.key === "Enter" && onCardClick()}
      >
        <h4>{whenStr}</h4>

        <p>{match.location}</p>
      </div>

      {isPending && (
        <div className={styles.cardActions}>
          <div className={styles.attendanceButtons}>
            <button
              className={`${styles.attButton} ${myStatus === "yes" ? styles.active : ""}`}
              onClick={() => onSetAttendance("yes")}
            >
              참석
            </button>

            <button
              className={`${styles.attButton} ${myStatus === "maybe" ? styles.active : ""}`}
              onClick={() => onSetAttendance("maybe")}
            >
              미정
            </button>

            <button
              className={`${styles.attButton} ${myStatus === "no" ? styles.active : ""}`}
              onClick={() => onSetAttendance("no")}
            >
              불참
            </button>
          </div>

          {canManage && (
            <div className={styles.adminActions}>
              <button
                className={`${styles.adminButton} ${styles.primary}`}
                onClick={() => onComplete()}
              >
                경기 완료
              </button>

              <button
                className={`${styles.adminButton} ${styles.danger}`}
                onClick={() => onCancel()}
              >
                경기 취소
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 팀원 정보를 보여주고 권한 변경을 처리한다.
const MemberCard = ({
  member,
  isMyCard,
  isCaptainView,
  onDelegateCaptain,
  onSetVice,
}) => {
  const nameWithPlayer = member.selectedPlayerName
    ? `${member.realName} (${member.selectedPlayerName})`
    : member.realName;

  const roleLower = (member.role || "member").toLowerCase();

  const isMemberCaptain = roleLower === "captain";

  const isMemberVice = roleLower.includes("vice");

  return (
    <div
      className={`${styles.memberCard} ${isMemberCaptain ? styles.captainCard : ""} ${isMemberVice ? styles.viceCard : ""}`}
    >
      <div className={styles.memberHeader}>
        <div className={styles.memberName}>{nameWithPlayer}</div>

        <div className={styles.memberOvr}>{member.displayOvr ?? "-"}</div>
      </div>

      <div className={styles.memberMeta}>
        {member.position || "-"} · {member.role || "member"}
      </div>

      {isCaptainView && !isMyCard && !isMemberCaptain && (
        <div className={styles.captainActions}>
          <button onClick={onDelegateCaptain}>주장 위임</button>

          <button
            onClick={onSetVice}
            className={isMemberVice ? styles.active : ""}
          >
            부주장 임명
          </button>
        </div>
      )}
    </div>
  );
};
